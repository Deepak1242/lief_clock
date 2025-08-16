/**
 * Background Location Tracking Manager
 * Handles geofencing and automatic clock in/out when app is closed
 */

import { offlineStorage } from './offlineStorage';

class BackgroundLocationManager {
  constructor() {
    this.isTracking = false;
    this.workLocation = null;
    this.lastKnownPosition = null;
    this.lastStatus = null; // 'inside' | 'outside'
    this.watchId = null;
    this.notificationPermission = 'default';
    this.serviceWorkerRegistration = null;
  }

  async init() {
    // Check if service worker is available
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
        console.log('Background location: Service worker ready');
      } catch (error) {
        console.error('Background location: Service worker not available:', error);
      }
    }

    // Request notification permission
    await this.requestNotificationPermission();

    // Set up visibility change listener for background tracking
    this.setupVisibilityListener();
  }

  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      console.log('Notification permission:', permission);
      return permission === 'granted';
    }
    return false;
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // App is hidden/minimized - start background tracking
        this.startBackgroundTracking();
      } else {
        // App is visible - can use regular tracking
        this.stopBackgroundTracking();
      }
    });

    // Also handle page unload
    window.addEventListener('beforeunload', () => {
      this.startBackgroundTracking();
    });
  }

  setWorkLocation(location) {
    this.workLocation = location;
    console.log('Work location set from admin config:', location);
  }

  async startBackgroundTracking() {
    if (!this.workLocation || this.isTracking) return;

    console.log('Starting background location tracking');
    this.isTracking = true;

    // Use high accuracy for background tracking
    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 10000
    };

    try {
      // Get initial position
      const position = await this.getCurrentPosition(options);
      this.lastKnownPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: Date.now()
      };

      // Start watching position
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handleLocationError(error),
        options
      );

      // Register background sync if service worker is available
      if (this.serviceWorkerRegistration) {
        await this.registerBackgroundSync();
      }

    } catch (error) {
      console.error('Failed to start background tracking:', error);
      this.isTracking = false;
    }
  }

  stopBackgroundTracking() {
    if (!this.isTracking) return;

    console.log('Stopping background location tracking');
    
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isTracking = false;
  }

  async handlePositionUpdate(position) {
    const currentPos = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: Date.now()
    };

    this.lastKnownPosition = currentPos;

    if (!this.workLocation) return;

    // Calculate distance from work location
    const distance = this.calculateDistance(
      currentPos.lat,
      currentPos.lng,
      this.workLocation.latitude,
      this.workLocation.longitude
    );

    const isInside = distance <= (this.workLocation.radiusKm + 0.05); // Small buffer
    const currentStatus = isInside ? 'inside' : 'outside';

    // Check if status changed
    if (this.lastStatus !== currentStatus) {
      console.log(`Location status changed: ${this.lastStatus} -> ${currentStatus}`);
      
      if (currentStatus === 'inside' && this.lastStatus === 'outside') {
        // Entered work area - auto clock in
        await this.handleAutoClockIn(currentPos, distance);
      } else if (currentStatus === 'outside' && this.lastStatus === 'inside') {
        // Left work area - auto clock out
        await this.handleAutoClockOut(currentPos, distance);
      }

      this.lastStatus = currentStatus;
    }
  }

  async handleAutoClockIn(position, distance) {
    console.log('Auto clock-in triggered by background location');

    const clockInData = {
      type: 'CLOCK_IN',
      data: {
        note: `Auto clock-in (background, ${distance.toFixed(2)}km from work)`,
        lat: position.lat,
        lng: position.lng,
        manualOverride: false,
        background: true
      },
      timestamp: new Date().toISOString()
    };

    // Store the action offline
    try {
      await offlineStorage.addOfflineAction(clockInData);
      
      // Show notification
      await this.showNotification(
        'Clocked In',
        'You have been automatically clocked in as you entered the work area.',
        'clock-in'
      );

      // Trigger background sync if available
      if (this.serviceWorkerRegistration) {
        await this.triggerBackgroundSync();
      }

    } catch (error) {
      console.error('Failed to handle auto clock-in:', error);
    }
  }

  async handleAutoClockOut(position, distance) {
    console.log('Auto clock-out triggered by background location');

    const clockOutData = {
      type: 'CLOCK_OUT',
      data: {
        note: `Auto clock-out (background, ${distance.toFixed(2)}km from work)`,
        lat: position.lat,
        lng: position.lng,
        manualOverride: false,
        background: true
      },
      timestamp: new Date().toISOString()
    };

    // Store the action offline
    try {
      await offlineStorage.addOfflineAction(clockOutData);
      
      // Show notification
      await this.showNotification(
        'Clocked Out',
        'You have been automatically clocked out as you left the work area.',
        'clock-out'
      );

      // Trigger background sync if available
      if (this.serviceWorkerRegistration) {
        await this.triggerBackgroundSync();
      }

    } catch (error) {
      console.error('Failed to handle auto clock-out:', error);
    }
  }

  async showNotification(title, body, tag) {
    if (this.notificationPermission !== 'granted') return;

    try {
      // Use service worker notification for better persistence
      if (this.serviceWorkerRegistration) {
        await this.serviceWorkerRegistration.showNotification(title, {
          body,
          tag,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'View Dashboard'
            }
          ]
        });
      } else {
        // Fallback to regular notification
        new Notification(title, {
          body,
          tag,
          icon: '/icons/icon-192.png'
        });
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  async registerBackgroundSync() {
    if (!this.serviceWorkerRegistration || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.log('Background sync not supported');
      return;
    }

    try {
      await this.serviceWorkerRegistration.sync.register('background-location-sync');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Failed to register background sync:', error);
    }
  }

  async triggerBackgroundSync() {
    if (!this.serviceWorkerRegistration) return;

    try {
      await this.serviceWorkerRegistration.sync.register('location-action-sync');
      console.log('Background sync triggered');
    } catch (error) {
      console.error('Failed to trigger background sync:', error);
    }
  }

  getCurrentPosition(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI/180);
  }

  handleLocationError(error) {
    console.error('Background location error:', error);
    
    switch(error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location access denied');
        break;
      case error.POSITION_UNAVAILABLE:
        console.error('Location information unavailable');
        break;
      case error.TIMEOUT:
        console.error('Location request timeout');
        break;
    }
  }

  getStatus() {
    return {
      isTracking: this.isTracking,
      hasWorkLocation: !!this.workLocation,
      lastKnownPosition: this.lastKnownPosition,
      lastStatus: this.lastStatus,
      notificationPermission: this.notificationPermission
    };
  }
}

// Export singleton instance
export const backgroundLocation = new BackgroundLocationManager();
export default backgroundLocation;
