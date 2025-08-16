/**
 * Manual Clock Override Component
 * Allows manual clock in/out with location override for special circumstances
 */

import { useState } from 'react';
import { useOfflineClockIn } from '../hooks/useOfflineClockIn';

export default function ManualClockOverride({ openShift, onSuccess }) {
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { offlineClockIn, offlineClockOut } = useOfflineClockIn();

  const handleManualOverride = async (action) => {
    if (!overrideReason.trim()) {
      alert('Please provide a reason for manual override');
      return;
    }

    setIsSubmitting(true);
    try {
      const note = `Manual override: ${overrideReason}`;
      
      if (action === 'clockIn') {
        await offlineClockIn({
          note,
          lat: 0, // Default coordinates for manual override
          lng: 0,
          manualOverride: true
        });
      } else {
        await offlineClockOut({
          note,
          lat: 0,
          lng: 0,
          manualOverride: true
        });
      }

      setShowOverride(false);
      setOverrideReason('');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Manual override failed:', error);
      alert('Failed to process manual override. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const overrideReasons = [
    'Location services unavailable',
    'Working from remote location',
    'GPS accuracy issues',
    'Emergency situation',
    'Technical difficulties',
    'Supervisor approval'
  ];

  if (!showOverride) {
    return (
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Need to clock {openShift ? 'out' : 'in'} without location?
          </div>
          <button
            onClick={() => setShowOverride(true)}
            className="text-xs px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
          >
            Use Manual Override
          </button>
          <div className="text-xs text-gray-500 mt-1">
            For special circumstances only
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="text-sm font-medium text-orange-800">
          Manual Clock {openShift ? 'Out' : 'In'} Override
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Reason for override (required):
          </label>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Explain why location-based clock in/out is not possible..."
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200"
            rows={2}
          />
        </div>

        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Quick reasons:</div>
          <div className="flex flex-wrap gap-1">
            {overrideReasons.map((reason) => (
              <button
                key={reason}
                onClick={() => setOverrideReason(reason)}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => handleManualOverride(openShift ? 'clockOut' : 'clockIn')}
            disabled={!overrideReason.trim() || isSubmitting}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors ${
              overrideReason.trim() && !isSubmitting
                ? openShift 
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                  <path d="M22 12a10 10 0 0 1-10 10" fill="currentColor"/>
                </svg>
                Processing...
              </span>
            ) : (
              `Manual Clock ${openShift ? 'Out' : 'In'}`
            )}
          </button>
          <button
            onClick={() => {
              setShowOverride(false);
              setOverrideReason('');
            }}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="text-xs text-orange-700 bg-orange-100 p-2 rounded">
          <strong>Note:</strong> Manual overrides are logged and may require supervisor approval. 
          Use only when automatic location-based clock in/out is not possible.
        </div>
      </div>
    </div>
  );
}
