/**
 * Transaction History Card Component
 * Displays transaction history with privacy features
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'bridge';
  amount: string;
  token: string;
  from?: string;
  to?: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  isPrivate: boolean;
  proof?: any;
}

interface Props {
  transactions: Transaction[];
  onTransactionPress?: (tx: Transaction) => void;
}

export const TransactionHistoryCard: React.FC<Props> = ({
  transactions,
  onTransactionPress,
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'send':
        return '↑';
      case 'receive':
        return '↓';
      case 'swap':
        return '⇄';
      case 'bridge':
        return '🌉';
      default:
        return '•';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'send':
        return '#FF5252';
      case 'receive':
        return '#4CAF50';
      case 'swap':
        return '#2196F3';
      case 'bridge':
        return '#9C27B0';
      default:
        return '#888';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#888';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderTransaction = (tx: Transaction) => (
    <TouchableOpacity
      key={tx.id}
      style={styles.transactionItem}
      onPress={() => onTransactionPress?.(tx)}
    >
      <View
        style={[
          styles.typeIcon,
          { backgroundColor: `${getTypeColor(tx.type)}20` },
        ]}
      >
        <Text style={[styles.typeIconText, { color: getTypeColor(tx.type) }]}>
          {getTypeIcon(tx.type)}
        </Text>
      </View>

      <View style={styles.transactionInfo}>
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionType}>
            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
          </Text>
          {tx.isPrivate && (
            <View style={styles.privacyBadge}>
              <Text style={styles.privacyBadgeText}>🔒</Text>
            </View>
          )}
        </View>

        <Text style={styles.transactionAddress}>
          {tx.type === 'send' && tx.to
            ? `To: ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`
            : tx.type === 'receive' && tx.from
            ? `From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`
            : tx.id.slice(0, 8)}
        </Text>

        <Text style={styles.transactionTime}>
          {formatTimestamp(tx.timestamp)}
        </Text>
      </View>

      <View style={styles.transactionAmount}>
        <Text
          style={[
            styles.amount,
            { color: tx.type === 'receive' ? '#4CAF50' : '#fff' },
          ]}
        >
          {tx.type === 'receive' ? '+' : '-'}
          {tx.amount}
        </Text>
        <Text style={styles.token}>{tx.token}</Text>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(tx.status) },
          ]}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Transactions</Text>
        {transactions.length > 0 && (
          <Text style={styles.count}>{transactions.length}</Text>
        )}
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubtext}>
            Your transaction history will appear here
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {transactions.map(renderTransaction)}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  count: {
    fontSize: 14,
    color: '#888',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  list: {
    maxHeight: 400,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeIconText: {
    fontSize: 20,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  privacyBadge: {
    backgroundColor: '#1a3a1a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  privacyBadgeText: {
    fontSize: 10,
  },
  transactionAddress: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 11,
    color: '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  token: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
