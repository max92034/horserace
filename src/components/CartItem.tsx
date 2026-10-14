import { useState } from 'react';
import { Trash2, Package } from 'lucide-react';
import { OrderItem } from '../types';
import { formatPrice, productImageUrl, productImageFallbackUrl } from '../utils/formatters';
import { useOrderStore } from '../store/useOrderStore';
import { cn } from '../lib/utils';

interface CartItemProps {
  item: OrderItem;
  isLast?: boolean;
}

export function CartItem({ item, isLast = false }: CartItemProps) {
  const removeItem = useOrderStore(state => state.removeItem);
  const [usedFallback, setUsedFallback] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = productImageUrl(item.sku, item.imageUrl);
  const fallbackSrc = productImageFallbackUrl(item.sku, item.imageUrl);

  const placeholder = (
    <div className="w-full h-full flex items-center justify-center">
      <Package size={20} style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  return (
    <div className={cn(
      "flex gap-3 py-3",
      !isLast && "border-b border-[var(--border-soft)]"
    )}>
      <div 
        className="w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {imgSrc && !imgFailed ? (
          <img
            src={usedFallback ? fallbackSrc : imgSrc}
            alt={item.description}
            className="w-full h-full object-contain"
            onError={() => {
              if (!usedFallback && fallbackSrc) {
                setUsedFallback(true);
              } else {
                setImgFailed(true);
              }
            }}
          />
        ) : (
          placeholder
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span 
              className="font-mono font-semibold block"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}
            >
              {item.sku}
            </span>
            <p 
              className="line-clamp-1 mt-0.5"
              style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-small)' }}
            >
              {item.description}
            </p>
            <span 
              className="font-mono font-semibold mt-1 block text-right"
              style={{ color: 'var(--accent)', fontSize: 'var(--text-body)' }}
            >
              {formatPrice(item.unitPrice)}
            </span>
          </div>
          <button
            onClick={() => removeItem(item.sku)}
            className="icon-btn flex-shrink-0 mt-1 transition-colors hover:bg-[var(--danger)]/10"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Remove item"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
