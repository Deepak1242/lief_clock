/**
 * React Hook for Background Location Tracking
 * Manages geofencing and automatic clock in/out
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import backgroundLocation from '../lib/backgroundLocation';

export function useBackgroundLocation() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState({
    isTracking: false,
    hasWorkLocation: false,
    lastKnownPosition: null,
    lastStatus: null,
    notificationPermission: 'default'
  });
  const [error, setError] = useState(null);
  const { dbUser } = useAuth();

  // Initialize background location manager
  useEffect(() => {
    const initBackgroundLocation = async () => {
      try {
        await backgroundLocation.init();
        updateStatus();
      } catch (err) {
        console.error('Failed to initialize background location:', err);
        setError(err.message);
      }
    };

    if (dbUser) {
      initBackgroundLocation();
    }
  }, [dbUser]);

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const updateStatus = useCallback(() => {
    const currentStatus = backgroundLocation.getStatus();
    setStatus(currentStatus);
    setIsEnabled(currentStatus.isTracking);
  }, []);

  const enableBackgroundTracking = useCallback(async (workLocation) => {
    try {
      setError(null);

      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      // Request location permission
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      console.log('Location permission granted');

      // Set work location
      backgroundLocation.setWorkLocation(workLocation);

      // Request notification permission
      const notificationGranted = await backgroundLocation.requestNotificationPermission();
      
      if (!notificationGranted) {
        console.warn('Notification permission denied - notifications will not work');
      }

      // Start background tracking
      await backgroundLocation.startBackgroundTracking();
      
      setIsEnabled(true);
      updateStatus();

      return true;
    } catch (err) {
      console.error('Failed to enable background tracking:', err);
      setError(err.message);
      return false;
    }
  }, [updateStatus]);

  const disableBackgroundTracking = useCallback(() => {
    try {
      backgroundLocation.stopBackgroundTracking();
      setIsEnabled(false);
      updateStatus();
      setError(null);
    } catch (err) {
      console.error('Failed to disable background tracking:', err);
      setError(err.message);
    }
  }, [updateStatus]);

  const checkLocationPermission = useCallback(async () => {
    if (!navigator.permissions) {
      return 'unsupported';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state; // 'granted', 'denied', or 'prompt'
    } catch (err) {
      console.error('Failed to check location permission:', err);
      return 'error';
    }
  }, []);

  const checkNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return 'unsupported';
    }

    return Notification.permission; // 'granted', 'denied', or 'default'
  }, []);

  const requestPermissions = useCallback(async () => {
    const results = {
      location: 'denied',
      notification: 'denied'
    };

    try {
      // Request location permission
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });
      results.location = 'granted';
    } catch (err) {
      console.error('Location permission denied:', err);
    }

    try {
      // Request notification permission
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        results.notification = permission;
      }
    } catch (err) {
      console.error('Notification permission error:', err);
    }

    return results;
  }, []);

  const getCurrentPosition = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }, []);

  return {
    isEnabled,
    status,
    error,
    enableBackgroundTracking,
    disableBackgroundTracking,
    checkLocationPermission,
    checkNotificationPermission,
    requestPermissions,
    getCurrentPosition,
    updateStatus
  };
}
