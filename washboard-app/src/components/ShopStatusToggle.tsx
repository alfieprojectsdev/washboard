'use client';

import { useState } from 'react';

interface ShopStatus {
  isOpen: boolean;
  reason: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

interface ShopStatusToggleProps {
  shopStatus: ShopStatus | null;
  onUpdate: (
    isOpen: boolean,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
}

const CLOSURE_REASONS = [
  'Full queue / No available slots',
  'Under maintenance',
  'Power outage',
  'Water supply issue',
  'Staff shortage',
  'Weather interruption',
  'Closed early',
  'Holiday / Special event',
];

export default function ShopStatusToggle({
  shopStatus,
  onUpdate,
}: ShopStatusToggleProps) {
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = () => {
    if (!shopStatus) return;

    if (shopStatus.isOpen) {
      // Closing - show reason modal
      setShowReasonModal(true);
    } else {
      // Reopening - no reason needed
      handleUpdateStatus(true);
    }
  };

  const handleUpdateStatus = async (isOpen: boolean, reason?: string) => {
    setIsUpdating(true);

    const result = await onUpdate(isOpen, reason);

    if (!result.success) {
      alert(`Failed to update shop status: ${result.error}`);
    }

    setIsUpdating(false);
    setShowReasonModal(false);
    setSelectedReason('');
  };

  const handleCloseShop = () => {
    if (!selectedReason) {
      alert('Please select a closure reason');
      return;
    }

    handleUpdateStatus(false, selectedReason);
  };

  if (!shopStatus) {
    return (
      <div className="bg-gray-100 rounded-lg p-4">
        <p className="text-gray-500">Loading shop status...</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={`rounded-lg border-2 p-6 ${
          shopStatus.isOpen
            ? 'bg-green-50 border-green-500'
            : 'bg-red-50 border-red-500'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  shopStatus.isOpen ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}
              ></div>
              <h2 className="text-xl font-bold text-gray-900">
                {shopStatus.isOpen
                  ? '🟢 Shop Open - Accepting Bookings'
                  : '🔴 Shop Closed - Not Accepting Bookings'}
              </h2>
            </div>

            {!shopStatus.isOpen && shopStatus.reason && (
              <div className="mt-3 ml-7">
                <p className="text-sm font-medium text-gray-700">Reason:</p>
                <p className="text-sm text-gray-600">{shopStatus.reason}</p>
              </div>
            )}

            <div className="mt-3 ml-7 text-xs text-gray-500">
              Last updated: {new Date(shopStatus.updatedAt).toLocaleString()}
              {shopStatus.updatedByName && ` by ${shopStatus.updatedByName}`}
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={isUpdating}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition disabled:opacity-50 ${
              shopStatus.isOpen
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isUpdating
              ? 'Updating...'
              : shopStatus.isOpen
              ? 'Close Shop'
              : 'Reopen Shop'}
          </button>
        </div>
      </div>

      {/* Closure Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Close Shop
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please select a reason for closing the shop:
              </p>

              <div className="space-y-2 mb-6">
                {CLOSURE_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="closure-reason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">{reason}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseShop}
                  disabled={!selectedReason || isUpdating}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {isUpdating ? 'Closing...' : 'Confirm Close'}
                </button>
                <button
                  onClick={() => {
                    setShowReasonModal(false);
                    setSelectedReason('');
                  }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
