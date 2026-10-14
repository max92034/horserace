import { Product } from '../types';
import { sanitizeValue, sanitizeNumber, normalizeImageUrl } from './formatters';

const COLUMN_MAP: Record<string, keyof Product> = {
  // Product Identification
  'sku': 'sku',
  'description': 'description',
  'collection': 'collection',
  'location': 'location',

  // Physical Specifications
  'length': 'length',
  'width': 'width',
  'height': 'height',
  'weight': 'weight',

  // Packaging
  'unit': 'unit',
  'carton qty': 'cartonQty',
  'cartonqty': 'cartonQty',
  'ctn qty': 'cartonQty',
  'carton qty/pcs': 'cartonQty',
  'inner qty': 'innerQty',
  'innerqty': 'innerQty',
  'carton l': 'cartonL',
  'cartonl': 'cartonL',
  'carton l(cm)': 'cartonL',
  'carton w': 'cartonW',
  'cartonw': 'cartonW',
  'carton w(cm)': 'cartonW',
  'carton h': 'cartonH',
  'cartonh': 'cartonH',
  'carton h(cm)': 'cartonH',

  // Categorization
  'category': 'category',
  'subcategory': 'subcategory',

  // Other
  'fob': 'fobPrice',
  'fob price': 'fobPrice',
  'note': 'note',
  'notes': 'note',
  'img': 'imageUrl',
  'image': 'imageUrl',
  'imageurl': 'imageUrl',
  'keyword': 'keyword',
  'keywords': 'keyword',
};

export interface ParseResult {
  products: Product[];
  duplicateSkus: string[];
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  // xlsx is ~400KB minified — load it only when a file is actually parsed
  // so it stays out of the initial bundle.
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];
        
        if (jsonData.length < 2) {
          throw new Error('No valid product rows found — check that the first row contains headers like SKU, Description');
        }

        const headers = (jsonData[0] as string[]).map(h => String(h || '').trim().toLowerCase());
        if (!headers.includes('sku')) {
          throw new Error('No valid product rows found — check that the first row contains headers like SKU, Description');
        }

        const products: Product[] = [];
        const duplicateSkus: string[] = [];
        const seenSkus = new Set<string>();

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every(cell => !cell || String(cell).trim() === '')) continue;

          const product: Product = {
            // Product Identification
            sku: '',
            description: '',
            collection: '',
            location: '',
            // Physical Specifications
            length: 0,
            width: 0,
            height: 0,
            weight: 0,
            // Packaging
            unit: 'PC',
            cartonQty: 0,
            innerQty: 0,
            cartonL: 0,
            cartonW: 0,
            cartonH: 0,
            // Categorization
            category: '',
            subcategory: '',
            // Other
            fobPrice: 0,
            note: '',
            imageUrl: '',
            keyword: '',
          };

          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            const mappedKey = COLUMN_MAP[header];
            if (!mappedKey) continue;

            const value = row[j];
            if (mappedKey === 'length' || mappedKey === 'width' || mappedKey === 'height' ||
                mappedKey === 'weight' || mappedKey === 'fobPrice' || mappedKey === 'cartonQty' ||
                mappedKey === 'innerQty' || mappedKey === 'cartonL' || mappedKey === 'cartonW' ||
                mappedKey === 'cartonH') {
              (product[mappedKey] as number) = sanitizeNumber(value);
            } else {
              (product[mappedKey] as string) = sanitizeValue(value);
            }
          }

          product.imageUrl = normalizeImageUrl(product.imageUrl);
          if (product.sku) {
            const skuKey = product.sku.toLowerCase();
            if (seenSkus.has(skuKey)) {
              duplicateSkus.push(product.sku);
              continue;
            }
            seenSkus.add(skuKey);
            products.push(product);
          }
        }

        if (products.length === 0) {
          throw new Error('No valid product rows found — check that the first row contains headers like SKU, Description');
        }

        resolve({ products, duplicateSkus });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
}

const TEMPLATE_HEADERS = [
  'SKU', 'Description', 'Collection', 'Location',
  'L', 'W', 'H', 'Weight',
  'Unit', 'Carton Qty', 'Inner Qty', 'Carton L', 'Carton W', 'Carton H',
  'Category', 'Subcategory',
  'FOB', 'Note', 'IMG', 'Keyword',
];

export async function downloadBlankTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Catalog');
  XLSX.writeFile(workbook, 'catalog-template.xlsx');
}
