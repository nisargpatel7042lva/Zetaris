import { ethers } from 'ethers';
import * as logger from '../utils/logger';

export interface DecoyTransaction {
  id: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  chain: string;
  timestamp: number;
  txHash?: string;
  isReal: boolean;
}

export interface TransactionPattern {
  averageAmount: number;
  frequency: number;
  preferredTimes: number[];
  commonRecipients: string[];
}

export interface DecoyConfig {
  enabled: boolean;
  decoyRatio: number;
  minDelay: number;
  maxDelay: number;
  amountVariance: number;
}

class DecoyTransactionService {
  private static instance: DecoyTransactionService;
  private decoyTransactions: Map<string, DecoyTransaction>;
  private userPatterns: Map<string, TransactionPattern>;
  private config: DecoyConfig;
  private scheduledDecoys: Map<string, NodeJS.Timeout>;

  private constructor() {
    this.decoyTransactions = new Map();
    this.userPatterns = new Map();
    this.scheduledDecoys = new Map();
    this.config = {
      enabled: true,
      decoyRatio: 0.3,
      minDelay: 300000,
      maxDelay: 3600000,
      amountVariance: 0.2,
    };
  }

  static getInstance(): DecoyTransactionService {
    if (!DecoyTransactionService.instance) {
      DecoyTransactionService.instance = new DecoyTransactionService();
    }
    return DecoyTransactionService.instance;
  }

  setConfig(config: Partial<DecoyConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Decoy config updated:', this.config);
  }

  getConfig(): DecoyConfig {
    return { ...this.config };
  }

  async analyzeUserPattern(
    userAddress: string,
    transactions: Array<{
      to: string;
      amount: string;
      timestamp: number;
    }>
  ): Promise<TransactionPattern> {
    if (transactions.length === 0) {
      return {
        averageAmount: 0,
        frequency: 0,
        preferredTimes: [],
        commonRecipients: [],
      };
    }

    const amounts = transactions.map(tx => parseFloat(tx.amount));
    const averageAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

    const timestamps = transactions.map(tx => tx.timestamp).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    const averageInterval = intervals.length > 0
      ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      : 0;
    const frequency = averageInterval > 0 ? 1000 / averageInterval : 0;

    const hourCounts = new Array(24).fill(0);
    for (const tx of transactions) {
      const hour = new Date(tx.timestamp).getHours();
      hourCounts[hour]++;
    }
    const maxCount = Math.max(...hourCounts);
    const preferredTimes = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count >= maxCount * 0.5)
      .map(item => item.hour);

    const recipientCounts = new Map<string, number>();
    for (const tx of transactions) {
      recipientCounts.set(tx.to, (recipientCounts.get(tx.to) || 0) + 1);
    }
    const commonRecipients = Array.from(recipientCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    const pattern: TransactionPattern = {
      averageAmount,
      frequency,
      preferredTimes,
      commonRecipients,
    };

    this.userPatterns.set(userAddress, pattern);
    logger.info(`Pattern analyzed for ${userAddress}:`, pattern);

    return pattern;
  }

  generateDecoyAmount(pattern: TransactionPattern): string {
    const baseAmount = pattern.averageAmount;
    const variance = this.config.amountVariance;
    const randomFactor = 1 + (Math.random() * 2 - 1) * variance;
    const decoyAmount = baseAmount * randomFactor;
    return ethers.parseEther(decoyAmount.toFixed(6)).toString();
  }

  generateDecoyRecipient(pattern: TransactionPattern): string {
    if (pattern.commonRecipients.length > 0 && Math.random() < 0.7) {
      return pattern.commonRecipients[Math.floor(Math.random() * pattern.commonRecipients.length)];
    }
    return ethers.Wallet.createRandom().address;
  }

  generateDecoyTimestamp(pattern: TransactionPattern): number {
    const now = Date.now();
    const delay = this.config.minDelay + Math.random() * (this.config.maxDelay - this.config.minDelay);
    let timestamp = now + delay;

    if (pattern.preferredTimes.length > 0 && Math.random() < 0.8) {
      const preferredHour = pattern.preferredTimes[Math.floor(Math.random() * pattern.preferredTimes.length)];
      const targetDate = new Date(timestamp);
      targetDate.setHours(preferredHour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      timestamp = targetDate.getTime();
    }

    return timestamp;
  }

  async createDecoyTransaction(
    userAddress: string,
    token: string,
    chain: string
  ): Promise<DecoyTransaction> {
    const pattern = this.userPatterns.get(userAddress) || {
      averageAmount: 0.1,
      frequency: 1,
      preferredTimes: [9, 12, 15, 18],
      commonRecipients: [],
    };

    const decoy: DecoyTransaction = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`decoy-${Date.now()}-${userAddress}`)),
      from: userAddress,
      to: this.generateDecoyRecipient(pattern),
      amount: this.generateDecoyAmount(pattern),
      token,
      chain,
      timestamp: this.generateDecoyTimestamp(pattern),
      isReal: false,
    };

    this.decoyTransactions.set(decoy.id, decoy);
    logger.info(`Decoy transaction created: ${decoy.id}`);

    return decoy;
  }

  async scheduleDecoys(
    userAddress: string,
    token: string,
    chain: string,
    count: number
  ): Promise<DecoyTransaction[]> {
    if (!this.config.enabled) {
      logger.warn('Decoy generation is disabled');
      return [];
    }

    const decoys: DecoyTransaction[] = [];

    for (let i = 0; i < count; i++) {
      const decoy = await this.createDecoyTransaction(userAddress, token, chain);
      decoys.push(decoy);

      const delay = decoy.timestamp - Date.now();
      if (delay > 0) {
        const timeout = setTimeout(() => {
          this.broadcastDecoy(decoy);
          this.scheduledDecoys.delete(decoy.id);
        }, delay);

        this.scheduledDecoys.set(decoy.id, timeout);
      }
    }

    logger.info(`Scheduled ${count} decoy transactions for ${userAddress}`);
    return decoys;
  }

  private async broadcastDecoy(decoy: DecoyTransaction): Promise<void> {
    logger.info(`Broadcasting decoy transaction: ${decoy.id}`);
    
    const fakeTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${decoy.id}-${decoy.timestamp}`)
    );
    
    decoy.txHash = fakeTxHash;
    this.decoyTransactions.set(decoy.id, decoy);

    logger.info(`Decoy broadcasted with fake hash: ${fakeTxHash}`);
  }

  async generateDecoyGraph(
    userAddress: string,
    realTransaction: DecoyTransaction,
    decoyCount?: number
  ): Promise<DecoyTransaction[]> {
    if (!this.config.enabled) {
      return [realTransaction];
    }

    const count = decoyCount || Math.floor(1 / this.config.decoyRatio) - 1;
    const decoys = await this.scheduleDecoys(
      realTransaction.from,
      realTransaction.token,
      realTransaction.chain,
      count
    );

    const allTransactions = [realTransaction, ...decoys];
    this.shuffleArray(allTransactions);

    logger.info(`Generated decoy graph with ${count} decoys for real tx`);
    return allTransactions;
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  cancelScheduledDecoy(decoyId: string): boolean {
    const timeout = this.scheduledDecoys.get(decoyId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledDecoys.delete(decoyId);
      logger.info(`Cancelled scheduled decoy: ${decoyId}`);
      return true;
    }
    return false;
  }

  cancelAllScheduledDecoys(): number {
    let count = 0;
    for (const [id, timeout] of this.scheduledDecoys) {
      clearTimeout(timeout);
      this.scheduledDecoys.delete(id);
      count++;
    }
    logger.info(`Cancelled ${count} scheduled decoys`);
    return count;
  }

  getDecoyTransaction(id: string): DecoyTransaction | undefined {
    return this.decoyTransactions.get(id);
  }

  getAllDecoys(userAddress?: string): DecoyTransaction[] {
    const allDecoys = Array.from(this.decoyTransactions.values());
    if (userAddress) {
      return allDecoys.filter(d => d.from === userAddress);
    }
    return allDecoys;
  }

  getScheduledDecoys(userAddress?: string): DecoyTransaction[] {
    const scheduled: DecoyTransaction[] = [];
    for (const [id] of this.scheduledDecoys) {
      const decoy = this.decoyTransactions.get(id);
      if (decoy && (!userAddress || decoy.from === userAddress)) {
        scheduled.push(decoy);
      }
    }
    return scheduled;
  }

  async mixRealAndDecoy(
    realTransactions: DecoyTransaction[],
    decoyRatio?: number
  ): Promise<DecoyTransaction[]> {
    const ratio = decoyRatio || this.config.decoyRatio;
    const decoyCount = Math.floor(realTransactions.length * ratio / (1 - ratio));

    const allDecoys: DecoyTransaction[] = [];

    for (const realTx of realTransactions) {
      const pattern = this.userPatterns.get(realTx.from);
      if (!pattern) continue;

      for (let i = 0; i < decoyCount / realTransactions.length; i++) {
        const decoy = await this.createDecoyTransaction(
          realTx.from,
          realTx.token,
          realTx.chain
        );
        allDecoys.push(decoy);
      }
    }

    const mixed = [...realTransactions, ...allDecoys];
    this.shuffleArray(mixed);

    logger.info(`Mixed ${realTransactions.length} real with ${allDecoys.length} decoys`);
    return mixed;
  }

  clearOldDecoys(olderThan: number): number {
    let count = 0;
    const cutoff = Date.now() - olderThan;

    for (const [id, decoy] of this.decoyTransactions) {
      if (decoy.timestamp < cutoff && !decoy.isReal) {
        this.decoyTransactions.delete(id);
        count++;
      }
    }

    logger.info(`Cleared ${count} old decoy transactions`);
    return count;
  }

  getStatistics(): {
    totalDecoys: number;
    scheduledDecoys: number;
    userPatterns: number;
    enabled: boolean;
  } {
    return {
      totalDecoys: this.decoyTransactions.size,
      scheduledDecoys: this.scheduledDecoys.size,
      userPatterns: this.userPatterns.size,
      enabled: this.config.enabled,
    };
  }

  exportDecoys(): string {
    const decoys = Array.from(this.decoyTransactions.values());
    return JSON.stringify(decoys, null, 2);
  }

  importDecoys(json: string): number {
    try {
      const decoys: DecoyTransaction[] = JSON.parse(json);
      let count = 0;

      for (const decoy of decoys) {
        this.decoyTransactions.set(decoy.id, decoy);
        count++;
      }

      logger.info(`Imported ${count} decoy transactions`);
      return count;
    } catch (error) {
      logger.error('Failed to import decoys:', error);
      return 0;
    }
  }
}

export const decoyTransactionService = DecoyTransactionService.getInstance();
