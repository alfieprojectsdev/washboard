'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface QueueStatus {
  status: 'queued' | 'in_service' | 'done' | 'cancelled';
  position: number | null;
  inService: boolean;
  completed?: boolean;
  cancelled?: boolean;
  estimatedWaitMinutes?: number;
  queuedAt?: string;
}

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPosition, setLastPosition] = useState<number | null>(null);

  // Extract query params directly
  const bookingId = searchParams.get('booking');
  const positionStr = searchParams.get('position');
  const initialPosition = positionStr ? parseInt(positionStr) : null;

  useEffect(() => {
    if (!bookingId || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}/status`);
        if (response.ok) {
          const data = await response.json();
          setQueueStatus(data);
          setError(null);

          if (data.completed || data.cancelled || data.inService) {
            setIsPolling(false);
          }

          if (data.position && data.position !== lastPosition) {
            if (lastPosition && data.position < lastPosition && lastPosition - data.position >= 2) {
              console.log(`Great! You moved up ${lastPosition - data.position} spots in the queue!`);
            }
            if (data.position === 1) {
              console.log("You're next in line!");
            }
            setLastPosition(data.position);
          }
        } else if (response.status === 404) {
          setError('Booking not found');
          setIsPolling(false);
        } else {
          console.error('Failed to fetch queue status:', response.statusText);
        }
      } catch (err) {
        console.error('Network error while polling:', err);
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [bookingId, isPolling, lastPosition]);

  // Handle missing params
  if (!bookingId || !initialPosition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h1>
          <p className="text-gray-900">
            This page requires booking information. Please submit a booking first.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-900">{error}</p>
        </div>
      </div>
    );
  }

  const currentPosition = queueStatus?.position ?? initialPosition;

  const renderStatusContent = () => {
    if (!queueStatus) {
      return (
        <>
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 rounded-full p-4">
              <svg
                className="w-16 h-16 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Booking Confirmed!
          </h1>

          <p className="text-center text-gray-800 mb-8">
            Your car wash booking has been successfully submitted.
          </p>
        </>
      );
    }

    switch (queueStatus.status) {
      case 'queued':
        return (
          <>
            <div className="flex justify-center mb-6">
              <div className="bg-blue-100 rounded-full p-4">
                <svg
                  className="w-16 h-16 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
              You're in the Queue
            </h1>

            <p className="text-center text-gray-800 mb-8">
              Your position is being updated in real-time.
            </p>

            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-700">Booking ID</p>
                  <p className="text-lg font-semibold text-gray-900">#{bookingId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">Queue Position</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {currentPosition === 1 ? 'Next in line!' : `#${currentPosition}`}
                  </p>
                </div>
              </div>
              {queueStatus.estimatedWaitMinutes !== undefined && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <p className="text-sm text-gray-700">Estimated Wait Time</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ~{queueStatus.estimatedWaitMinutes} minutes
                  </p>
                </div>
              )}
            </div>

            {isPolling && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-8">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="4" stroke="currentColor" fill="none" />
                </svg>
                <span>Auto-updating every 10 seconds</span>
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
            )}
          </>
        );

      case 'in_service':
        return (
          <>
            <div className="flex justify-center mb-6">
              <div className="bg-yellow-100 rounded-full p-4">
                <svg
                  className="w-16 h-16 text-yellow-600 animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
              Your Turn!
            </h1>

            <p className="text-center text-gray-800 mb-8">
              Please proceed to the wash area now.
            </p>

            <div className="bg-yellow-50 rounded-lg p-6 mb-8">
              <div className="text-center">
                <p className="text-lg font-semibold text-yellow-700">
                  Your vehicle is now being serviced
                </p>
              </div>
            </div>
          </>
        );

      case 'done':
        return (
          <>
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 rounded-full p-4">
                <svg
                  className="w-16 h-16 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
              Service Complete!
            </h1>

            <p className="text-center text-gray-800 mb-8">
              Thank you for using our service.
            </p>

            <div className="bg-green-50 rounded-lg p-6 mb-8">
              <div className="text-center">
                <p className="text-lg font-semibold text-green-700">
                  Your car wash has been completed
                </p>
              </div>
            </div>
          </>
        );

      case 'cancelled':
        return (
          <>
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 rounded-full p-4">
                <svg
                  className="w-16 h-16 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
              Booking Cancelled
            </h1>

            <p className="text-center text-gray-800 mb-8">
              Your booking has been cancelled by the receptionist.
            </p>

            <div className="bg-red-50 rounded-lg p-6 mb-8">
              <div className="text-center">
                <p className="text-lg font-semibold text-red-700">
                  Please contact the receptionist for assistance
                </p>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {renderStatusContent()}

          {(!queueStatus || queueStatus.status === 'queued') && (
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                What Happens Next?
              </h2>

              <ul className="space-y-3 text-gray-900">
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    You&apos;re now in the queue at position {currentPosition}.
                    {currentPosition === 1 ? ' Head to the car wash now!' : ` There are ${currentPosition - 1} vehicles ahead of you.`}
                  </span>
                </li>

                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span>
                    If you provided a Messenger handle, we&apos;ll notify you when your turn is approaching.
                  </span>
                </li>

                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    Please arrive on time for your scheduled wash. The receptionist will guide you from there.
                  </span>
                </li>
              </ul>
            </div>
          )}

          {(!queueStatus || queueStatus.status === 'queued') && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Save this page or take a screenshot of your booking ID for reference.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-900">Loading...</div></div>}>
      <BookingSuccessContent />
    </Suspense>
  );
}
