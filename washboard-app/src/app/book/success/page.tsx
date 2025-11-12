'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function BookingSuccessContent() {
  const searchParams = useSearchParams();

  // Extract query params directly
  const bookingId = searchParams.get('booking');
  const positionStr = searchParams.get('position');
  const position = positionStr ? parseInt(positionStr) : null;

  // Handle missing params
  if (!bookingId || !position) {
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Success Icon */}
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

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Booking Confirmed!
          </h1>

          <p className="text-center text-gray-800 mb-8">
            Your car wash booking has been successfully submitted.
          </p>

          {/* Booking Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-700">Booking ID</p>
                <p className="text-lg font-semibold text-gray-900">#{bookingId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-700">Queue Position</p>
                <p className="text-lg font-semibold text-gray-900">
                  {position === 1 ? 'Next in line!' : `#${position} in queue`}
                </p>
              </div>
            </div>
          </div>

          {/* What's Next Section */}
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
                  You&apos;re now in the queue at position {position}.
                  {position === 1 ? ' Head to the car wash now!' : ` There are ${position - 1} vehicles ahead of you.`}
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

          {/* Save Confirmation Message */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Save this page or take a screenshot of your booking ID for reference.
            </p>
          </div>
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
