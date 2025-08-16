/**
 * Custom Service Worker for Background Location and Sync
 * Handles background sync, notifications, and location-based actions
 */

// Import Workbox if available
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.6.0/workbox-sw.js');

const CACHE_NAME = 'lief-clock-v1';
const API_CACHE = 'lief-api-v1';

// Background sync for location actions
self.addEventListener('sync', event => {
  console.log('Service Worker: Sync event triggered', event.tag);
  
  if (event.tag === 'background-location-sync' || event.tag === 'location-action-sync') {
    event.waitUntil(syncLocationActions());
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app dashboard
    event.waitUntil(
      clients.openWindow('/')
    );
  } else {
    // Default action - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync function
async function syncLocationActions() {
  console.log('Service Worker: Syncing location actions');
  
  try {
    // Open IndexedDB to get pending actions
    const db = await openIndexedDB();
    const pendingActions = await getPendingActions(db);
    
    if (pendingActions.length === 0) {
      console.log('Service Worker: No pending actions to sync');
      return;
    }
    
    console.log(`Service Worker: Found ${pendingActions.length} pending actions`);
    
    // Try to sync each action
    for (const action of pendingActions) {
      try {
        await syncSingleAction(action);
        await markActionSynced(db, action.id);
        console.log('Service Worker: Synced action', action.id);
      } catch (error) {
        console.error('Service Worker: Failed to sync action', action.id, error);
        await incrementRetryCount(db, action.id);
      }
    }
    
    // Show success notification
    await self.registration.showNotification('Sync Complete', {
      body: `Successfully synced ${pendingActions.length} clock actions`,
      tag: 'sync-complete',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png'
    });
    
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Sync a single action via GraphQL
async function syncSingleAction(action) {
  const mutation = action.type === 'CLOCK_IN' ? 
    `mutation ClockIn($note: String, $lat: Float!, $lng: Float!, $manualOverride: Boolean) {
      clockIn(note: $note, lat: $lat, lng: $lng, manualOverride: $manualOverride) { 
        id clockInAt 
      }
    }` :
    `mutation ClockOut($note: String, $lat: Float!, $lng: Float!, $manualOverride: Boolean) {
      clockOut(note: $note, lat: $lat, lng: $lng, manualOverride: $manualOverride) { 
        id clockOutAt 
      }
    }`;

  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: action.data
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }

  return result.data;
}

// IndexedDB helper functions
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LiefClockOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('offlineActions')) {
        const actionStore = db.createObjectStore('offlineActions', {
          keyPath: 'id',
          autoIncrement: true
        });
        actionStore.createIndex('timestamp', 'timestamp', { unique: false });
        actionStore.createIndex('type', 'type', { unique: false });
        actionStore.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

function getPendingActions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineActions'], 'readonly');
    const store = transaction.objectStore('offlineActions');
    const index = store.index('synced');
    const request = index.getAll(false);

    request.onsuccess = () => {
      const actions = request.result.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      resolve(actions);
    };

    request.onerror = () => reject(request.error);
  });
}

function markActionSynced(db, actionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineActions'], 'readwrite');
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

function incrementRetryCount(db, actionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineActions'], 'readwrite');
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

// Basic caching strategy
if (typeof workbox !== 'undefined') {
  workbox.routing.registerRoute(
    /\/api\/graphql/,
    new workbox.strategies.NetworkOnly()
  );

  workbox.routing.registerRoute(
    /\.(js|css|html)$/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: CACHE_NAME,
    })
  );
} else {
  console.log('Workbox not available, using basic caching');
}
