/**
 * Offline Sync Manager
 * Handles synchronization of offline actions when network is restored
 */

import { offlineStorage } from './offlineStorage';
import { networkStatus } from './networkStatus';

class OfflineSyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = new Set();
    this.apolloClient = null;
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    
    this.init();
  }

  init() {
    // Listen for network status changes
    networkStatus.addListener((status) => {
      if (status === 'online' && !this.isSyncing) {
        this.startSync();
      }
    });

    // Start sync immediately if online
    if (networkStatus.isOnline) {
      setTimeout(() => this.startSync(), 1000);
    }
  }

  setApolloClient(client) {
    this.apolloClient = client;
  }

  addSyncListener(callback) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  notifySyncListeners(event, data = {}) {
    this.syncListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  async startSync() {
    if (this.isSyncing || !networkStatus.isOnline || !this.apolloClient) {
      return;
    }

    this.isSyncing = true;
    this.notifySyncListeners('sync_started');

    try {
      const pendingActions = await offlineStorage.getPendingActions();
      
      if (pendingActions.length === 0) {
        console.log('No pending actions to sync');
        this.notifySyncListeners('sync_completed', { synced: 0, failed: 0 });
        return;
      }

      console.log(`Starting sync of ${pendingActions.length} pending actions`);
      
      let syncedCount = 0;
      let failedCount = 0;

      for (const action of pendingActions) {
        try {
          const success = await this.syncAction(action);
          if (success) {
            await offlineStorage.markActionSynced(action.id);
            syncedCount++;
            this.notifySyncListeners('action_synced', { action, syncedCount });
          } else {
            failedCount++;
            await offlineStorage.incrementRetryCount(action.id);
          }
        } catch (error) {
          console.error('Failed to sync action:', action, error);
          failedCount++;
          await offlineStorage.incrementRetryCount(action.id);
        }

        // Small delay between syncs to avoid overwhelming the server
        await this.delay(100);
      }

      // Clean up successfully synced actions
      await offlineStorage.clearSyncedActions();

      console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed`);
      this.notifySyncListeners('sync_completed', { synced: syncedCount, failed: failedCount });

    } catch (error) {
      console.error('Sync process failed:', error);
      this.notifySyncListeners('sync_failed', { error: error.message });
    } finally {
      this.isSyncing = false;
    }
  }

  async syncAction(action) {
    if (!this.apolloClient) {
      throw new Error('Apollo client not available');
    }

    // Skip actions that have exceeded max retries
    if (action.retryCount >= this.maxRetries) {
      console.warn('Action exceeded max retries, skipping:', action);
      return false;
    }

    try {
      switch (action.type) {
        case 'CLOCK_IN':
          return await this.syncClockIn(action);
        case 'CLOCK_OUT':
          return await this.syncClockOut(action);
        default:
          console.warn('Unknown action type:', action.type);
          return false;
      }
    } catch (error) {
      console.error(`Failed to sync ${action.type}:`, error);
      
      // Check if it's a network error vs server error
      if (this.isNetworkError(error)) {
        throw error; // Re-throw network errors to stop sync
      }
      
      return false; // Server errors just mark this action as failed
    }
  }

  async syncClockIn(action) {
    const { CLOCK_IN } = await import('@/graphql/operations');
    
    const result = await this.apolloClient.mutate({
      mutation: CLOCK_IN,
      variables: {
        note: action.data.note,
        lat: action.data.lat,
        lng: action.data.lng,
        manualOverride: action.data.manualOverride || false
      },
      errorPolicy: 'none' // Don't cache errors
    });

    if (result.data?.clockIn) {
      console.log('Successfully synced clock in:', result.data.clockIn);
      return true;
    }

    return false;
  }

  async syncClockOut(action) {
    const { CLOCK_OUT } = await import('@/graphql/operations');
    
    const result = await this.apolloClient.mutate({
      mutation: CLOCK_OUT,
      variables: {
        note: action.data.note,
        lat: action.data.lat,
        lng: action.data.lng,
        manualOverride: action.data.manualOverride || false
      },
      errorPolicy: 'none' // Don't cache errors
    });

    if (result.data?.clockOut) {
      console.log('Successfully synced clock out:', result.data.clockOut);
      return true;
    }

    return false;
  }

  isNetworkError(error) {
    // Check for common network error indicators
    return (
      error.networkError ||
      error.message?.includes('fetch') ||
      error.message?.includes('Network') ||
      error.message?.includes('Failed to fetch') ||
      !networkStatus.isOnline
    );
  }

  async forcSync() {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    console.log('Force starting sync...');
    await this.startSync();
  }

  async getPendingSyncCount() {
    try {
      const pendingActions = await offlineStorage.getPendingActions();
      return pendingActions.length;
    } catch (error) {
      console.error('Failed to get pending sync count:', error);
      return 0;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      isOnline: networkStatus.isOnline,
      lastSyncAttempt: this.lastSyncAttempt,
      apolloClientAvailable: !!this.apolloClient
    };
  }
}

// Export singleton instance
export const offlineSync = new OfflineSyncManager();
export default offlineSync;
