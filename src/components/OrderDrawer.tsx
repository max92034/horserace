import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { ArrowLeft, Plus, ShoppingCart } from 'lucide-react';
import { useOrderStore } from '../store/useOrderStore';
import { CartItem } from './CartItem';
import { BuyerInfoForm } from './BuyerInfoForm';
import { OrderSummary } from './OrderSummary';
import { useToast } from '../store/useToastStore';
import { cn } from '../lib/utils';

const SWIPE_CLOSE_THRESHOLD = 80;

interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDrawer({ isOpen, onClose }: OrderDrawerProps) {
  const order = useOrderStore(state => state.currentOrder);
  const newOrder = useOrderStore(state => state.newOrder);
  const saveOrder = useOrderStore(state => state.saveOrder);
  const { addToast } = useToast();

  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setDragY(0);
  }, [isOpen]);

  const handleTouchStart = (e: TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    setDragY(Math.max(0, dy));
  };

  const handleTouchEnd = () => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragY > SWIPE_CLOSE_THRESHOLD) {
      onClose();
    }
    setDragY(0);
  };

  const handleSave = () => {
    saveOrder();
    addToast('Quotation saved!', 'success');
  };

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      <div
        className={cn(
          "fixed z-40 inset-x-0 bottom-0 top-12",
          "sm:inset-x-auto sm:top-0 sm:right-0 sm:h-full sm:w-[420px]",
          "flex flex-col",
          "bg-[var(--bg-card)]",
          "rounded-t-2xl sm:rounded-none",
          "shadow-[var(--shadow-xl)] sm:border-l sm:border-[var(--border-soft)]",
          dragY === 0 && "transition-transform duration-300 ease-out",
          isOpen
            ? "translate-x-0 translate-y-0 sm:animate-slide-in-right"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        )}
        style={{
          zIndex: 41,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        }}
      >
        <div
          className="sticky top-0 z-10 bg-[var(--bg-card)] border-b border-[var(--border-soft)] rounded-t-2xl sm:rounded-none touch-none sm:touch-auto"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className="flex justify-center pt-2 sm:hidden">
            <div
              className="w-10 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--border)' }}
              aria-hidden="true"
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <button
              onClick={onClose}
              className="icon-btn hover:bg-[var(--bg-secondary)]"
              aria-label="Close"
            >
              <ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} />
            </button>

            <h1
              className="font-semibold tracking-tight"
              style={{ fontSize: 'var(--text-h1)', color: 'var(--text-primary)' }}
            >
              Quotation
            </h1>

            <button
              onClick={handleSave}
              className="font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--accent)' }}
            >
              Save
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <BuyerInfoForm />
          </div>

          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--text-muted)' }}
              >
                Items ({order.items.length})
              </span>
              <button
                onClick={newOrder}
                className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'var(--accent)' }}
              >
                <Plus size={16} />
                Add
              </button>
            </div>

            {order.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart
                  size={48}
                  strokeWidth={1}
                  style={{ color: 'var(--text-muted)' }}
                  className="mb-3"
                />
                <p
                  className="font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Order is empty
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Search and add products to get started
                </p>
              </div>
            ) : (
              <div>
                {order.items.map((item, index) => (
                  <CartItem
                    key={item.sku}
                    item={item}
                    isLast={index === order.items.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {order.items.length > 0 && <OrderSummary />}

        <div
          className="sm:hidden p-4"
          style={{ borderTop: '1px solid var(--border-soft)' }}
        >
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full font-semibold transition-all duration-200 active:scale-95"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--text-inverse)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
