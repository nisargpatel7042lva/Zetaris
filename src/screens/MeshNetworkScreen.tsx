/**
 * Mesh Network Screen
 * P2P network status and management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MeshPeer, PeerInfo } from '../mesh/MeshPeer';
import { MeshRouter } from '../mesh/MeshRouter';
import { OfflineSyncManager } from '../mesh/OfflineSync';

export const MeshNetworkScreen: React.FC = () => {
  const [meshPeer] = useState(() => new MeshPeer('user-public-key'));
  const [meshRouter] = useState(() => new MeshRouter(meshPeer.id));
  const [syncManager] = useState(() => new OfflineSyncManager());
  
  const [isActive, setIsActive] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [queuedTransactions, setQueuedTransactions] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>({});

  useEffect(() => {
    // Set up event listeners
    meshPeer.on('peer:connected', handlePeerConnected);
    meshPeer.on('peer:disconnected', handlePeerDisconnected);
    meshPeer.on('message:broadcast', handleMessageBroadcast);
    
    syncManager.on('transaction:synced', handleTransactionSynced);
    syncManager.on('transaction:queued', handleTransactionQueued);

    return () => {
      meshPeer.removeAllListeners();
      syncManager.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        updateStatus();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  const handlePeerConnected = (peer: PeerInfo) => {
    updateStatus();
    Alert.alert('Peer Connected', `Connected to peer: ${peer.id.slice(0, 8)}...`);
  };

  const handlePeerDisconnected = (peerId: string) => {
    updateStatus();
  };

  const handleMessageBroadcast = (data: any) => {
    // Handle broadcast
  };

  const handleTransactionSynced = (tx: any) => {
    updateStatus();
    Alert.alert('Transaction Synced', `Transaction ${tx.id.slice(0, 8)}... synced successfully`);
  };

  const handleTransactionQueued = (tx: any) => {
    updateStatus();
  };

  const updateStatus = () => {
    const peers = meshPeer.getConnectedPeers();
    setConnectedPeers(peers.map(p => (typeof p === 'string' ? p : p.id)));
    setRoutes(meshRouter.getRoutes());
    setQueuedTransactions(syncManager.getQueuedTransactions());
    setSyncStatus(syncManager.getSyncStatus());
  };

  const toggleMeshNetwork = async () => {
    try {
      if (isActive) {
        await meshPeer.stop();
        syncManager.stop();
        setIsActive(false);
      } else {
        await meshPeer.start();
        syncManager.start();
        setIsActive(true);
      }
      updateStatus();
    } catch (error) {
      Alert.alert('Error', `Failed to toggle mesh network: ${error}`);
    }
  };

  const toggleOnlineMode = () => {
    const newOnlineState = !isOnline;
    syncManager.setOnline(newOnlineState);
    setIsOnline(newOnlineState);
    updateStatus();
  };

  const syncNow = async () => {
    try {
      await syncManager.syncPending();
      Alert.alert('Sync Complete', 'All pending transactions synced');
      updateStatus();
    } catch (error) {
      Alert.alert('Error', `Sync failed: ${error}`);
    }
  };

  const renderPeerItem = (peerId: string) => (
    <View key={peerId} style={styles.peerItem}>
      <View style={styles.peerIndicator} />
      <Text style={styles.peerId}>{peerId.slice(0, 16)}...</Text>
      <View style={styles.peerBadge}>
        <Text style={styles.peerBadgeText}>Active</Text>
      </View>
    </View>
  );

  const renderRouteItem = (route: { destination: string; hopCount: number; nextHop: string }) => (
    <View key={route.destination} style={styles.routeItem}>
      <View style={styles.routeInfo}>
        <Text style={styles.routeDestination}>
          {route.destination.slice(0, 12)}...
        </Text>
        <Text style={styles.routeHops}>{route.hopCount} hops</Text>
      </View>
      <Text style={styles.routeNextHop}>via {route.nextHop.slice(0, 8)}...</Text>
    </View>
  );

  const renderQueuedTransaction = (tx: { id: string; status: string; type: string; amount: string }) => (
    <View key={tx.id} style={styles.queuedTx}>
      <View style={styles.queuedTxHeader}>
        <Text style={styles.queuedTxId}>{tx.id.slice(0, 8)}...</Text>
        <View style={[
          styles.txStatusBadge,
          tx.status === 'queued' && styles.txStatus_queued,
          tx.status === 'syncing' && styles.txStatus_syncing,
          tx.status === 'synced' && styles.txStatus_synced,
        ]}>
          <Text style={styles.txStatusText}>{tx.status}</Text>
        </View>
      </View>
      <Text style={styles.queuedTxType}>{tx.type}</Text>
      <Text style={styles.queuedTxAmount}>{tx.amount}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesh Network</Text>
        <Text style={styles.subtitle}>Decentralized P2P Communication</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusLabel}>
            <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
            <Text style={styles.statusText}>Network Status</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={toggleMeshNetwork}
            trackColor={{ false: '#333', true: '#4CAF50' }}
            thumbColor={isActive ? '#fff' : '#666'}
          />
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusLabel}>
            <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
            <Text style={styles.statusText}>Online Mode</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnlineMode}
            trackColor={{ false: '#333', true: '#2196F3' }}
            thumbColor={isOnline ? '#fff' : '#666'}
            disabled={!isActive}
          />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{connectedPeers.length}</Text>
          <Text style={styles.statLabel}>Connected Peers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{routes.length}</Text>
          <Text style={styles.statLabel}>Known Routes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{syncStatus.totalQueued || 0}</Text>
          <Text style={styles.statLabel}>Queued</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{syncStatus.synced || 0}</Text>
          <Text style={styles.statLabel}>Synced</Text>
        </View>
      </View>

      {isActive && connectedPeers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Peers</Text>
          <View style={styles.list}>
            {connectedPeers.map(renderPeerItem)}
          </View>
        </View>
      )}

      {isActive && routes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Routing Table</Text>
          <View style={styles.list}>
            {routes.map(renderRouteItem)}
          </View>
        </View>
      )}

      {queuedTransactions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaction Queue</Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={syncNow}
              disabled={!isOnline}
            >
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.list}>
            {queuedTransactions.map(renderQueuedTransaction)}
          </View>
        </View>
      )}

      {!isActive && (
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🌐</Text>
          <Text style={styles.infoTitle}>Enable Mesh Network</Text>
          <Text style={styles.infoText}>
            Connect to the decentralized peer-to-peer network to enable offline
            transactions and censorship-resistant communication.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  statusCard: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statusLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginRight: 12,
  },
  statusDotActive: {
    backgroundColor: '#4CAF50',
  },
  statusDotOnline: {
    backgroundColor: '#2196F3',
  },
  statusText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  statCard: {
    width: '50%',
    padding: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  section: {
    margin: 20,
    marginTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  peerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  peerIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 12,
  },
  peerId: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
  },
  peerBadge: {
    backgroundColor: '#1a3a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  peerBadgeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  routeItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  routeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  routeDestination: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  routeHops: {
    fontSize: 12,
    color: '#888',
  },
  routeNextHop: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  queuedTx: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  queuedTxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queuedTxId: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'monospace',
  },
  txStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  txStatus_queued: {
    backgroundColor: '#4a3a0a',
  },
  txStatus_syncing: {
    backgroundColor: '#0a2a4a',
  },
  txStatus_synced: {
    backgroundColor: '#0a4a1a',
  },
  txStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  queuedTxType: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  queuedTxAmount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  infoCard: {
    margin: 20,
    padding: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
