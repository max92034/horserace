import { OrderItem } from '../types';

export function formatPrice(price: number): string {
  if (price == null || isNaN(price)) return '';
  return `$${price.toFixed(2)}`;
}

// Sum in integer cents to avoid floating-point drift across line items.
export function calculateSubtotal(items: OrderItem[]): number {
  const cents = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100),
    0
  );
  return cents / 100;
}

export function calculateTotalItems(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function calculateTotalCartons(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    if (!item.cartonQty) return sum;
    return sum + Math.ceil(item.quantity / item.cartonQty);
  }, 0);
}

export function sanitizeValue(value: unknown): string {
  if (value == null) return '';
  const str = String(value).trim();
  if (str === '#N/A' || str === '#N/A ' || str.toLowerCase() === 'n/a') return '';
  return str;
}

export function sanitizeNumber(value: unknown): number {
  if (value == null) return 0;
  const str = String(value).trim();
  if (str === '#N/A' || str === '' || str.toLowerCase() === 'n/a') return 0;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Next.js image-proxy URLs (`/_next/image?url=<real>`) return 400 without the
// required `w` param, so unwrap and use the origin URL directly.
export function normalizeImageUrl(url: string): string {
  if (!url) return url;
  const marker = '/_next/image?';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const inner = new URLSearchParams(url.slice(idx + marker.length)).get('url');
  return inner || url;
}

const CLOUDFRONT_PHOTO_BASE = 'https://d2smnk90fd10gg.cloudfront.net/commodity/photo';

// Product photos follow the convention `<SKU>.jpg` on CloudFront, so the
// IMG column is optional — fall back to the SKU-derived URL when it's empty.
export function productImageUrl(sku: string, imageUrl: string): string {
  const direct = normalizeImageUrl(imageUrl);
  if (direct) return direct;
  return sku ? `${CLOUDFRONT_PHOTO_BASE}/${encodeURIComponent(sku)}.jpg` : '';
}

// Older photos were uploaded as `<SKU>-1.jpg`, so if the base-name URL fails,
// components retry once with this before showing the placeholder.
export function productImageFallbackUrl(sku: string, imageUrl: string): string {
  if (normalizeImageUrl(imageUrl)) return '';
  return sku ? `${CLOUDFRONT_PHOTO_BASE}/${encodeURIComponent(sku)}-1.jpg` : '';
}
