/**
 * Background Location Settings Component
 * UI for managing automatic clock in/out based on location
 */

import { useState, useEffect } from 'react';
import { useBackgroundLocation } from '../hooks/useBackgroundLocation';
import { useAuth } from '../contexts/AuthContext';

export default function BackgroundLocationSettings({ workLocation, onWorkLocationChange }) {
  const { dbUser } = useAuth();
  const {
    isEnabled,
    status,
    error,
    enableBackgroundTracking,
    disableBackgroundTracking,
    checkLocationPermission,
    checkNotificationPermission,
    requestPermissions,
    getCurrentPosition
  } = useBackgroundLocation();

  const [permissions, setPermissions] = useState({
    location: 'unknown',
    notification: 'unknown'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      const locationPerm = await checkLocationPermission();
      const notificationPerm = await checkNotificationPermission();
      
      setPermissions({
        location: locationPerm,
        notification: notificationPerm
      });
    };

    checkPermissions();
  }, [checkLocationPermission, checkNotificationPermission]);

  const handleEnableTracking = async () => {
    if (!workLocation) {
      setShowSetup(true);
      return;
    }

    setIsLoading(true);
    try {
      const success = await enableBackgroundTracking(workLocation);
      if (success) {
        console.log('Background tracking enabled successfully');
      }
    } catch (err) {
      console.error('Failed to enable tracking:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableTracking = () => {
    disableBackgroundTracking();
  };

  const handleRequestPermissions = async () => {
    setIsLoading(true);
    try {
      const results = await requestPermissions();
      setPermissions(results);
    } catch (err) {
      console.error('Failed to request permissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const position = await getCurrentPosition();
      setCurrentLocation(position);
    } catch (err) {
      console.error('Failed to get current location:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetWorkLocation = () => {
    if (currentLocation && onWorkLocationChange) {
      const newWorkLocation = {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        radiusKm: 0.1, // 100 meters default
        name: 'Work Location'
      };
      onWorkLocationChange(newWorkLocation);
      setShowSetup(false);
    }
  };

  const getPermissionIcon = (permission) => {
    switch (permission) {
      case 'granted':
        return '✅';
      case 'denied':
        return '❌';
      case 'prompt':
      case 'default':
        return '⚠️';
      default:
        return '❓';
    }
  };

  const getPermissionText = (permission) => {
    switch (permission) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Denied';
      case 'prompt':
      case 'default':
        return 'Not requested';
      case 'unsupported':
        return 'Not supported';
      default:
        return 'Unknown';
    }
  };

  if (!dbUser) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Auto Clock In/Out
        </h3>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isEnabled 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Automatically clock in when you enter the work area and clock out when you leave, 
        even when the app is closed or minimized.
      </p>

      {/* Permission Status */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Permissions</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Location Access:</span>
            <span className="flex items-center gap-1">
              {getPermissionIcon(permissions.location)}
              {getPermissionText(permissions.location)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Notifications:</span>
            <span className="flex items-center gap-1">
              {getPermissionIcon(permissions.notification)}
              {getPermissionText(permissions.notification)}
            </span>
          </div>
        </div>
      </div>

      {/* Status Information */}
      {status.isTracking && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Tracking Status</h4>
          <div className="space-y-1 text-sm text-blue-700">
            <div>Status: {status.lastStatus || 'Monitoring'}</div>
            {status.lastKnownPosition && (
              <div>
                Last Position: {status.lastKnownPosition.lat.toFixed(6)}, {status.lastKnownPosition.lng.toFixed(6)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Work Location Setup */}
      {showSetup && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-900 mb-2">Set Work Location</h4>
          <p className="text-sm text-yellow-700 mb-3">
            First, we need to set your work location for automatic clock in/out.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleGetCurrentLocation}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isLoading ? 'Getting Location...' : 'Use Current Location'}
            </button>

            {currentLocation && (
              <div className="p-3 bg-white border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Current Location:</div>
                <div className="text-xs font-mono text-gray-800">
                  {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Accuracy: ±{Math.round(currentLocation.accuracy)}m
                </div>
                
                <button
                  onClick={handleSetWorkLocation}
                  className="mt-2 w-full px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                >
                  Set as Work Location
                </button>
              </div>
            )}

            <button
              onClick={() => setShowSetup(false)}
              className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Work Location Display */}
      {workLocation && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg">
          <h4 className="text-sm font-medium text-green-900 mb-2">Work Location</h4>
          <div className="text-sm text-green-700">
            <div>{workLocation.name || 'Work Location'}</div>
            <div className="text-xs font-mono">
              {workLocation.latitude.toFixed(6)}, {workLocation.longitude.toFixed(6)}
            </div>
            <div className="text-xs">
              Radius: {(workLocation.radiusKm * 1000).toFixed(0)}m
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {permissions.location !== 'granted' || permissions.notification !== 'granted' ? (
          <button
            onClick={handleRequestPermissions}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Requesting...' : 'Grant Permissions'}
          </button>
        ) : !isEnabled ? (
          <button
            onClick={handleEnableTracking}
            disabled={isLoading || !workLocation}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Enabling...' : 'Enable Auto Clock In/Out'}
          </button>
        ) : (
          <button
            onClick={handleDisableTracking}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            Disable Auto Clock In/Out
          </button>
        )}

        {!workLocation && (
          <button
            onClick={() => setShowSetup(true)}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
          >
            Set Work Location
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-1">How it works:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Location tracking continues when app is closed/minimized</li>
          <li>• Automatically clocks in when you enter work area</li>
          <li>• Automatically clocks out when you leave work area</li>
          <li>• Notifications keep you informed of clock events</li>
          <li>• Data syncs automatically when you return online</li>
        </ul>
      </div>
    </div>
  );
}
