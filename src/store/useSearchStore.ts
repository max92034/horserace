import { create } from 'zustand';
import { Product } from '../types';
import { useProductStore } from './useProductStore';

interface SearchState {
  query: string;
  results: Product[];
  setQuery: (query: string) => void;
  performSearch: (query: string) => void;
}

const searchCache = new Map<string, Product[]>();
let lastProductVersion = 0;

function buildSearchableText(product: Product): string {
  return (
    product.sku.toLowerCase() + '\u0001' +
    product.description.toLowerCase() + '\u0001' +
    product.keyword.toLowerCase() + '\u0001' +
    product.location.toLowerCase() + '\u0001' +
    product.collection.toLowerCase() + '\u0001' +
    product.category.toLowerCase() + '\u0001' +
    product.subcategory.toLowerCase()
  );
}

// Rebuilding the lowercased search text for the whole catalog on every
// keystroke is O(products × fields); cache it and rebuild only when the
// catalog actually changes.
let cachedSearchTexts: string[] = [];
let searchTextVersion = -1;
let searchTextProducts: Product[] | null = null;

function getProductsWithSearchText(): { products: Product[]; searchTexts: string[]; version: number } {
  const { products, version } = useProductStore.getState() as { products: Product[]; version: number };
  if (version !== searchTextVersion || products !== searchTextProducts) {
    cachedSearchTexts = products.map(buildSearchableText);
    searchTextVersion = version;
    searchTextProducts = products;
  }
  return { products, searchTexts: cachedSearchTexts, version };
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  
  setQuery: (query: string) => {
    set({ query });
  },
  
  performSearch: (query: string) => {
    const { products, searchTexts, version } = getProductsWithSearchText();
    const q = query.toLowerCase().trim();
    
    if (version !== lastProductVersion) {
      searchCache.clear();
      lastProductVersion = version;
    }
    
    const cacheKey = q;
    const cached = searchCache.get(cacheKey);
    if (cached) {
      set({ query, results: cached });
      return;
    }
    
    let results: Product[];
    
    if (!q) {
      results = products;
    } else {
      results = [];
      for (let i = 0; i < products.length; i++) {
        if (searchTexts[i].includes(q)) {
          results.push(products[i]);
        }
      }
    }
    
    if (searchCache.size > 50) {
      searchCache.delete(searchCache.keys().next().value);
    }
    searchCache.set(cacheKey, results);
    
    set({ query, results });
  },
}));
