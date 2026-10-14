import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Search, ShoppingCart, History, X, Settings, LogOut, Upload } from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { useSearchStore } from '../store/useSearchStore';
import { useOrderStore } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { useDebounce } from '../hooks/useDebounce';
import { cn } from '../lib/utils';

interface SearchHeaderProps {
  onUploadClick: () => void;
  onHistoryClick: () => void;
  onSettingsClick: () => void;
}

export const SearchHeader = React.memo(function SearchHeader({ onUploadClick, onHistoryClick, onSettingsClick }: SearchHeaderProps) {
  const query = useSearchStore(state => state.query);
  const setQuery = useSearchStore(state => state.setQuery);
  const performSearch = useSearchStore(state => state.performSearch);
  const debouncedQuery = useDebounce(query, 150);

  const totalItems = useOrderStore(state => state.currentOrder.totalItems);
  const toggleDrawer = useOrderStore(state => state.toggleDrawer);

  const isAdmin = useAuthStore(state => state.isAdmin);
  const signOut = useAuthStore(state => state.signOut);

  const [badgeBump, setBadgeBump] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const prevTotalItemsRef = useRef(totalItems);
  useEffect(() => {
    if (totalItems === prevTotalItemsRef.current) return;
    prevTotalItemsRef.current = totalItems;
    setBadgeBump(true);
    const timer = setTimeout(() => setBadgeBump(false), 300);
    return () => clearTimeout(timer);
  }, [totalItems]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, [setQuery]);

  const handleClear = useCallback(() => {
    setQuery('');
    performSearch('');
    inputRef.current?.focus();
  }, [setQuery, performSearch]);

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-header"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="h-16 sm:h-[72px] px-4 sm:px-8">
        <div className="h-full flex items-center gap-3 sm:gap-4">
          <a href="#" className="flex items-center gap-2 whitespace-nowrap">
            <img
              src={`${import.meta.env.BASE_URL}assets/logo-desmo.png`}
              alt="DESMO Logo"
              className="h-14 object-contain"
            />
          </a>
          <div className="flex-1 relative">
            <div className="relative flex items-center h-10">
              <Search
                className="absolute left-4 pointer-events-none"
                size={18}
                strokeWidth={1.5}
                style={{ color: 'var(--text-muted)' }}
                aria-hidden="true"
              />
              <label htmlFor="search-input" className="sr-only">
                Search products
              </label>
              <input
                id="search-input"
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                placeholder="Search SKU, name, or keyword..."
                className="w-full h-full pl-11 pr-12 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all duration-200 text-sm sm:text-base"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
              <div className="absolute right-2 flex items-center gap-1">
                {query && (
                  <button
                    onClick={handleClear}
                    className="p-2.5 rounded-full transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <span
                className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                Admin
              </span>
            )}

            <MobileMenu
              onUploadClick={onUploadClick}
              onHistoryClick={onHistoryClick}
              onSettingsClick={onSettingsClick}
            />

            {isAdmin && (
              <button
                onClick={onUploadClick}
                className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 active:scale-95"
                style={{
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                aria-label="Upload catalog"
              >
                <Upload size={20} strokeWidth={1.5} />
              </button>
            )}

            <button
              onClick={onSettingsClick}
              className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 active:scale-95 shadow-sm"
              style={{
                color: 'var(--text-inverse)',
                backgroundColor: 'var(--accent)',
                boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 20%, transparent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              aria-label="Open settings"
            >
              <Settings size={20} strokeWidth={1.5} />
            </button>

            <button
              onClick={onHistoryClick}
              className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 active:scale-95"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              aria-label="Open order history"
            >
              <History size={20} strokeWidth={1.5} />
            </button>

            <button
              onClick={() => toggleDrawer(true)}
              className="relative inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 active:scale-95 shadow-md"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 25%, transparent)',
              }}
              aria-label={`View order, ${totalItems} items`}
            >
              <ShoppingCart size={20} strokeWidth={1.5} />
              {totalItems > 0 && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1 min-w-5 h-5 px-1 text-xs font-bold rounded-full flex items-center justify-center",
                    "transition-transform duration-300 ease-out",
                    badgeBump && "scale-125"
                  )}
                  style={{
                    backgroundColor: 'var(--danger)',
                    color: 'var(--on-danger, #fff)',
                  }}
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => { void signOut(); }}
              className="inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 active:scale-95"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                e.currentTarget.style.color = 'var(--danger)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              aria-label="Sign out"
            >
              <LogOut size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});
