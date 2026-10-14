import { Download, Mail, FileText, AlertTriangle } from 'lucide-react';
import { useOrderStore } from '../store/useOrderStore';
import { useToast } from '../store/useToastStore';
import { formatPrice } from '../utils/formatters';
import { cn } from '../lib/utils';
import { getCountryByCode } from '../data/countries';

function validateBuyer(buyer: ReturnType<typeof useOrderStore.getState>['currentOrder']['buyer']): string[] {
  const errors: string[] = [];
  if (!buyer?.name?.trim()) errors.push('Buyer Name');
  if (!buyer?.company?.trim()) errors.push('Company');
  if (!buyer?.email?.trim()) {
    errors.push('Email');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())) {
    errors.push('Email (invalid format)');
  }
  if (!buyer?.nationality) errors.push('Nationality');
  return errors;
}

export function OrderSummary() {
  const order = useOrderStore(state => state.currentOrder);
  const newOrder = useOrderStore(state => state.newOrder);
  const { addToast } = useToast();

  const canProceed = () => {
    const errors = validateBuyer(order.buyer);
    
    if (order.items.length === 0) {
      addToast('Please add at least one item to the quotation', 'warning');
      return false;
    }
    
    if (errors.length > 0) {
      addToast(`Please fill in: ${errors.join(', ')}`, 'error');
      return false;
    }
    
    return true;
  };

  const handleExportExcel = async () => {
    if (!canProceed()) return;
    // Loaded on demand — keeps the ~400KB xlsx library out of the initial bundle
    const XLSX = await import('xlsx');
    
    const country = getCountryByCode(order.buyer?.nationality || '');
    
    const buyerInfo = [
      ['Quotation'],
      [],
      ['Buyer Information'],
      ['Name', order.buyer?.name || ''],
      ['Company', order.buyer?.company || ''],
      ['Email', order.buyer?.email || ''],
      ['Phone', order.buyer?.phone || ''],
      ['Nationality', country ? `${country.flag} ${country.name}` : ''],
      [],
    ];

    const headers = ['SKU', 'Collection', 'Description', 'Category', 'Subcategory', 'Unit Price', 'Qty', 'Weight (kg)', 'Carton L', 'Carton W', 'Carton H', 'Inner Qty', 'Carton Qty'];
    const rows = order.items.map(item => [
      item.sku,
      item.collection || '',
      item.description,
      item.category || '',
      item.subcategory || '',
      item.unitPrice,
      item.quantity,
      item.weight || '',
      item.cartonL || '',
      item.cartonW || '',
      item.cartonH || '',
      item.innerQty || '',
      item.cartonQty,
    ]);

    const totals = [
      [],
      ['Subtotal', '', '', '', '', order.subtotal],
      ['Total Items', '', '', '', '', '', order.totalItems],
      ['Total Cartons (est.)', '', '', '', '', '', '', '', '', '', '', '', order.totalCartons],
    ];

    const notesSection = order.buyer?.notes ? [
      [],
      ['Notes'],
      [order.buyer.notes],
    ] : [];

    const data = [...buyerInfo, headers, ...rows, ...totals, ...notesSection];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
    XLSX.writeFile(wb, `quotation-${order.id}.xlsx`);
    addToast('Quotation exported!', 'success');
  };

  const handleEmail = () => {
    if (!canProceed()) return;
    
    const buyer = order.buyer;
    const country = getCountryByCode(buyer?.nationality || '');
    const subject = encodeURIComponent(`Quotation - ${buyer?.company || buyer?.name || order.id}`);
    
    let body = `Quotation Summary\n${'='.repeat(40)}\n\n`;
    if (buyer) {
      body += `Buyer: ${buyer.name || ''}\n`;
      if (buyer.company) body += `Company: ${buyer.company}\n`;
      if (country) body += `Nationality: ${country.flag} ${country.name}\n`;
      if (buyer.phone) body += `Phone: ${buyer.phone}\n`;
      body += `\n`;
    }
    
    body += `Items: ${order.totalItems}\n`;
    body += `Cartons (est.): ${order.totalCartons}\n`;
    body += `Subtotal: ${formatPrice(order.subtotal)}\n\n`;
    body += `Items:\n${'-'.repeat(40)}\n`;
    
    order.items.forEach(item => {
      body += `${item.sku} - ${item.description}\n`;
      body += `  ${formatPrice(item.unitPrice)} / unit\n`;
    });
    
    if (buyer?.notes) {
      body += `\nNotes:\n${'-'.repeat(40)}\n${buyer.notes}\n`;
    }
    
    // mailto: URLs break around ~2000 chars in common browsers/mail clients —
    // truncate the body at a line boundary and warn the user.
    if (encodeURIComponent(body).length > 1800) {
      let truncated = body;
      while (encodeURIComponent(truncated).length > 1800) {
        const cut = truncated.lastIndexOf('\n');
        if (cut === -1) {
          truncated = truncated.slice(0, 600);
          break;
        }
        truncated = truncated.slice(0, cut);
      }
      body = truncated + '\n\n[...truncated — use Export Excel for the full quote]\n';
      addToast('Quote is long — the email was truncated. Use Export Excel for the full details.', 'warning', 5000);
    }
    
    const mailto = `mailto:${buyer?.email || ''}?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handleNewQuote = () => {
    newOrder();
    addToast('New quotation started', 'success');
  };

  const missingFields = validateBuyer(order.buyer);

  return (
    <div 
      className="sticky bottom-0 border-t border-[var(--border-soft)]"
      style={{ background: 'var(--bg-card)' }}
    >
      <div className="px-4 pt-4 pb-4 space-y-4" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        {missingFields.length > 0 && (
          <div 
            className="flex items-start gap-2 p-3 rounded-lg border"
            style={{ 
              background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)',
            }}
          >
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} className="flex-shrink-0 mt-0.5" />
            <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
              <span className="font-semibold">Missing required fields:</span>
              <span className="ml-1">{missingFields.join(', ')}</span>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>
              Subtotal
            </span>
            <span 
              className="font-mono font-semibold"
              style={{ color: 'var(--accent)', fontSize: 'var(--text-body)' }}
            >
              {formatPrice(order.subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-small)' }}>
              Total Items
            </span>
            <span 
              className="font-medium"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--text-small)' }}
            >
              {order.totalItems} pcs
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-small)' }}>
              Total Cartons
            </span>
            <span 
              className="font-medium"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--text-small)' }}
            >
              {order.totalCartons} ctns
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleExportExcel}
              className="btn-primary w-full"
            >
              <Download size={18} />
              Export Excel
            </button>
            <button
              onClick={handleEmail}
              className="btn-secondary w-full"
            >
              <Mail size={18} />
              Email Quote
            </button>
          </div>
          <button
            onClick={handleNewQuote}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all duration-150 active:scale-[0.97]",
              "bg-transparent hover:bg-[var(--danger)]/10"
            )}
            style={{ color: 'var(--danger)' }}
          >
            <FileText size={18} />
            New Quote
          </button>
        </div>
      </div>
    </div>
  );
}
