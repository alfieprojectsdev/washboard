'use client';

import { useState } from 'react';

/**
 * Validate messenger URL to prevent XSS attacks
 * Only allow http: and https: protocols from trusted messenger domains
 */
function isValidMessengerUrl(url: string | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    // Only allow http: and https: protocols (blocks javascript:, data:, etc.)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Whitelist messenger domains for additional security
    const allowedDomains = ['m.me', 'facebook.com', 'fb.me', 'messenger.com'];
    const isAllowedDomain = allowedDomains.some(domain =>
      parsed.hostname.endsWith(domain) || parsed.hostname === domain
    );

    return isAllowedDomain;
  } catch {
    // Invalid URL format
    return false;
  }
}

interface Booking {
  id: number;
  branchCode: string;
  plate: string;
  vehicleMake: string;
  vehicleModel: string;
  customerName: string | null;
  customerMessenger: string | null;
  preferredTime: string | null;
  status: 'queued' | 'in_service' | 'done' | 'cancelled';
  position: number;
  cancelledReason: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedWaitMinutes: number | null;
}

interface BookingsTableProps {
  bookings: Booking[];
  avgServiceMinutes: number;
  onUpdate: (
    bookingId: number,
    updates: {
      status?: string;
      position?: number;
      cancelledReason?: string;
      notes?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
}

const CANCEL_REASONS = [
  'Full queue / No available slots',
  'Under maintenance',
  'Power outage',
  'Water supply issue',
  'Staff shortage',
  'Weather interruption',
  'Closed early',
  'Holiday / Special event',
];

export default function BookingsTable({
  bookings,
  avgServiceMinutes,
  onUpdate,
}: BookingsTableProps) {
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const handleStatusChange = async (bookingId: number, newStatus: string) => {
    setUpdatingIds((prev) => new Set(prev).add(bookingId));

    const result = await onUpdate(bookingId, { status: newStatus });

    if (!result.success) {
      alert(`Failed to update status: ${result.error}`);
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(bookingId);
      return next;
    });
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!cancelReason) {
      alert('Please select a cancellation reason');
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(bookingId));

    const result = await onUpdate(bookingId, {
      status: 'cancelled',
      cancelledReason: cancelReason,
    });

    if (result.success) {
      setCancellingId(null);
      setCancelReason('');
    } else {
      alert(`Failed to cancel booking: ${result.error}`);
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(bookingId);
      return next;
    });
  };

  const handlePositionChange = async (bookingId: number, newPosition: number) => {
    setUpdatingIds((prev) => new Set(prev).add(bookingId));

    const result = await onUpdate(bookingId, { position: newPosition });

    if (!result.success) {
      alert(`Failed to update position: ${result.error}`);
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(bookingId);
      return next;
    });
  };

  const isLastInQueue = (booking: Booking) => {
    const queuedBookings = bookings.filter((b) => b.status === 'queued');
    const lastQueued = queuedBookings[queuedBookings.length - 1];
    return booking.id === lastQueued?.id;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const formatEstimatedWait = (minutes: number | null) => {
    if (minutes === null || minutes === 0) return 'Next';
    if (minutes < 60) return `~${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `~${hours}h ${mins}m`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_service':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-700">No bookings found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Plate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Wait Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{booking.position}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-medium">{booking.vehicleMake}</div>
                  <div className="text-gray-700">{booking.vehicleModel}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {booking.plate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {booking.customerName || '-'}
                  {booking.customerMessenger && isValidMessengerUrl(booking.customerMessenger) ? (
                    <a
                      href={booking.customerMessenger}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:text-blue-800"
                      title="Contact via Messenger"
                    >
                      💬
                    </a>
                  ) : booking.customerMessenger ? (
                    <span className="ml-2 text-gray-600" title="Invalid messenger URL">
                      💬
                    </span>
                  ) : null}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                      booking.status
                    )}`}
                  >
                    {booking.status.replace('_', ' ')}
                  </span>
                  {booking.cancelledReason && (
                    <div className="text-xs text-gray-700 mt-1">
                      {booking.cancelledReason}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {booking.status === 'queued' &&
                    formatEstimatedWait(booking.estimatedWaitMinutes)}
                  {booking.status !== 'queued' && '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {cancellingId === booking.id ? (
                    <div className="space-y-2">
                      <select
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select reason...</option>
                        {CANCEL_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={!cancelReason || updatingIds.has(booking.id)}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => {
                            setCancellingId(null);
                            setCancelReason('');
                          }}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {booking.status === 'queued' && (
                        <>
                          <button
                            onClick={() =>
                              handleStatusChange(booking.id, 'in_service')
                            }
                            disabled={updatingIds.has(booking.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Start
                          </button>
                          <button
                            onClick={() => setCancellingId(booking.id)}
                            disabled={updatingIds.has(booking.id)}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              handlePositionChange(
                                booking.id,
                                booking.position - 1
                              )
                            }
                            disabled={
                              booking.position === 1 ||
                              updatingIds.has(booking.id)
                            }
                            className={`px-3 py-1 text-xs rounded ${
                              booking.position === 1
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            } disabled:opacity-50`}
                            title="Move up in queue"
                          >
                            ↑ Move Up
                          </button>
                          <button
                            onClick={() =>
                              handlePositionChange(
                                booking.id,
                                booking.position + 1
                              )
                            }
                            disabled={
                              isLastInQueue(booking) ||
                              updatingIds.has(booking.id)
                            }
                            className={`px-3 py-1 text-xs rounded ${
                              isLastInQueue(booking)
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            } disabled:opacity-50`}
                            title="Move down in queue"
                          >
                            ↓ Move Down
                          </button>
                        </>
                      )}
                      {booking.status === 'in_service' && (
                        <button
                          onClick={() => handleStatusChange(booking.id, 'done')}
                          disabled={updatingIds.has(booking.id)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Complete
                        </button>
                      )}
                      {updatingIds.has(booking.id) && (
                        <span className="text-xs text-gray-500">Updating...</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
