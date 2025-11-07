'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BookingsTable from './BookingsTable';
import ShopStatusToggle from './ShopStatusToggle';

interface User {
  userId: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  branchCode: string;
}

interface Branch {
  branchCode: string;
  branchName: string;
  location: string | null;
  avgServiceMinutes: number;
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
  cancelledBy: number | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedWaitMinutes: number | null;
}

interface ShopStatus {
  isOpen: boolean;
  reason: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

interface DashboardClientProps {
  user: User;
  branch: Branch;
}

export default function DashboardClient({ user, branch }: DashboardClientProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shopStatus, setShopStatus] = useState<ShopStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('queued');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch bookings
  const fetchBookings = async (status: string = statusFilter) => {
    try {
      const response = await fetch(`/api/bookings?status=${status}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setBookings(data.bookings);
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch bookings');
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError('Network error while fetching bookings');
    }
  };

  // Fetch shop status
  const fetchShopStatus = async () => {
    try {
      const response = await fetch(`/api/shop-status?branchCode=${branch.branchCode}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setShopStatus(data.status);
      }
    } catch (err) {
      console.error('Error fetching shop status:', err);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchBookings(), fetchShopStatus()]);
      setLoading(false);
    };

    loadData();
  }, []);

  // Polling for real-time updates (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBookings();
      fetchShopStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [statusFilter]);

  // Update booking status
  const handleUpdateBooking = async (
    bookingId: number,
    updates: {
      status?: string;
      position?: number;
      cancelledReason?: string;
      notes?: string;
    }
  ) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh bookings after update
        await fetchBookings();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Error updating booking:', err);
      return { success: false, error: 'Network error' };
    }
  };

  // Update shop status
  const handleUpdateShopStatus = async (isOpen: boolean, reason?: string) => {
    try {
      const response = await fetch('/api/shop-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen, reason }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShopStatus(data.status);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Error updating shop status:', err);
      return { success: false, error: 'Network error' };
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🧼 Washboard Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {branch.branchName} • {user.name} ({user.role})
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard/magic-links')}
                className="px-4 py-2 text-sm text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-md transition font-medium"
              >
                🔗 Magic Links
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Shop Status Control */}
        <div className="mb-6">
          <ShopStatusToggle
            shopStatus={shopStatus}
            onUpdate={handleUpdateShopStatus}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['queued', 'in_service', 'done', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    fetchBookings(status);
                  }}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition
                    ${
                      statusFilter === status
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  {statusFilter === status && ` (${bookings.length})`}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Last Update Indicator */}
        <div className="mb-4 text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()} • Auto-refreshes every 10s
        </div>

        {/* Bookings Table */}
        <BookingsTable
          bookings={bookings}
          avgServiceMinutes={branch.avgServiceMinutes}
          onUpdate={handleUpdateBooking}
        />
      </main>
    </div>
  );
}
