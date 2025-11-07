// src/lib/magic-links/qr-code.ts
import * as QRCode from 'qrcode';

/**
 * QR code size presets for consistent display across the application
 */
export const QR_SIZE_NORMAL = 300;
export const QR_SIZE_FULLSCREEN = 500;

/**
 * Configuration options for QR code generation
 */
export interface QRCodeOptions {
  /**
   * Size of the QR code in pixels (width and height)
   * @default 300
   */
  size?: number;

  /**
   * Error correction level for QR code
   * - L (Low): 7% recovery - faster, smaller QR codes
   * - M (Medium): 15% recovery - recommended default
   * - Q (Quartile): 25% recovery - more robust
   * - H (High): 30% recovery - maximum reliability
   * @default 'M'
   */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generate a QR code as a data URL (base64-encoded PNG)
 *
 * Creates a QR code image that can be directly embedded in HTML img tags
 * or displayed in React components. The returned data URL starts with
 * "data:image/png;base64,..." and contains the full image data.
 *
 * Typical use cases:
 * - Display QR code in dashboard for receptionist to show customers
 * - Fullscreen QR display for easy scanning
 * - Embedding in email templates or PDFs
 *
 * Security Notes:
 * - Only encode validated magic link URLs
 * - Magic link tokens are single-use and time-limited (24 hours)
 * - Do NOT cache QR codes (each magic link is unique)
 *
 * @param url - The URL to encode in the QR code (typically a magic link URL)
 * @param options - Optional configuration for size and error correction
 * @returns Promise resolving to data URL string (data:image/png;base64,...)
 * @throws Error if QR code generation fails
 *
 * @example
 * // Generate QR for magic link (normal size - 300px)
 * const qrDataUrl = await generateQRCode('https://washboard.app/book/MAIN/abc123...');
 * // Use in HTML: <img src={qrDataUrl} alt="Booking QR Code" />
 *
 * @example
 * // Generate QR for fullscreen display (500px)
 * const qrFullscreen = await generateQRCode(
 *   'https://washboard.app/book/MAIN/abc123...',
 *   { size: QR_SIZE_FULLSCREEN }
 * );
 *
 * @example
 * // Generate QR with high error correction (for damaged/dirty displays)
 * const qrRobust = await generateQRCode(
 *   'https://washboard.app/book/MAIN/abc123...',
 *   { size: 400, errorCorrectionLevel: 'H' }
 * );
 */
export async function generateQRCode(
  url: string,
  options?: QRCodeOptions
): Promise<string> {
  try {
    const size = options?.size ?? QR_SIZE_NORMAL;
    const errorCorrectionLevel = options?.errorCorrectionLevel ?? 'M';

    const dataUrl = await QRCode.toDataURL(url, {
      width: size,
      errorCorrectionLevel
    });

    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a QR code as a PNG buffer
 *
 * Creates a QR code as a raw PNG buffer suitable for:
 * - API endpoints that serve images directly
 * - Saving QR codes to disk
 * - Sending QR codes in HTTP responses
 * - Generating downloadable QR code files
 *
 * The buffer contains the complete PNG file data and can be sent
 * directly as a response with Content-Type: image/png header.
 *
 * Security Notes:
 * - Only encode validated magic link URLs
 * - Set appropriate cache headers (no-cache for magic links)
 * - Consider rate limiting QR generation endpoints
 *
 * @param url - The URL to encode in the QR code (typically a magic link URL)
 * @param options - Optional configuration for size and error correction
 * @returns Promise resolving to PNG buffer
 * @throws Error if QR code generation fails
 *
 * @example
 * // Generate QR as PNG buffer for API response
 * const qrBuffer = await generateQRCodePNG('https://washboard.app/book/MAIN/abc123...');
 * // In Next.js API route:
 * // return new Response(qrBuffer, {
 * //   headers: {
 * //     'Content-Type': 'image/png',
 * //     'Cache-Control': 'no-cache, no-store, must-revalidate'
 * //   }
 * // });
 *
 * @example
 * // Generate fullscreen QR as buffer
 * const qrBuffer = await generateQRCodePNG(
 *   'https://washboard.app/book/MAIN/abc123...',
 *   { size: QR_SIZE_FULLSCREEN }
 * );
 *
 * @example
 * // Generate QR buffer for download endpoint
 * const qrBuffer = await generateQRCodePNG(magicLink.url, { size: 400 });
 * // Set Content-Disposition header for download:
 * // 'attachment; filename="booking-qr.png"'
 */
export async function generateQRCodePNG(
  url: string,
  options?: QRCodeOptions
): Promise<Buffer> {
  try {
    const size = options?.size ?? QR_SIZE_NORMAL;
    const errorCorrectionLevel = options?.errorCorrectionLevel ?? 'M';

    const buffer = await QRCode.toBuffer(url, {
      width: size,
      errorCorrectionLevel
    });

    return buffer;
  } catch (err) {
    console.error('Failed to generate QR code PNG buffer:', err);
    throw new Error('Failed to generate QR code');
  }
}
