import { useState } from 'react';
import { X, History, Trash2, Calendar, Package } from 'lucide-react';
import { useOrderStore } from '../store/useOrderStore';
import { formatPrice } from '../utils/formatters';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { useModalA11y } from '../hooks/useModalA11y';

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown date';
  }
}

export function OrderHistoryModal({ isOpen, onClose }: OrderHistoryModalProps) {
  const savedOrders = useOrderStore(state => state.savedOrders);
  const loadOrder = useOrderStore(state => state.loadOrder);
  const deleteOrder = useOrderStore(state => state.deleteOrder);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const modalRef = useModalA11y(isOpen, onClose);

  const handleLoad = (order: Order) => {
    loadOrder(order.id);
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteOrder(deleteId);
      setDeleteId(null);
    }
  };

  if (!isOpen) return null;

  const orders = Array.isArray(savedOrders) ? savedOrders : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-modal">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Saved Quotations"
        tabIndex={-1}
        className="bg-[var(--bg-card)] w-full sm:max-w-lg sm:rounded-xl rounded-t-xl sm:shadow-xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up sm:animate-scale-enter"
      >
        <div className="flex items-center justify-between px-6 py-6 pb-4 border-b border-[var(--border-soft)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <History size={20} />
            </div>
            <h2
              className="font-semibold"
              style={{ fontSize: 'var(--text-h3)', color: 'var(--text-primary)' }}
            >
              Saved Quotations
            </h2>
          </div>
          <button
            onClick={onClose}
            className="icon-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: '70vh' }}>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History
                size={48}
                strokeWidth={1}
                style={{ color: 'var(--text-muted)' }}
                className="mb-4"
              />
              <p
                className="font-medium mb-1"
                style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
              >
                No saved quotations
              </p>
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                Quotations you save will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => {
                if (!order || !order.id) return null;
                const items = Array.isArray(order.items) ? order.items : [];
                const subtotal = typeof order.subtotal === 'number' ? order.subtotal : 0;
                const buyer = order.buyer || null;

                return (
                  <div
                    key={order.id}
                    className={cn(
                      'p-4 rounded-lg transition-all duration-150 cursor-pointer',
                      'hover:bg-[var(--bg-elevated)]'
                    )}
                    style={{ background: 'var(--bg-secondary)' }}
                    onClick={() => handleLoad(order)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-semibold truncate"
                          style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
                        >
                          {buyer?.company || 'Untitled'}
                        </p>
                        {buyer?.name && (
                          <p
                            className="truncate mt-0.5"
                            style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}
                          >
                            {buyer.name}
                          </p>
                        )}
                      </div>
                      <div
                        className="font-mono font-bold flex-shrink-0"
                        style={{ fontSize: 'var(--text-body)', color: 'var(--accent)' }}
                      >
                        {formatPrice(subtotal)}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-4 mb-3"
                      style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={14} />
                        {formatDate(order.updatedAt || order.createdAt || '')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Package size={14} />
                        {items.length} items
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-soft)]">
                      <button
                        onClick={() => handleLoad(order)}
                        className="btn-primary flex-1 text-sm"
                        style={{ paddingTop: '8px', paddingBottom: '8px' }}
                      >
                        Load
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, order.id)}
                        className="btn-ghost"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={18} />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {deleteId && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
            onClick={() => setDeleteId(null)}
          >
            <div
              className="bg-[var(--bg-card)] rounded-xl shadow-xl max-w-sm w-full p-6 animate-scale-enter"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="font-semibold mb-2"
                style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
              >
                Delete this quotation?
              </h3>
              <p
                className="mb-5"
                style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}
              >
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-90"
                  style={{ background: 'var(--danger)', color: 'var(--text-inverse)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-soft)] flex-shrink-0">
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
