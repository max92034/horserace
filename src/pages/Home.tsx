import { useState, useEffect } from 'react';
import { SearchHeader } from '@/components/SearchHeader';
import { ResultsGrid } from '@/components/ResultsGrid';
import { UploadModal } from '@/components/UploadModal';
import { OrderDrawer } from '@/components/OrderDrawer';
import { OrderHistoryModal } from '@/components/OrderHistoryModal';
import { SettingsModal } from '@/components/SettingsModal';
import { InventoryModal } from '@/components/InventoryModal';
import { useSearchStore } from '@/store/useSearchStore';
import { useProductStore } from '@/store/useProductStore';
import { useOrderStore } from '@/store/useOrderStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Package, Upload as UploadIcon } from 'lucide-react';

export default function Home() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const results = useSearchStore(state => state.results);
  const isLoaded = useProductStore(state => state.isLoaded);
  const products = useProductStore(state => state.products);
  const fetching = useProductStore(state => state.fetching);
  const fetchProducts = useProductStore(state => state.fetchProducts);
  const isDrawerOpen = useOrderStore(state => state.isDrawerOpen);
  const toggleDrawer = useOrderStore(state => state.toggleDrawer);
  const performSearch = useSearchStore(state => state.performSearch);
  const session = useAuthStore(state => state.session);
  const isAdmin = useAuthStore(state => state.isAdmin);

  useEffect(() => {
    if (session && !isLoaded && !fetching) {
      void fetchProducts().catch((err) => console.error('Failed to fetch products:', err));
    }
  }, [session, isLoaded, fetching, fetchProducts]);

  useEffect(() => {
    if (isLoaded && products.length > 0) {
      performSearch('');
    }
  }, [isLoaded, products.length, performSearch]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <SearchHeader
        onUploadClick={() => setUploadOpen(true)}
        onHistoryClick={() => setHistoryOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-28 content-layer">
        {fetching && !isLoaded ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-4">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p style={{ color: 'var(--text-secondary)' }}>Loading catalog...</p>
          </div>
        ) : !isLoaded || products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center animate-fade-in">
            <div className="w-24 h-24 bg-[var(--accent-soft)] rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-[var(--accent)]/10">
              <Package size={44} className="text-[var(--accent)]" strokeWidth={1.5} />
            </div>
            <h2 className="gradient-heading font-bold text-[var(--text-primary)] mb-3" style={{ fontSize: 'var(--text-h1)' }}>
              Welcome to Horserace
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md leading-relaxed">
              {isAdmin
                ? 'The catalog is empty. Upload your product catalog to start searching and building orders.'
                : 'The catalog is empty. Ask an administrator to upload the product catalog.'}
            </p>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setUploadOpen(true)}
                  className="btn-primary"
                >
                  <UploadIcon size={18} />
                  Upload Products
                </button>
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-5">
              Supports .xlsx, .xls, and .csv files
            </p>
          </div>
        ) : (
          <ResultsGrid products={results} onUploadClick={isAdmin ? () => setUploadOpen(true) : undefined} />
        )}
      </main>

      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
      <OrderDrawer isOpen={isDrawerOpen} onClose={() => toggleDrawer(false)} />
      <OrderHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onInventoryClick={() => setInventoryOpen(true)} />
      <InventoryModal isOpen={inventoryOpen} onClose={() => setInventoryOpen(false)} />
    </div>
  );
}
