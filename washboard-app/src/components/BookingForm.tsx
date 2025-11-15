'use client';

import { useState, FormEvent } from 'react';
import { trackEvent } from '@/components/GoatCounterAnalytics';

interface BookingFormProps {
  branchCode: string;
  token: string;
  initialData?: {
    customerName?: string;
    customerMessenger?: string;
  };
  onSuccess: (bookingId: number, position: number) => void;
}

export default function BookingForm({ token, initialData, onSuccess }: BookingFormProps) {
  const [formData, setFormData] = useState({
    plate: '',
    vehicleMake: '',
    vehicleModel: '',
    customerName: initialData?.customerName || '',
    customerMessenger: initialData?.customerMessenger || '',
    preferredTime: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.plate.trim()) {
      newErrors.plate = 'License plate is required';
    }
    if (!formData.vehicleMake.trim()) {
      newErrors.vehicleMake = 'Vehicle make is required';
    }
    if (!formData.vehicleModel.trim()) {
      newErrors.vehicleModel = 'Vehicle model is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/bookings/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          plate: formData.plate.trim(),
          vehicleMake: formData.vehicleMake.trim(),
          vehicleModel: formData.vehicleModel.trim(),
          customerName: formData.customerName.trim() || undefined,
          customerMessenger: formData.customerMessenger.trim() || undefined,
          preferredTime: formData.preferredTime || undefined,
          notes: formData.notes.trim() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit booking');
      }

      // Track successful booking submission
      trackEvent('booking-submitted', {
        hasCustomerName: !!formData.customerName.trim(),
        hasMessenger: !!formData.customerMessenger.trim(),
        hasPreferredTime: !!formData.preferredTime,
        hasNotes: !!formData.notes.trim(),
      });

      onSuccess(data.booking.id, data.booking.position);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Vehicle Information Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Vehicle Information</h2>

        {/* License Plate */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            License Plate <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.plate}
            onChange={(e) => handleChange('plate', e.target.value)}
            onBlur={validate}
            placeholder="ABC-1234"
            maxLength={20}
            className={`w-full px-3 py-2 border rounded-md text-gray-900 placeholder-gray-500 ${
              errors.plate ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.plate && <p className="text-red-500 text-sm mt-1">{errors.plate}</p>}
        </div>

        {/* Vehicle Make */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Vehicle Make <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.vehicleMake}
            onChange={(e) => handleChange('vehicleMake', e.target.value)}
            onBlur={validate}
            placeholder="Toyota"
            maxLength={50}
            className={`w-full px-3 py-2 border rounded-md text-gray-900 placeholder-gray-500 ${
              errors.vehicleMake ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.vehicleMake && <p className="text-red-500 text-sm mt-1">{errors.vehicleMake}</p>}
        </div>

        {/* Vehicle Model */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Vehicle Model <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.vehicleModel}
            onChange={(e) => handleChange('vehicleModel', e.target.value)}
            onBlur={validate}
            placeholder="Camry"
            maxLength={50}
            className={`w-full px-3 py-2 border rounded-md text-gray-900 placeholder-gray-500 ${
              errors.vehicleModel ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.vehicleModel && <p className="text-red-500 text-sm mt-1">{errors.vehicleModel}</p>}
        </div>
      </div>

      {/* Customer Information Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Information (Optional)</h2>

        {/* Customer Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Name
          </label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => handleChange('customerName', e.target.value)}
            placeholder="Your Name"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 text-gray-900 placeholder-gray-500 rounded-md"
          />
        </div>

        {/* Messenger Handle */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Messenger Handle
          </label>
          <input
            type="text"
            value={formData.customerMessenger}
            onChange={(e) => handleChange('customerMessenger', e.target.value)}
            placeholder="m.me/yourname or Facebook link"
            maxLength={255}
            className="w-full px-3 py-2 border border-gray-300 text-gray-900 placeholder-gray-500 rounded-md"
          />
          <p className="text-xs text-gray-700 mt-1">
            We&apos;ll contact you via Messenger when your turn is coming
          </p>
        </div>

        {/* Preferred Time */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Preferred Arrival Time
          </label>
          <input
            type="datetime-local"
            value={formData.preferredTime}
            onChange={(e) => handleChange('preferredTime', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 text-gray-900 placeholder-gray-500 rounded-md"
          />
          <p className="text-xs text-gray-700 mt-1">
            Optional - when you&apos;d like to arrive
          </p>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Any special requests or notes"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 text-gray-900 placeholder-gray-500 rounded-md"
          />
        </div>
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {submitError}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 px-4 rounded-md font-semibold text-white ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? 'Submitting...' : 'Submit Booking'}
      </button>

      <p className="text-xs text-gray-700 text-center">
        * Required fields
      </p>
    </form>
  );
}
