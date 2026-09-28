import type { NextConfig } from "next";

const securityHeaders = [
  // The dashboard has no reason to be framed; this blocks clickjacking.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Booking URLs carry a token; never send full URLs to other sites.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  outputFileTracingRoot: __dirname, // important for Vercel + nested structure
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Token-bearing pages: keep them out of search engines and shared caches.
      {
        source: '/book/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
