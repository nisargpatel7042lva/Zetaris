/**
 * Tests for Bridge Service
 */

import BridgeService, { BridgeNetwork } from '../../src/bridge/BridgeService';
import { BridgeWatcher } from '../../src/bridge/BridgeWatcher';

describe('BridgeService', () => {
  let bridgeService: BridgeService;

  beforeEach(() => {
    bridgeService = new BridgeService();
  });

  afterEach(() => {
    bridgeService.stopWatching();
  });

  describe('Network Configuration', () => {
    it('should add network configuration', () => {
      const config = {
        network: BridgeNetwork.ETHEREUM,
        rpcUrl: 'https://eth-mainnet.example.com',
        bridgeContractAddress: '0x1234567890123456789012345678901234567890',
        confirmations: 12,
      };

      expect(() => bridgeService.addNetwork(config)).not.toThrow();
    });

    it('should handle multiple networks', () => {
      const ethConfig = {
        network: BridgeNetwork.ETHEREUM,
        rpcUrl: 'https://eth-mainnet.example.com',
        bridgeContractAddress: '0x1234567890123456789012345678901234567890',
        confirmations: 12,
      };

      const polyConfig = {
        network: BridgeNetwork.POLYGON,
        rpcUrl: 'https://polygon-mainnet.example.com',
        bridgeContractAddress: '0x9876543210987654321098765432109876543210',
        confirmations: 128,
      };

      bridgeService.addNetwork(ethConfig);
      bridgeService.addNetwork(polyConfig);

      expect(bridgeService).toBeDefined();
    });
  });

  describe('Transfer Management', () => {
    it('should track transfer status', () => {
      const transferId = '0x1234';
      const transfer = bridgeService.getTransfer(transferId);

      expect(transfer).toBeUndefined(); // Not yet created
    });

    it('should return all transfers', () => {
      const transfers = bridgeService.getAllTransfers();
      expect(Array.isArray(transfers)).toBe(true);
      expect(transfers.length).toBe(0);
    });

    it('should filter pending transfers by network', () => {
      const pending = bridgeService.getPendingTransfers(BridgeNetwork.ETHEREUM);
      expect(Array.isArray(pending)).toBe(true);
    });
  });

  describe('Event Watching', () => {
    it('should start watching', () => {
      expect(() => bridgeService.startWatching()).not.toThrow();
    });

    it('should stop watching', () => {
      bridgeService.startWatching();
      expect(() => bridgeService.stopWatching()).not.toThrow();
    });

    it('should not throw when stopping without starting', () => {
      expect(() => bridgeService.stopWatching()).not.toThrow();
    });
  });

  describe('Event Emission', () => {
    it('should emit transfer initiated event', (done) => {
      bridgeService.on('transfer:initiated', (transfer) => {
        expect(transfer).toBeDefined();
        expect(transfer.sourceNetwork).toBeDefined();
        done();
      });

      // Manually trigger event for testing
      bridgeService.emit('transfer:initiated', {
        id: '0x123',
        sourceNetwork: BridgeNetwork.ETHEREUM,
        targetNetwork: BridgeNetwork.POLYGON,
        sender: '0xabc',
        recipient: '0xdef',
        amount: 1000n,
        token: '0x000',
        status: 'pending',
        timestamp: Date.now(),
      });
    });

    it('should emit transfer confirmed event', (done) => {
      bridgeService.on('transfer:confirmed', (transfer) => {
        expect(transfer.status).toBe('confirmed');
        done();
      });

      bridgeService.emit('transfer:confirmed', {
        id: '0x123',
        sourceNetwork: BridgeNetwork.ETHEREUM,
        targetNetwork: BridgeNetwork.POLYGON,
        sender: '0xabc',
        recipient: '0xdef',
        amount: 1000n,
        token: '0x000',
        status: 'confirmed',
        timestamp: Date.now(),
      });
    });
  });
});

describe('BridgeWatcher', () => {
  let bridgeService: BridgeService;
  let watcher: BridgeWatcher;

  beforeEach(() => {
    bridgeService = new BridgeService();
    watcher = new BridgeWatcher(bridgeService, {
      pollInterval: 5000,
      autoRelay: false,
      networks: [BridgeNetwork.ETHEREUM, BridgeNetwork.POLYGON],
    });
  });

  afterEach(() => {
    watcher.stop();
    bridgeService.stopWatching();
  });

  describe('Watcher Lifecycle', () => {
    it('should start watcher', () => {
      expect(() => watcher.start()).not.toThrow();
    });

    it('should stop watcher', () => {
      watcher.start();
      expect(() => watcher.stop()).not.toThrow();
    });

    it('should not throw when starting twice', () => {
      watcher.start();
      expect(() => watcher.start()).not.toThrow();
    });

    it('should emit watcher started event', (done) => {
      watcher.on('watcher:started', () => {
        done();
      });

      watcher.start();
    });
  });

  describe('Event Handling', () => {
    it('should handle tokens locked event', (done) => {
      watcher.on('event:tokens-locked', (transfer) => {
        expect(transfer).toBeDefined();
        expect(transfer.status).toBe('confirmed');
        done();
      });

      watcher.start();

      // Simulate tokens locked event
      bridgeService.emit('tokens:locked', {
        id: '0x123',
        sourceNetwork: BridgeNetwork.ETHEREUM,
        targetNetwork: BridgeNetwork.POLYGON,
        sender: '0xabc',
        recipient: '0xdef',
        amount: 1000n,
        token: '0x000',
        status: 'confirmed',
        timestamp: Date.now(),
      });
    });
  });
});
