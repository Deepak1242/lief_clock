/**
 * Offline Storage Manager using IndexedDB
 * Handles caching of clock in/out actions when offline
 */

class OfflineStorageManager {
  constructor() {
    this.dbName = 'LiefClockOfflineDB';
    this.dbVersion = 1;
    this.db = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized && this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create offline actions store
        if (!db.objectStoreNames.contains('offlineActions')) {
          const actionStore = db.createObjectStore('offlineActions', {
            keyPath: 'id',
            autoIncrement: true
          });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
          actionStore.createIndex('type', 'type', { unique: false });
          actionStore.createIndex('synced', 'synced', { unique: false });
        }

        // Create cached shifts store for offline viewing
        if (!db.objectStoreNames.contains('cachedShifts')) {
          const shiftsStore = db.createObjectStore('cachedShifts', {
            keyPath: 'id'
          });
          shiftsStore.createIndex('userId', 'userId', { unique: false });
          shiftsStore.createIndex('clockInAt', 'clockInAt', { unique: false });
        }

        // Create user data cache
        if (!db.objectStoreNames.contains('cachedUserData')) {
          db.createObjectStore('cachedUserData', {
            keyPath: 'key'
          });
        }

        console.log('IndexedDB schema created/updated');
      };
    });
  }

  async addOfflineAction(action) {
    await this.init();
    
    const actionData = {
      ...action,
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const request = store.add(actionData);

      request.onsuccess = () => {
        console.log('Offline action stored:', actionData);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to store offline action:', request.error);
        reject(request.error);
      };
    });
  }

  async getPendingActions() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offlineActions'], 'readonly');
      const store = transaction.objectStore('offlineActions');
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onsuccess = () => {
        const actions = request.result.sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        resolve(actions);
      };

      request.onerror = () => {
        console.error('Failed to get pending actions:', request.error);
        reject(request.error);
      };
    });
  }

  async markActionSynced(actionId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const getRequest = store.get(actionId);

      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.synced = true;
          action.syncedAt = new Date().toISOString();
          
          const updateRequest = store.put(action);
          updateRequest.onsuccess = () => resolve(true);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(false);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async incrementRetryCount(actionId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const getRequest = store.get(actionId);

      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.retryCount = (action.retryCount || 0) + 1;
          action.lastRetryAt = new Date().toISOString();
          
          const updateRequest = store.put(action);
          updateRequest.onsuccess = () => resolve(action.retryCount);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(0);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async cacheShifts(shifts) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedShifts'], 'readwrite');
      const store = transaction.objectStore('cachedShifts');

      // Clear existing cache and add new data
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        const promises = shifts.map(shift => {
          return new Promise((res, rej) => {
            const addRequest = store.add({
              ...shift,
              cachedAt: new Date().toISOString()
            });
            addRequest.onsuccess = () => res();
            addRequest.onerror = () => rej(addRequest.error);
          });
        });

        Promise.all(promises)
          .then(() => resolve(shifts.length))
          .catch(reject);
      };

      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  async getCachedShifts() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedShifts'], 'readonly');
      const store = transaction.objectStore('cachedShifts');
      const request = store.getAll();

      request.onsuccess = () => {
        const shifts = request.result.sort((a, b) => 
          new Date(b.clockInAt) - new Date(a.clockInAt)
        );
        resolve(shifts);
      };

      request.onerror = () => {
        console.error('Failed to get cached shifts:', request.error);
        reject(request.error);
      };
    });
  }

  async cacheUserData(key, data) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedUserData'], 'readwrite');
      const store = transaction.objectStore('cachedUserData');
      
      const request = store.put({
        key,
        data,
        cachedAt: new Date().toISOString()
      });

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedUserData(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedUserData'], 'readonly');
      const store = transaction.objectStore('cachedUserData');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };

      request.onerror = () => {
        console.error('Failed to get cached user data:', request.error);
        reject(request.error);
      };
    });
  }

  async clearSyncedActions() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const index = store.index('synced');
      const request = index.openCursor(true); // Only synced actions

      let deletedCount = 0;
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`Cleared ${deletedCount} synced actions`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getStorageStats() {
    await this.init();

    const stats = {};
    const storeNames = ['offlineActions', 'cachedShifts', 'cachedUserData'];

    for (const storeName of storeNames) {
      try {
        const count = await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.count();

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        stats[storeName] = count;
      } catch (error) {
        stats[storeName] = 0;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorageManager();
export default offlineStorage;
