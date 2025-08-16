/**
 * Custom hook for offline-capable clock in/out functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { CLOCK_IN, CLOCK_OUT } from '@/graphql/operations';
import { offlineStorage } from '@/lib/offlineStorage';
import { networkStatus } from '@/lib/networkStatus';
import { offlineSync } from '@/lib/offlineSync';

export function useOfflineClockIn() {
  const [isOffline, setIsOffline] = useState(!networkStatus.isOnline);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error

  // Apollo mutations for online operations
  const [clockInMutation] = useMutation(CLOCK_IN);
  const [clockOutMutation] = useMutation(CLOCK_OUT);

  // Update network status
  useEffect(() => {
    const unsubscribe = networkStatus.addListener((status, statusInfo) => {
      setIsOffline(status === 'offline');
    });

    return unsubscribe;
  }, []);

  // Update pending sync count
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await offlineSync.getPendingSyncCount();
      setPendingSyncCount(count);
    };

    updatePendingCount();

    // Listen for sync events
    const unsubscribe = offlineSync.addSyncListener((event, data) => {
      switch (event) {
        case 'sync_started':
          setSyncStatus('syncing');
          break;
        case 'sync_completed':
          setSyncStatus('success');
          setPendingSyncCount(0);
          setTimeout(() => setSyncStatus('idle'), 3000);
          break;
        case 'sync_failed':
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 5000);
          break;
        case 'action_synced':
          updatePendingCount();
          break;
      }
    });

    return unsubscribe;
  }, []);

  const clockIn = useCallback(async ({ note, lat, lng, manualOverride = false }) => {
    const actionData = {
      type: 'CLOCK_IN',
      data: { 
        note: String(note || ''), 
        lat: Number(lat || 0), 
        lng: Number(lng || 0), 
        manualOverride: Boolean(manualOverride) 
      },
      timestamp: new Date().toISOString()
    };

    if (isOffline || !networkStatus.isOnline) {
      // Store offline
      console.log('Storing clock in action offline');
      await offlineStorage.addOfflineAction(actionData);
      setPendingSyncCount(prev => prev + 1);
      
      // Show success message for offline storage
      return {
        data: {
          clockIn: {
            id: `offline_${Date.now()}`,
            clockInAt: actionData.timestamp
          }
        },
        offline: true
      };
    } else {
      // Execute online
      try {
        const result = await clockInMutation({
          variables: { note, lat, lng, manualOverride }
        });
        return { ...result, offline: false };
      } catch (error) {
        // If online request fails, store offline as fallback
        console.log('Online clock in failed, storing offline:', error);
        await offlineStorage.addOfflineAction(actionData);
        setPendingSyncCount(prev => prev + 1);
        
        return {
          data: {
            clockIn: {
              id: `offline_${Date.now()}`,
              clockInAt: actionData.timestamp
            }
          },
          offline: true,
          fallback: true
        };
      }
    }
  }, [isOffline, clockInMutation]);

  const clockOut = useCallback(async ({ note = '', lat = 0, lng = 0, manualOverride = false } = {}) => {
    const actionData = {
      type: 'CLOCK_OUT',
      data: { 
        note: String(note || ''), 
        lat: Number(lat || 0), 
        lng: Number(lng || 0), 
        manualOverride: Boolean(manualOverride) 
      },
      timestamp: new Date().toISOString()
    };

    if (isOffline || !networkStatus.isOnline) {
      // Store offline
      console.log('Storing clock out action offline');
      await offlineStorage.addOfflineAction(actionData);
      setPendingSyncCount(prev => prev + 1);
      
      return {
        data: {
          clockOut: {
            id: `offline_${Date.now()}`,
            clockOutAt: actionData.timestamp
          }
        },
        offline: true,
        success: true
      };
    } else {
      // Execute online
      try {
        const result = await clockOutMutation({
          variables: { 
            note: note || '', 
            lat: lat || 0, 
            lng: lng || 0, 
            manualOverride: manualOverride || false 
          }
        });
        return { ...result, offline: false, success: true };
      } catch (error) {
        // If online request fails, store offline as fallback
        console.log('Online clock out failed, storing offline:', error.message);
        await offlineStorage.addOfflineAction(actionData);
        setPendingSyncCount(prev => prev + 1);
        
        return {
          data: {
            clockOut: {
              id: `offline_${Date.now()}`,
              clockOutAt: actionData.timestamp
            }
          },
          offline: true,
          fallback: true,
          success: true
        };
      }
    }
  }, [isOffline, clockOutMutation]);

  const forceSync = useCallback(async () => {
    if (networkStatus.isOnline) {
      await offlineSync.forceSync();
    }
  }, []);

  return {
    clockIn,
    clockOut,
    forceSync,
    isOffline,
    pendingSyncCount,
    syncStatus,
    loading: syncStatus === 'syncing'
  };
}
