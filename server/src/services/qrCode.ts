import QRCode from 'qrcode';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

/**
 * Generate a QR code data URL (PNG base64) for the given path.
 * The QR code encodes the full URL: {APP_BASE_URL}{path}
 */
export async function generateQrDataUrl(path: string): Promise<string> {
  const url = `${APP_BASE_URL}${path}`;
  return QRCode.toDataURL(url, { width: 256, margin: 1 });
}
