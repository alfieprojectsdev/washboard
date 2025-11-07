'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BookingForm from '@/components/BookingForm';

interface ValidationResult {
  valid: boolean;
  error?: 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED';
  link?: {
    branchCode: string;
    customerName?: string;
    customerMessenger?: string;
  };
}

export default function BookingPage() {
  const params = useParams();
  const token = params.token as string;
  const branchCode = params.branchCode as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const handleSuccess = (bookingId: number, position: number) => {
    // Navigate to success page with booking info
    router.push(`/book/success?booking=${bookingId}&position=${position}`);
  };

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch('/api/magic-links/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        setValidation(data.data);
      } catch (error) {
        console.error('Validation error:', error);
        setValidation({ valid: false, error: 'NOT_FOUND' });
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Validating your booking link...</p>
        </div>
      </div>
    );
  }

  // Invalid token states
  if (!validation?.valid) {
    const errorMessages = {
      NOT_FOUND: 'This link is invalid or does not exist.',
      EXPIRED: 'This link has expired. Please request a new one from the car wash.',
      ALREADY_USED: 'This link has already been used.',
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h1>
          <p className="text-gray-700">
            {errorMessages[validation?.error || 'NOT_FOUND']}
          </p>
        </div>
      </div>
    );
  }

  // Valid token - show booking form placeholder
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Car Wash Booking</h1>
          <p className="text-gray-600 mb-6">Branch: {validation.link?.branchCode}</p>

          <BookingForm
            branchCode={branchCode}
            token={token}
            initialData={{
              customerName: validation.link?.customerName,
              customerMessenger: validation.link?.customerMessenger
            }}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </div>
  );
}
