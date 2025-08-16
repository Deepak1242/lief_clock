/**
 * Network Status Manager
 * Handles online/offline detection and network state management
 */

class NetworkStatusManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.lastOnlineTime = this.isOnline ? Date.now() : null;
    this.lastOfflineTime = this.isOnline ? null : Date.now();
    
    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Additional network checks for more reliable detection
    this.startPeriodicCheck();
  }

  handleOnline() {
    console.log('Network: Back online');
    this.isOnline = true;
    this.lastOnlineTime = Date.now();
    this.notifyListeners('online');
  }

  handleOffline() {
    console.log('Network: Gone offline');
    this.isOnline = false;
    this.lastOfflineTime = Date.now();
    this.notifyListeners('offline');
  }

  startPeriodicCheck() {
    // Check network status every 30 seconds
    setInterval(async () => {
      const actuallyOnline = await this.checkNetworkConnectivity();
      
      if (actuallyOnline !== this.isOnline) {
        if (actuallyOnline) {
          this.handleOnline();
        } else {
          this.handleOffline();
        }
      }
    }, 30000);
  }

  async checkNetworkConnectivity() {
    if (!navigator.onLine) {
      return false;
    }

    try {
      // Try to fetch a small resource to verify actual connectivity
      const response = await fetch('/api/health-check', {
        method: 'HEAD',
        cache: 'no-cache',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      // If our API is down, try a more basic check
      try {
        const response = await fetch('/', {
          method: 'HEAD',
          cache: 'no-cache',
          timeout: 5000
        });
        return response.ok;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status, {
          isOnline: this.isOnline,
          lastOnlineTime: this.lastOnlineTime,
          lastOfflineTime: this.lastOfflineTime
        });
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  getStatus() {
    return {
      isOnline: this.isOnline,
      lastOnlineTime: this.lastOnlineTime,
      lastOfflineTime: this.lastOfflineTime,
      offlineDuration: this.isOnline ? 0 : (Date.now() - this.lastOfflineTime)
    };
  }

  async waitForOnline(timeout = 30000) {
    if (this.isOnline) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error('Timeout waiting for network connection'));
      }, timeout);

      const unsubscribe = this.addListener((status) => {
        if (status === 'online') {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve();
        }
      });
    });
  }
}

// Export singleton instance
export const networkStatus = new NetworkStatusManager();
export default networkStatus;
