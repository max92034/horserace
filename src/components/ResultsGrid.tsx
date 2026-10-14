import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { Package, Grid2X2, List, Plus } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSearchStore } from '../store/useSearchStore';
import { useProductStore } from '../store/useProductStore';
import { formatPrice, productImageUrl, productImageFallbackUrl } from '../utils/formatters';
import { useOrderStore } from '../store/useOrderStore';
import { cn } from '../lib/utils';

interface ResultsGridProps {
  products: Product[];
  onUploadClick?: () => void;
}

interface ListItemProps {
  product: Product;
}

const ListItem = React.memo(function ListItem({ product }: ListItemProps) {
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const addItem = useOrderStore(state => state.addItem);

  const handleAdd = useCallback(() => {
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 600);
  }, [addItem, product]);

  const hasDims = product.length > 0 || product.width > 0 || product.height > 0;
  const hasWeight = product.weight > 0;
  const hasCartonQty = product.cartonQty > 0;

  const dims = hasDims
    ? `${product.length || 0}×${product.width || 0}×${product.height || 0} cm`
    : null;

  const imgSrc = productImageUrl(product.sku, product.imageUrl);
  const fallbackSrc = productImageFallbackUrl(product.sku, product.imageUrl);

  const inlineParts: string[] = [];
  if (dims) inlineParts.push(dims);
  if (hasWeight) inlineParts.push(`${product.weight} kg`);
  if (hasCartonQty) inlineParts.push(`${product.cartonQty}/CTN`);

  return (
    <div
      className="flex items-center gap-4 py-4 border-b border-[var(--border-soft)]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '120px' }}
    >
      <div
        className="w-24 h-24 rounded-lg flex-shrink-0 overflow-hidden"
        style={{ aspectRatio: '1/1' }}
      >
        {imgSrc && !imgError ? (
          <img
            src={usedFallback ? fallbackSrc : imgSrc}
            alt={product.description}
            className="w-full h-full object-contain"
            loading="lazy"
            decoding="async"
            onError={() => {
              if (!usedFallback && fallbackSrc) {
                setUsedFallback(true);
              } else {
                setImgError(true);
              }
            }}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1 px-1"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          >
            <Package size={28} strokeWidth={1.5} />
            <span
              className="font-mono line-clamp-1"
              style={{ fontSize: 'var(--text-caption)' }}
            >
              {product.sku}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="font-mono font-semibold"
          style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
        >
          {product.sku}
        </div>
        <p
          className="line-clamp-1 mt-0.5"
          style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}
        >
          {product.description}
        </p>
        {inlineParts.length > 0 && (
          <p
            className="mt-1"
            style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}
          >
            {inlineParts.join(' • ')}
          </p>
        )}
        {product.fobPrice > 0 && (
          <div
            className="font-mono font-bold mt-1"
            style={{ fontSize: '16px', color: 'var(--accent)' }}
          >
            {formatPrice(product.fobPrice)}
          </div>
        )}
      </div>

      <button
        onClick={handleAdd}
        className={cn(
          'icon-btn w-11 h-11 flex-shrink-0',
        )}
        style={{
          background: added ? 'var(--success)' : 'var(--accent)',
          color: 'var(--text-inverse)',
        }}
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
});

// How many items to mount per "page" — a full catalog can be thousands of
// products, and mounting them all at once makes the first paint very slow.
const PAGE_SIZE = 48;

export const ResultsGrid = React.memo(function ResultsGrid({ products, onUploadClick }: ResultsGridProps) {
  const viewMode = useSettingsStore(state => state.viewMode);
  const setViewMode = useSettingsStore(state => state.setViewMode);
  const query = useSearchStore(state => state.query);
  const setQuery = useSearchStore(state => state.setQuery);
  const isLoaded = useProductStore(state => state.isLoaded);
  const totalProducts = useProductStore(state => state.products.length);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [products]);

  const hasMore = visibleCount < products.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(c => Math.min(c + PAGE_SIZE, products.length));
        }
      },
      { rootMargin: '800px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, products.length, viewMode]);

  const visibleProducts = useMemo(
    () => (products.length > visibleCount ? products.slice(0, visibleCount) : products),
    [products, visibleCount]
  );

  const productCards = useMemo(() => {
    return visibleProducts.map((product) => (
      <div key={product.sku} className="h-full">
        <ProductCard product={product} />
      </div>
    ));
  }, [visibleProducts]);

  const listItems = useMemo(() => {
    return visibleProducts.map((product) => (
      <ListItem key={product.sku} product={product} />
    ));
  }, [visibleProducts]);

  const viewToggle = (
    <div className="flex items-center gap-0.5 p-1 rounded-lg bg-[var(--bg-secondary)]">
      <button
        onClick={() => setViewMode('grid')}
        className={cn(
          'p-2 rounded-lg transition-all duration-150',
          viewMode === 'grid'
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        )}
        aria-label="Grid view"
      >
        <Grid2X2 size={18} />
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={cn(
          'p-2 rounded-lg transition-all duration-150',
          viewMode === 'list'
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        )}
        aria-label="List view"
      >
        <List size={18} />
      </button>
    </div>
  );

  if (products.length === 0) {
    const hasActiveSearch = isLoaded && totalProducts > 0 && query.trim().length > 0;

    if (hasActiveSearch) {
      return (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center pt-4">
          <Package size={64} strokeWidth={1} className="text-[var(--text-muted)] mb-5" />
          <h2
            className="font-semibold mb-2"
            style={{ fontSize: 'var(--text-h2)', color: 'var(--text-primary)' }}
          >
            No results for &lsquo;{query}&rsquo;
          </h2>
          <p
            className="mb-6 max-w-sm"
            style={{ fontSize: 'var(--text-body)', color: 'var(--text-muted)' }}
          >
            Try a different search term or clear your search.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setQuery('')} className="btn-primary">
              Clear search
            </button>
            {onUploadClick && (
              <button onClick={onUploadClick} className="btn-secondary">
                <Package size={18} />
                Upload Catalog
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center pt-4">
        <Package size={64} strokeWidth={1} className="text-[var(--text-muted)] mb-5" />
        <h2
          className="font-semibold mb-2"
          style={{ fontSize: 'var(--text-h2)', color: 'var(--text-primary)' }}
        >
          No products found
        </h2>
        <p
          className="mb-6 max-w-sm"
          style={{ fontSize: 'var(--text-body)', color: 'var(--text-muted)' }}
        >
          Try a different search term or upload your catalog.
        </p>
        {onUploadClick && (
          <button onClick={onUploadClick} className="btn-primary">
            <Package size={18} />
            Upload Catalog
          </button>
        )}
      </div>
    );
  }

  const resultsCount = (
    <p className="text-sm text-[var(--text-secondary)]">
      {query ? (
        <span>
          <span className="font-semibold text-[var(--text-primary)]">{products.length}</span> results
          {products.length > 0 && (
            <span className="text-[var(--text-muted)]"> of {totalProducts}</span>
          )}
        </span>
      ) : (
        <span>
          <span className="font-semibold text-[var(--text-primary)]">{totalProducts}</span> products
        </span>
      )}
    </p>
  );

  const toolbar = (
    <div className="flex items-center justify-between mb-4">
      {resultsCount}
      {viewToggle}
    </div>
  );

  if (viewMode === 'grid') {
    return (
      <div className="pt-4">
        {toolbar}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {productCards}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div className="pt-4">
      {toolbar}
      <div className="flex flex-col">{listItems}</div>
      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </div>
  );
});
