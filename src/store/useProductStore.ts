import { create } from 'zustand';
import { Product } from '../types';
import { supabase } from '../lib/supabase';

interface ProductState {
  products: Product[];
  isLoaded: boolean;
  version: number;
  lastUpdated: string | null;
  fetching: boolean;
  uploading: boolean;
  uploadProgress: string | null;
  fetchProducts: () => Promise<void>;
  loadProducts: (products: Product[]) => Promise<void>;
  clearProducts: () => Promise<void>;
}

interface ProductRow {
  sku: string;
  description: string;
  collection: string;
  location: string;
  unit: string;
  category: string;
  subcategory: string;
  note: string;
  image_url: string;
  keyword: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  carton_qty: number;
  inner_qty: number;
  carton_l: number;
  carton_w: number;
  carton_h: number;
  fob_price: number;
  updated_at: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function rowToProduct(row: ProductRow): Product {
  return {
    sku: row.sku ?? '',
    description: row.description ?? '',
    collection: row.collection ?? '',
    location: row.location ?? '',
    length: Number(row.length) || 0,
    width: Number(row.width) || 0,
    height: Number(row.height) || 0,
    weight: round2(Number(row.weight) || 0),
    unit: row.unit || 'PC',
    cartonQty: Number(row.carton_qty) || 0,
    innerQty: Number(row.inner_qty) || 0,
    cartonL: Number(row.carton_l) || 0,
    cartonW: Number(row.carton_w) || 0,
    cartonH: Number(row.carton_h) || 0,
    category: row.category ?? '',
    subcategory: row.subcategory ?? '',
    fobPrice: Number(row.fob_price) || 0,
    note: row.note ?? '',
    imageUrl: row.image_url ?? '',
    keyword: row.keyword ?? '',
  };
}

function productToRow(p: Product) {
  return {
    sku: p.sku,
    description: p.description || '',
    collection: p.collection || '',
    location: p.location || '',
    unit: p.unit || 'PC',
    category: p.category || '',
    subcategory: p.subcategory || '',
    note: p.note || '',
    image_url: p.imageUrl || '',
    keyword: p.keyword || '',
    length: p.length || 0,
    width: p.width || 0,
    height: p.height || 0,
    weight: round2(p.weight || 0),
    carton_qty: p.cartonQty || 0,
    inner_qty: p.innerQty || 0,
    carton_l: p.cartonL || 0,
    carton_w: p.cartonW || 0,
    carton_h: p.cartonH || 0,
    fob_price: p.fobPrice || 0,
    updated_at: new Date().toISOString(),
  };
}

const PAGE_SIZE = 1000; // Supabase caps a single request at 1000 rows
const BATCH_SIZE = 500;

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  isLoaded: false,
  version: 0,
  lastUpdated: null,
  fetching: false,
  uploading: false,
  uploadProgress: null,

  fetchProducts: async () => {
    if (get().fetching) return;
    set({ fetching: true });
    try {
      const rows: ProductRow[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('sku')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        rows.push(...((data ?? []) as ProductRow[]));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const products = rows.map(rowToProduct);
      const latest = rows.reduce<string | null>(
        (max, r) => (max && max > r.updated_at ? max : r.updated_at),
        null
      );
      set({
        products,
        isLoaded: true,
        version: get().version + 1,
        lastUpdated: latest,
      });
    } finally {
      set({ fetching: false });
    }
  },

  loadProducts: async (products: Product[]) => {
    const rows = products.map(productToRow);
    const batches: (typeof rows)[] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }

    set({ uploading: true, uploadProgress: batches.length > 0 ? `0/${batches.length} batches` : null });
    try {
      for (let i = 0; i < batches.length; i++) {
        const { error } = await supabase
          .from('products')
          .upsert(batches[i], { onConflict: 'sku' });
        if (error) throw new Error(error.message);
        set({ uploadProgress: `${i + 1}/${batches.length} batches` });
      }
      set({
        products,
        isLoaded: true,
        version: get().version + 1,
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      set({ uploading: false, uploadProgress: null });
    }
  },

  // Deletes every row server-side; RLS rejects this for non-admins.
  clearProducts: async () => {
    const { error } = await supabase.from('products').delete().neq('sku', '');
    if (error) throw error;
    set({ products: [], isLoaded: false, version: get().version + 1, lastUpdated: null });
  },
}));
