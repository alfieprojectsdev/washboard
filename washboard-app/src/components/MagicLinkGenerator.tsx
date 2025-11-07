'use client';

import { useState } from 'react';

interface MagicLinkGeneratorProps {
  branchCode: string;
  onLinkGenerated: () => void;
}

export default function MagicLinkGenerator({
  branchCode,
  onLinkGenerated,
}: MagicLinkGeneratorProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerMessenger, setCustomerMessenger] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<{
    url: string;
    token: string;
    expiresAt: string;
  } | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/magic-links/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || undefined,
          customerMessenger: customerMessenger.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setGeneratedLink({
          url: data.bookingUrl,
          token: data.token,
          expiresAt: data.expiresAt,
        });
        // Clear form
        setCustomerName('');
        setCustomerMessenger('');
        // Notify parent
        onLinkGenerated();
      } else {
        setError(data.error || 'Failed to generate magic link');
      }
    } catch (err) {
      console.error('Error generating magic link:', err);
      setError('Network error while generating link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyUrl = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink.url);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Generate New Magic Link
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Name (Optional)
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isGenerating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Messenger Handle (Optional)
          </label>
          <input
            type="text"
            value={customerMessenger}
            onChange={(e) => setCustomerMessenger(e.target.value)}
            placeholder="m.me/johndoe or fb.com/johndoe"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isGenerating}
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: m.me/username or fb.com/username
          </p>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
      >
        {isGenerating ? 'Generating...' : '🔗 Generate Magic Link'}
      </button>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {generatedLink && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 mb-2">
                ✅ Magic Link Generated!
              </h3>
              <div className="bg-white rounded border border-green-300 p-3 mb-2">
                <code className="text-xs text-gray-800 break-all">
                  {generatedLink.url}
                </code>
              </div>
              <p className="text-xs text-green-700">
                Expires:{' '}
                {new Date(generatedLink.expiresAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleCopyUrl}
              className="ml-4 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              📋 Copy
            </button>
          </div>
          <button
            onClick={() => setGeneratedLink(null)}
            className="mt-3 text-sm text-green-700 hover:text-green-900"
          >
            ✕ Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
