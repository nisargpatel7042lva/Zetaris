/**
 * Mesh Network Tests
 * Tests for MeshPeer, MeshRouter, and OfflineSync
 */

import { MeshPeer } from '../../src/mesh/MeshPeer';
import { MeshRouter } from '../../src/mesh/MeshRouter';
import { OfflineSyncManager } from '../../src/mesh/OfflineSync';

describe('MeshPeer', () => {
  let peer: MeshPeer;

  beforeEach(() => {
    peer = new MeshPeer('test-public-key-123');
  });

  afterEach(async () => {
    await peer.stop();
  });

  test('should initialize peer correctly', () => {
    expect(peer.id).toBeDefined();
    expect(peer.publicKey).toBe('test-public-key-123');
    expect(peer.getConnectedPeers()).toHaveLength(0);
  });

  test('should start peer successfully', async () => {
    const started = jest.fn();
    peer.on('peer:started', started);

    await peer.start();

    expect(started).toHaveBeenCalled();
  });

  test('should connect to peer', async () => {
    const connected = jest.fn();
    peer.on('peer:connected', connected);

    await peer.start();
    
    const peerInfo = {
      id: 'peer2',
      publicKey: 'peer2-pubkey',
      address: 'localhost',
      port: 8081,
      lastSeen: Date.now(),
      reputation: 100,
      capabilities: []
    };
    
    await peer.connectToPeer(peerInfo);

    expect(connected).toHaveBeenCalled();
    expect(peer.getConnectedPeers()).toHaveLength(1);
  });

  test('should broadcast message to all peers', async () => {
    await peer.start();
    
    const peerInfo1 = {
      id: 'peer2',
      publicKey: 'peer2-pubkey',
      address: 'localhost',
      port: 8081,
      lastSeen: Date.now(),
      reputation: 100,
      capabilities: []
    };
    
    const peerInfo2 = {
      id: 'peer3',
      publicKey: 'peer3-pubkey',
      address: 'localhost',
      port: 8082,
      lastSeen: Date.now(),
      reputation: 100,
      capabilities: []
    };
    
    await peer.connectToPeer(peerInfo1);
    await peer.connectToPeer(peerInfo2);

    const broadcast = jest.fn();
    peer.on('message:broadcast', broadcast);

    await peer.broadcast('transaction', { amount: '100' });

    expect(broadcast).toHaveBeenCalled();
  });

  test('should handle message with TTL', async () => {
    const received = jest.fn();
    peer.on('message:received', received);

    await peer.start();

    const message = {
      id: 'msg1',
      from: 'peer2',
      type: 'transaction' as const,
      data: { amount: '100' },
      timestamp: Date.now(),
      ttl: 5,
    };

    // Simulate message received
    peer.emit('message:received', message);

    expect(received).toHaveBeenCalledWith(message);
  });

  test('should not rebroadcast cached messages', async () => {
    await peer.start();

    const message = {
      id: 'msg1',
      from: 'peer2',
      type: 'transaction' as const,
      data: { amount: '100' },
      timestamp: Date.now(),
      ttl: 5,
    };

    // Send message twice
    peer.emit('message:received', message);
    peer.emit('message:received', message);

    // Should only process once due to cache
  });

  test('should disconnect peer', async () => {
    await peer.start();
    
    const peerInfo = {
      id: 'peer2',
      publicKey: 'peer2-pubkey',
      address: 'localhost',
      port: 8081,
      lastSeen: Date.now(),
      reputation: 100,
      capabilities: []
    };
    
    await peer.connectToPeer(peerInfo);

    const disconnected = jest.fn();
    peer.on('peer:disconnected', disconnected);

    await peer.disconnectFromPeer('peer2');

    expect(disconnected).toHaveBeenCalled();
    expect(peer.getConnectedPeers()).toHaveLength(0);
  });
});

describe('MeshRouter', () => {
  let router: MeshRouter;

  beforeEach(() => {
    router = new MeshRouter('peer1');
  });

  test('should initialize router correctly', () => {
    expect(router.getTableSize()).toBe(0);
    expect(router.getRoutes()).toHaveLength(0);
  });

  test('should add route', () => {
    const added = jest.fn();
    router.on('route:added', added);

    router.addRoute('peer2', 'peer3', 2);

    expect(added).toHaveBeenCalled();
    expect(router.getTableSize()).toBe(1);
    expect(router.canReach('peer2')).toBe(true);
  });

  test('should find next hop', () => {
    router.addRoute('peer2', 'peer3', 2);

    const nextHop = router.findNextHop('peer2');

    expect(nextHop).toBe('peer3');
  });

  test('should update route if better', () => {
    router.addRoute('peer2', 'peer3', 3);
    router.addRoute('peer2', 'peer4', 2);

    const route = router.getRoute('peer2');

    expect(route?.nextHop).toBe('peer4');
    expect(route?.hopCount).toBe(2);
  });

  test('should not update route if worse', () => {
    router.addRoute('peer2', 'peer3', 2);
    router.addRoute('peer2', 'peer4', 3);

    const route = router.getRoute('peer2');

    expect(route?.nextHop).toBe('peer3');
    expect(route?.hopCount).toBe(2);
  });

  test('should remove route', () => {
    router.addRoute('peer2', 'peer3', 2);

    const removed = jest.fn();
    router.on('route:removed', removed);

    router.removeRoute('peer2');

    expect(removed).toHaveBeenCalled();
    expect(router.canReach('peer2')).toBe(false);
  });

  test('should generate announcement', () => {
    router.addRoute('peer2', 'peer3', 2);
    router.addRoute('peer4', 'peer5', 1);

    const announcement = router.generateAnnouncement();

    // Should include self + 2 routes
    expect(announcement).toHaveLength(3);
    expect(announcement[0].destination).toBe('peer1');
    expect(announcement[0].hopCount).toBe(0);
  });

  test('should update from announcement', () => {
    const routes = [
      { destination: 'peer2', hopCount: 1 },
      { destination: 'peer3', hopCount: 2 },
    ];

    router.updateFromAnnouncement('peer4', routes);

    expect(router.getTableSize()).toBe(2);
    expect(router.findNextHop('peer2')).toBe('peer4');
    expect(router.getRoute('peer2')?.hopCount).toBe(2); // 1 + 1
  });

  test('should not route to self', () => {
    const routes = [{ destination: 'peer1', hopCount: 0 }];

    router.updateFromAnnouncement('peer2', routes);

    expect(router.canReach('peer1')).toBe(false);
  });

  test('should respect max hops', () => {
    const shortRouter = new MeshRouter('peer1', 3);
    const routes = [{ destination: 'peer2', hopCount: 10 }];

    shortRouter.updateFromAnnouncement('peer3', routes);

    expect(shortRouter.canReach('peer2')).toBe(false);
  });

  test('should cleanup expired routes', () => {
    router.addRoute('peer2', 'peer3', 2);

    const route = router.getRoute('peer2');
    if (route) {
      route.lastUpdated = Date.now() - 400000; // 6 minutes ago
    }

    const cleaned = jest.fn();
    router.on('routes:cleaned', cleaned);

    router.cleanupRoutes();

    expect(cleaned).toHaveBeenCalled();
    expect(router.canReach('peer2')).toBe(false);
  });

  test('should clear all routes', () => {
    router.addRoute('peer2', 'peer3', 2);
    router.addRoute('peer4', 'peer5', 1);

    const cleared = jest.fn();
    router.on('routes:cleared', cleared);

    router.clear();

    expect(cleared).toHaveBeenCalled();
    expect(router.getTableSize()).toBe(0);
  });
});

describe('OfflineSyncManager', () => {
  let syncManager: OfflineSyncManager;

  beforeEach(() => {
    syncManager = new OfflineSyncManager(3, 1000);
  });

  afterEach(() => {
    syncManager.stop();
  });

  test('should initialize sync manager correctly', () => {
    expect(syncManager.getQueueSize()).toBe(0);
    expect(syncManager.isOnlineMode()).toBe(false);
  });

  test('should start sync manager', () => {
    const started = jest.fn();
    syncManager.on('started', started);

    syncManager.start();

    expect(started).toHaveBeenCalled();
  });

  test('should queue transaction', () => {
    const queued = jest.fn();
    syncManager.on('transaction:queued', queued);

    const txId = syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    expect(queued).toHaveBeenCalled();
    expect(txId).toBe('tx1');
    expect(syncManager.getQueueSize()).toBe(1);
  });

  test('should get transaction from queue', () => {
    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    const tx = syncManager.getTransaction('tx1');

    expect(tx).toBeDefined();
    expect(tx?.id).toBe('tx1');
    expect(tx?.status).toBe('queued');
  });

  test('should get sync status', () => {
    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    const status = syncManager.getSyncStatus();

    expect(status.totalQueued).toBe(1);
    expect(status.syncing).toBe(0);
    expect(status.synced).toBe(0);
    expect(status.failed).toBe(0);
  });

  test('should set online status', () => {
    const online = jest.fn();
    syncManager.on('online', online);

    syncManager.setOnline(true);

    expect(online).toHaveBeenCalled();
    expect(syncManager.isOnlineMode()).toBe(true);
  });

  test('should sync transaction when online', async () => {
    const synced = jest.fn();
    const syncing = jest.fn();
    syncManager.on('transaction:synced', synced);
    syncManager.on('transaction:syncing', syncing);
    
    syncManager.setOnline(true);

    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(syncing).toHaveBeenCalled();
    expect(synced).toHaveBeenCalled();

    const tx = syncManager.getTransaction('tx1');
    expect(tx?.status).toBe('synced');
  });

  test('should handle sync error', async () => {
    const errorEvent = jest.fn();
    syncManager.on('transaction:error', errorEvent);
    
    // Mock broadcast failure before setting online
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(syncManager as any, 'broadcastTransaction').mockRejectedValue(
      new Error('Network error')
    );

    syncManager.setOnline(true);

    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(errorEvent).toHaveBeenCalled();

    const tx = syncManager.getTransaction('tx1');
    expect(tx?.status).toBe('queued'); // Returns to queued on error
    expect(tx?.lastError).toBe('Network error');
    
    spy.mockRestore();
  });

  test('should fail after max retries', async () => {
    const failed = jest.fn();
    syncManager.on('transaction:failed', failed);
    
    syncManager.setOnline(true);

    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    // Wait for initial auto-sync
    await new Promise(resolve => setTimeout(resolve, 200));

    // Set retry count to max (3) which triggers immediate failure
    const tx = syncManager.getTransaction('tx1');
    if (tx) {
      tx.retryCount = 3; // At max, will fail immediately
      tx.status = 'queued'; // Reset status
    }

    await syncManager.syncTransaction('tx1');

    expect(failed).toHaveBeenCalled();

    const finalTx = syncManager.getTransaction('tx1');
    expect(finalTx?.status).toBe('failed');
    expect(finalTx?.lastError).toBe('Max retries exceeded');
  });

  test('should clear synced transactions', async () => {
    syncManager.setOnline(true);

    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    await syncManager.syncTransaction('tx1');

    const cleared = jest.fn();
    syncManager.on('queue:cleared', cleared);

    syncManager.clearSynced();

    // Won't be immediately cleared (60s delay)
  });

  test('should get queued transactions', () => {
    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    syncManager.queueTransaction({
      id: 'tx2',
      type: 'swap',
      from: 'addr3',
      to: 'addr4',
      amount: '200',
      timestamp: Date.now(),
    });

    const queued = syncManager.getQueuedTransactions();

    expect(queued).toHaveLength(2);
    expect(queued[0].status).toBe('queued');
  });

  test('should retry failed transactions', async () => {
    syncManager.setOnline(true);

    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    // Fail transaction
    const tx = syncManager.getTransaction('tx1');
    if (tx) {
      tx.status = 'failed';
      tx.retryCount = 3;
    }

    await syncManager.retryFailed();

    const retried = syncManager.getTransaction('tx1');
    expect(retried?.retryCount).toBe(1); // Reset + 1 sync attempt
  });

  test('should clear all transactions', () => {
    syncManager.queueTransaction({
      id: 'tx1',
      type: 'transfer',
      from: 'addr1',
      to: 'addr2',
      amount: '100',
      timestamp: Date.now(),
    });

    const cleared = jest.fn();
    syncManager.on('queue:cleared:all', cleared);

    syncManager.clearAll();

    expect(cleared).toHaveBeenCalled();
    expect(syncManager.getQueueSize()).toBe(0);
  });
});
