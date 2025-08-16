/**
 * Automatic Background Location Tracking
 * Runs silently in background using admin-configured work locations
 */

import { offlineStorage } from './offlineStorage';
import backgroundLocation from './backgroundLocation';

class AutoBackgroundTracker {
  constructor() {
    this.isInitialized = false;
    this.workLocations = [];
    this.serviceWorkerRegistration = null;
  }

  async init() {
    if (this.isInitialized) return;

    console.log('Initializing automatic background tracking');

    // Initialize background location manager
    await backgroundLocation.init();

    // Set up service worker
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
      } catch (error) {
        console.error('Service worker not available:', error);
      }
    }

    this.isInitialized = true;
  }

  async setWorkLocations(locations) {
    this.workLocations = locations;
    
    // Use the first active location for background tracking
    const activeLocation = locations.find(loc => loc.isActive) || locations[0];
    
    if (activeLocation) {
      const workLocation = {
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        radiusKm: activeLocation.radiusKm || 0.1, // Default 100m
        name: activeLocation.name || 'Work Location'
      };

      backgroundLocation.setWorkLocation(workLocation);
      console.log('Auto background tracking configured for:', workLocation.name);
    }
  }

  async startAutoTracking() {
    if (!this.isInitialized) {
      await this.init();
    }

    // Request permissions silently
    try {
      await this.requestPermissions();
      
      // Start background tracking automatically
      await backgroundLocation.startBackgroundTracking();
      
      console.log('Automatic background tracking started');
    } catch (error) {
      console.log('Background tracking requires permissions:', error.message);
    }
  }

  async requestPermissions() {
    // Request location permission
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    });

    // Request notification permission
    if ('Notification' in window) {
      await Notification.requestPermission();
    }

    return true;
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isTracking: backgroundLocation.isTracking,
      workLocations: this.workLocations,
      backgroundLocationStatus: backgroundLocation.getStatus()
    };
  }
}

// Export singleton instance
export const autoBackgroundTracker = new AutoBackgroundTracker();
export default autoBackgroundTracker;
