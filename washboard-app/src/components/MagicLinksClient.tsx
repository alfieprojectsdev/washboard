'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MagicLinkGenerator from './MagicLinkGenerator';
import MagicLinksTable from './MagicLinksTable';

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
}

interface MagicLink {
  id: number;
  branchCode: string;
  token: string;
  customerName: string | null;
  customerMessenger: string | null;
  expiresAt: string;
  usedAt: string | null;
  bookingId: number | null;
  bookingPlate: string | null;
  createdAt: string;
  createdByName: string;
  status: 'active' | 'expired' | 'used';
  bookingUrl: string;
}

interface MagicLinksClientProps {
  user: User;
  branch: Branch;
}

export default function MagicLinksClient({ user, branch }: MagicLinksClientProps) {
  const router = useRouter();
  const [magicLinks, setMagicLinks] = useState<MagicLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch magic links
  const fetchMagicLinks = async (status: string = statusFilter) => {
    try {
      const response = await fetch(`/api/magic-links/list?status=${status}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setMagicLinks(data.magicLinks);
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch magic links');
      }
    } catch (err) {
      console.error('Error fetching magic links:', err);
      setError('Network error while fetching magic links');
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(false);
      await fetchMagicLinks();
      setLoading(false);
    };

    loadData();
  }, []);

  // Polling for real-time updates (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMagicLinks();
    }, 30000);

    return () => clearInterval(interval);
  }, [statusFilter]);

  // Handle new link generated
  const handleLinkGenerated = () => {
    // Refresh the list to show the new link
    fetchMagicLinks();
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading magic links...</p>
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
                🔗 Magic Links
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {branch.branchName} • {user.name}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
              >
                ← Back to Dashboard
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
        {/* Generator Section */}
        <div className="mb-8">
          <MagicLinkGenerator
            branchCode={branch.branchCode}
            onLinkGenerated={handleLinkGenerated}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['active', 'used', 'expired', 'all'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    fetchMagicLinks(status);
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
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {statusFilter === status && ` (${magicLinks.length})`}
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
          Last updated: {lastUpdate.toLocaleTimeString()} • Auto-refreshes every 30s
        </div>

        {/* Magic Links Table */}
        <MagicLinksTable magicLinks={magicLinks} />
      </main>
    </div>
  );
}
