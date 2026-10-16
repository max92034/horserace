import { InventoryScan, InventorySession, Product } from '../types';

export interface ScanMatch {
  scan: InventoryScan;
  product: Product;
}

export interface SessionAnalysis {
  /** Scanned, and DB location matches the session location. */
  matched: ScanMatch[];
  /** Scanned, but DB says the product lives at a different location. */
  misplaced: ScanMatch[];
  /** Scanned SKU not found in the catalog at all. */
  unknown: InventoryScan[];
  /** DB products at this location that were never scanned. */
  missing: Product[];
}

const normLoc = (s: string) => s.trim().toLowerCase();

/** A DB location can name several shelves ("CF/BL"); split into single parts. */
export function locationParts(location: string): string[] {
  return location.split('/').map(normLoc).filter(Boolean);
}

/** True if the DB location (possibly compound like "CF/BL") includes the target. */
export function locationMatches(dbLocation: string, target: string): boolean {
  return locationParts(dbLocation).includes(normLoc(target));
}

export function analyzeSession(session: InventorySession, products: Product[]): SessionAnalysis {
  const bySku = new Map<string, Product>();
  for (const p of products) bySku.set(p.sku.toLowerCase(), p);

  const matched: ScanMatch[] = [];
  const misplaced: ScanMatch[] = [];
  const unknown: InventoryScan[] = [];
  const scannedKeys = new Set<string>();
  const target = session.location;

  for (const scan of session.scans) {
    const key = scan.sku.toLowerCase();
    scannedKeys.add(key);
    const product = bySku.get(key);
    if (!product) {
      unknown.push(scan);
    } else if (locationMatches(product.location, target)) {
      matched.push({ scan, product });
    } else {
      misplaced.push({ scan, product });
    }
  }

  const missing = products.filter(
    p => locationMatches(p.location, target) && !scannedKeys.has(p.sku.toLowerCase())
  );

  return { matched, misplaced, unknown, missing };
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// BOM prefix so Excel opens the file as UTF-8 instead of garbling CJK.
function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeName(s: string): string {
  return s.trim().replace(/[^\w-]+/g, '_') || 'location';
}

export function exportScansCsv(session: InventorySession): void {
  const rows: string[][] = [['SKU', 'LOCATION']];
  // Scans are stored newest-first; export chronologically for a natural check log.
  for (const scan of [...session.scans].reverse()) {
    rows.push([scan.sku, session.location]);
  }
  downloadCsv(`inventory-${safeName(session.location)}.csv`, rows);
}

export function exportReportCsv(session: InventorySession, products: Product[]): void {
  const { misplaced, unknown, missing } = analyzeSession(session, products);
  const rows: string[][] = [['TYPE', 'SKU', 'DESCRIPTION', 'DB_LOCATION', 'SCANNED_LOCATION']];
  for (const { product } of misplaced) {
    rows.push(['MISPLACED', product.sku, product.description, product.location, session.location]);
  }
  for (const scan of unknown) {
    rows.push(['UNKNOWN', scan.sku, '', '', session.location]);
  }
  for (const p of missing) {
    rows.push(['MISSING', p.sku, p.description, p.location, '']);
  }
  downloadCsv(`inventory-report-${safeName(session.location)}.csv`, rows);
}
