'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

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

interface MagicLinksTableProps {
  magicLinks: MagicLink[];
}

export default function MagicLinksTable({ magicLinks }: MagicLinksTableProps) {
  const [expandedQR, setExpandedQR] = useState<number | null>(null);
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});

  // Generate QR codes for visible links
  useEffect(() => {
    const generateQRCodes = async () => {
      const codes: Record<number, string> = {};

      for (const link of magicLinks.slice(0, 10)) { // Only generate for first 10
        try {
          const qrDataUrl = await QRCode.toDataURL(link.bookingUrl, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
          codes[link.id] = qrDataUrl;
        } catch (err) {
          console.error('Failed to generate QR code:', err);
        }
      }

      setQrCodes(codes);
    };

    generateQRCodes();
  }, [magicLinks]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800';
      case 'used':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs < 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  if (magicLinks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No magic links found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires / Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {magicLinks.map((link) => (
              <>
                <tr key={link.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">
                        {link.customerName || '(No name)'}
                      </div>
                      {link.customerMessenger && (
                        <a
                          href={link.customerMessenger}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          💬 Messenger
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                        link.status
                      )}`}
                    >
                      {link.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {link.status === 'active' && (
                      <div>
                        <div className="font-medium text-green-600">
                          {formatTimeRemaining(link.expiresAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(link.expiresAt)}
                        </div>
                      </div>
                    )}
                    {link.status === 'expired' && (
                      <div className="text-xs text-gray-500">
                        Expired: {formatDate(link.expiresAt)}
                      </div>
                    )}
                    {link.status === 'used' && link.usedAt && (
                      <div className="text-xs text-gray-500">
                        Used: {formatDate(link.usedAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {link.bookingPlate ? (
                      <div>
                        <div className="font-mono font-medium">
                          {link.bookingPlate}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {link.bookingId}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Not used</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="text-xs text-gray-500">
                        {formatDate(link.createdAt)}
                      </div>
                      <div className="text-xs text-gray-400">
                        by {link.createdByName}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExpandedQR(expandedQR === link.id ? null : link.id)
                        }
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                        disabled={!qrCodes[link.id]}
                      >
                        {expandedQR === link.id ? 'Hide QR' : 'Show QR'}
                      </button>
                      <button
                        onClick={() => handleCopyUrl(link.bookingUrl)}
                        className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedQR === link.id && qrCodes[link.id] && (
                  <tr key={`qr-${link.id}`}>
                    <td colSpan={6} className="px-6 py-4 bg-gray-50">
                      <div className="flex items-start gap-6">
                        <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
                          <img
                            src={qrCodes[link.id]}
                            alt="QR Code"
                            className="w-64 h-64"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            Booking URL:
                          </h4>
                          <div className="bg-white rounded border border-gray-300 p-3 mb-3">
                            <code className="text-xs text-gray-800 break-all">
                              {link.bookingUrl}
                            </code>
                          </div>
                          <div className="text-sm text-gray-600">
                            <p className="mb-2">
                              📱 Customer can scan this QR code with their phone
                              to access the booking form.
                            </p>
                            <p className="text-xs text-gray-500">
                              Or copy the URL and send it via Messenger/SMS.
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
