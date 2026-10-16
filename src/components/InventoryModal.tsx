import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ClipboardList, MapPin, Trash2, Download, FileSpreadsheet,
  CheckCircle, AlertTriangle, HelpCircle, ChevronLeft, Play, RotateCcw, ScanLine, Package, Keyboard,
} from 'lucide-react';
import { InventorySession } from '../types';
import { useProductStore } from '../store/useProductStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useToast } from '../store/useToastStore';
import { useModalA11y } from '../hooks/useModalA11y';
import { analyzeSession, exportReportCsv, exportScansCsv } from '../utils/inventory';
import { cn } from '../lib/utils';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = 'home' | 'scan' | 'report';

const normLoc = (s: string) => s.trim().toLowerCase();

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const [view, setView] = useState<View>('home');
  const products = useProductStore(state => state.products);
  const sessions = useInventoryStore(state => state.sessions);
  const activeSessionId = useInventoryStore(state => state.activeSessionId);
  const startSession = useInventoryStore(state => state.startSession);
  const addScan = useInventoryStore(state => state.addScan);
  const removeScan = useInventoryStore(state => state.removeScan);
  const completeSession = useInventoryStore(state => state.completeSession);
  const resumeSession = useInventoryStore(state => state.resumeSession);
  const deleteSession = useInventoryStore(state => state.deleteSession);
  const { addToast } = useToast();
  const modalRef = useModalA11y(isOpen, onClose);

  // Location picker state
  const [locationInput, setLocationInput] = useState('');
  const [locDropdownOpen, setLocDropdownOpen] = useState(false);
  const locDropdownRef = useRef<HTMLDivElement>(null);

  // Scan view state
  const [scanInput, setScanInput] = useState('');
  const [lastResult, setLastResult] = useState<{ kind: 'matched' | 'misplaced' | 'unknown'; sku: string; dbLocation?: string } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  // Buffer for document-level scanner capture — a BT scanner is an HID
  // keyboard and doesn't care where DOM focus is, so we listen globally.
  const scanBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hide the on-screen keyboard by default on touch devices — a BT scanner
  // user doesn't need it, and it covers half the screen. Toggle brings it back.
  const [softKeyboard, setSoftKeyboard] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  const productBySku = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    for (const p of products) map.set(p.sku.toLowerCase(), p);
    return map;
  }, [products]);

  const distinctLocations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) {
      const loc = p.location.trim();
      if (loc && !seen.has(normLoc(loc))) seen.set(normLoc(loc), loc);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredLocations = useMemo(() => {
    const q = normLoc(locationInput);
    if (!q) return distinctLocations;
    return distinctLocations.filter(l => normLoc(l).includes(q));
  }, [distinctLocations, locationInput]);

  // Reset to home whenever the modal opens; focus scan input in scan view.
  useEffect(() => {
    if (isOpen) {
      setView('home');
      setLocationInput('');
      setScanInput('');
      setLastResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (view === 'scan') {
      // Slight delay lets the view render before stealing focus.
      const t = setTimeout(() => scanInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [view]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (locDropdownRef.current && !locDropdownRef.current.contains(e.target as Node)) {
        setLocDropdownOpen(false);
      }
    }
    if (locDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [locDropdownOpen]);

  // Document-level scanner capture. A Bluetooth scanner is an HID keyboard:
  // on a phone, DOM focus is unreliable (iOS blocks programmatic focus, taps
  // elsewhere steal it), so as long as the scan view is open we collect
  // keystrokes globally. Keystrokes landing in our own field are left to the
  // field's own handler to avoid double-counting.
  // NOTE: must stay above the `if (!isOpen) return null` early-return below —
  // hooks after an early return change hook count between renders and crash React.
  useEffect(() => {
    if (!isOpen || view !== 'scan') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target === scanInputRef.current) return;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const flush = () => {
        const sku = scanBufferRef.current;
        scanBufferRef.current = '';
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
        processScan(sku);
      };

      // Scanners typically suffix with Enter; some use Tab instead.
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        flush();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        scanBufferRef.current += e.key;
        // Fallback for scanners with no suffix: flush after a short pause.
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => {
          const sku = scanBufferRef.current;
          scanBufferRef.current = '';
          if (sku.length >= 4) processScan(sku);
        }, 300);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      scanBufferRef.current = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, view, activeSession, productBySku]);

  if (!isOpen) return null;

  const canStart = locationInput.trim().length > 0;

  const handleStart = () => {
    if (!canStart) return;
    startSession(locationInput);
    setLocationInput('');
    setLocDropdownOpen(false);
    setView('scan');
  };

  const processScan = (rawSku: string) => {
    const sku = rawSku.trim();
    if (!sku || !activeSession) return;
    const result = addScan(sku);
    if (result === 'duplicate') {
      addToast(`${sku} already scanned`, 'warning');
    } else {
      const product = productBySku.get(sku.toLowerCase());
      if (!product) {
        setLastResult({ kind: 'unknown', sku });
      } else if (normLoc(product.location) !== normLoc(activeSession.location)) {
        setLastResult({ kind: 'misplaced', sku: product.sku, dbLocation: product.location });
      } else {
        setLastResult({ kind: 'matched', sku: product.sku });
      }
    }
  };

  const handleScanSubmit = () => {
    processScan(scanInput);
    setScanInput('');
    scanInputRef.current?.focus();
  };

  const handleComplete = () => {
    if (!activeSession) return;
    completeSession(activeSession.id);
    setView('report');
  };

  const statusOf = (sku: string, session: InventorySession) => {
    const product = productBySku.get(sku.toLowerCase());
    if (!product) return 'unknown' as const;
    if (normLoc(product.location) !== normLoc(session.location)) return 'misplaced' as const;
    return 'matched' as const;
  };

  // The report view needs a session even after completion cleared activeSessionId —
  // use the most recently updated session when none is active.
  const reportSession = activeSession ?? sessions[0] ?? null;
  const analysis = reportSession ? analyzeSession(reportSession, products) : null;

  const chip = (label: string, count: number, colorVar: string) => (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold"
      style={{
        fontSize: 'var(--text-small)',
        background: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
        color: colorVar,
      }}
    >
      {label}: {count}
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-modal">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Inventory Check"
        tabIndex={-1}
        className="bg-[var(--bg-card)] w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl sm:shadow-xl shadow-2xl max-h-[92vh] flex flex-col animate-slide-up sm:animate-scale-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-soft)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {view !== 'home' && (
              <button
                onClick={() => setView('home')}
                className="icon-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                aria-label="Back"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <ClipboardList size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold" style={{ fontSize: 'var(--text-h3)', color: 'var(--text-primary)' }}>
                Inventory Check
              </h2>
              {view !== 'home' && reportSession && (
                <p className="flex items-center gap-1 truncate" style={{ fontSize: 'var(--text-caption)', color: 'var(--text-muted)' }}>
                  <MapPin size={12} />
                  {reportSession.location}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ============ HOME: pick location + session history ============ */}
          {view === 'home' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-1" style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}>
                  Start a session
                </h3>
                <p className="mb-3" style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                  Pick the location you are physically standing at, then scan or type SKUs.
                </p>
                <div className="relative" ref={locDropdownRef}>
                  <MapPin
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => { setLocationInput(e.target.value); setLocDropdownOpen(true); }}
                    onFocus={() => setLocDropdownOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
                    placeholder="Location (required) — e.g. A-01"
                    className="input-field w-full pl-9"
                    aria-label="Session location"
                  />
                  {locDropdownOpen && filteredLocations.length > 0 && (
                    <div
                      className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border shadow-lg"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-soft)' }}
                    >
                      {filteredLocations.map(loc => (
                        <button
                          key={loc}
                          onClick={() => { setLocationInput(loc); setLocDropdownOpen(false); }}
                          className="w-full text-left px-3 py-2 transition-colors hover:bg-[var(--bg-secondary)]"
                          style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className={cn('btn-primary w-full mt-3', !canStart && 'opacity-50 cursor-not-allowed')}
                >
                  <Play size={18} />
                  Start Scanning
                </button>
              </div>

              {sessions.length > 0 && (
                <div className="border-t border-[var(--border-soft)] pt-4">
                  <h3 className="font-semibold mb-3" style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}>
                    Sessions
                  </h3>
                  <div className="space-y-2">
                    {sessions.map(session => (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate" style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}>
                              {session.location}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                              style={{
                                fontSize: 'var(--text-caption)',
                                background: session.status === 'active' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'var(--bg-elevated)',
                                color: session.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                              }}
                            >
                              {session.status}
                            </span>
                          </div>
                          <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                            {session.scans.length} scanned · {formatDate(session.updatedAt)}
                          </p>
                        </div>
                        {session.status === 'active' ? (
                          <button
                            onClick={() => { resumeSession(session.id); setView('scan'); }}
                            className="btn-primary"
                            style={{ paddingTop: '6px', paddingBottom: '6px' }}
                          >
                            <Play size={16} />
                            Resume
                          </button>
                        ) : (
                          <button
                            onClick={() => { resumeSession(session.id); setView('report'); }}
                            className="btn-ghost"
                            style={{ color: 'var(--accent)' }}
                          >
                            <FileSpreadsheet size={16} />
                            Report
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete the session for "${session.location}" (${session.scans.length} scans)?`)) {
                              deleteSession(session.id);
                            }
                          }}
                          className="icon-btn text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
                          aria-label="Delete session"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ SCAN: input + live feedback + scan list ============ */}
          {view === 'scan' && activeSession && (
            <div className="space-y-4">
              <div className="relative">
                <ScanLine
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleScanSubmit(); } }}
                  placeholder="Scan or type SKU, then Enter"
                  className="input-field w-full pl-9 pr-12 font-mono"
                  aria-label="Scan SKU"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  enterKeyHint="go"
                  inputMode={softKeyboard ? 'text' : 'none'}
                />
                <button
                  onClick={() => {
                    setSoftKeyboard(k => !k);
                    scanInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors"
                  style={{ color: softKeyboard ? 'var(--accent)' : 'var(--text-muted)' }}
                  aria-label={softKeyboard ? 'Hide on-screen keyboard' : 'Show on-screen keyboard'}
                  aria-pressed={softKeyboard}
                >
                  <Keyboard size={18} />
                </button>
              </div>

              {lastResult && (
                <div
                  role="status"
                  className="flex items-center gap-2 p-3 rounded-lg border"
                  style={
                    lastResult.kind === 'matched'
                      ? { background: 'color-mix(in srgb, var(--success) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)', color: 'var(--success)' }
                      : lastResult.kind === 'misplaced'
                      ? { background: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)', color: 'var(--warning)' }
                      : { background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)', color: 'var(--danger)' }
                  }
                >
                  {lastResult.kind === 'matched' && <CheckCircle size={18} />}
                  {lastResult.kind === 'misplaced' && <AlertTriangle size={18} />}
                  {lastResult.kind === 'unknown' && <HelpCircle size={18} />}
                  <span className="font-semibold" style={{ fontSize: 'var(--text-small)' }}>
                    {lastResult.kind === 'matched' && `${lastResult.sku} — OK`}
                    {lastResult.kind === 'misplaced' && `${lastResult.sku} — DB says location: ${lastResult.dbLocation || '(none)'}`}
                    {lastResult.kind === 'unknown' && `${lastResult.sku} — not in catalog`}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {chip('Scanned', activeSession.scans.length, 'var(--accent)')}
                {analysis && chip('Matched', analysis.matched.length, 'var(--success)')}
                {analysis && chip('Misplaced', analysis.misplaced.length, 'var(--warning)')}
                {analysis && chip('Unknown', analysis.unknown.length, 'var(--danger)')}
              </div>

              {activeSession.scans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Package size={40} strokeWidth={1} style={{ color: 'var(--text-muted)' }} className="mb-3" />
                  <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No scans yet</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Scan a barcode or type a SKU and press Enter
                  </p>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-soft)' }}>
                  {activeSession.scans.map(scan => {
                    const st = statusOf(scan.sku, activeSession);
                    const product = productBySku.get(scan.sku.toLowerCase());
                    return (
                      <div
                        key={scan.sku}
                        className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0"
                        style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-secondary)' }}
                      >
                        {st === 'matched' && <CheckCircle size={16} style={{ color: 'var(--success)' }} className="flex-shrink-0" />}
                        {st === 'misplaced' && <AlertTriangle size={16} style={{ color: 'var(--warning)' }} className="flex-shrink-0" />}
                        {st === 'unknown' && <HelpCircle size={16} style={{ color: 'var(--danger)' }} className="flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="font-mono font-semibold" style={{ fontSize: 'var(--text-small)', color: 'var(--text-primary)' }}>
                            {scan.sku}
                          </span>
                          {product && (
                            <span className="ml-2 truncate" style={{ fontSize: 'var(--text-caption)', color: 'var(--text-muted)' }}>
                              {product.description}
                            </span>
                          )}
                          {st === 'misplaced' && (
                            <span className="ml-2" style={{ fontSize: 'var(--text-caption)', color: 'var(--warning)' }}>
                              DB: {product?.location || '(none)'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeScan(scan.sku)}
                          className="icon-btn text-[var(--text-muted)] hover:text-[var(--danger)]"
                          style={{ width: '28px', height: '28px' }}
                          aria-label={`Remove ${scan.sku}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============ REPORT: mismatch analysis + export ============ */}
          {view === 'report' && reportSession && analysis && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {chip('Matched', analysis.matched.length, 'var(--success)')}
                {chip('Misplaced', analysis.misplaced.length, 'var(--warning)')}
                {chip('Unknown', analysis.unknown.length, 'var(--danger)')}
                {chip('Missing', analysis.missing.length, 'var(--accent)')}
              </div>

              {analysis.misplaced.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ fontSize: 'var(--text-body)', color: 'var(--warning)' }}>
                    <AlertTriangle size={16} />
                    Misplaced — scanned here, DB says elsewhere ({analysis.misplaced.length})
                  </h3>
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-soft)' }}>
                    {analysis.misplaced.map(({ product }) => (
                      <div key={product.sku} className="px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-secondary)' }}>
                        <span className="font-mono font-semibold" style={{ fontSize: 'var(--text-small)', color: 'var(--text-primary)' }}>{product.sku}</span>
                        <span className="ml-2" style={{ fontSize: 'var(--text-caption)', color: 'var(--text-muted)' }}>{product.description}</span>
                        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--warning)' }}>
                          DB: {product.location || '(none)'} → scanned at: {reportSession.location}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.unknown.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ fontSize: 'var(--text-body)', color: 'var(--danger)' }}>
                    <HelpCircle size={16} />
                    Unknown — not in catalog ({analysis.unknown.length})
                  </h3>
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-soft)' }}>
                    {analysis.unknown.map(scan => (
                      <div key={scan.sku} className="px-3 py-2 border-b last:border-b-0 font-mono" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-secondary)', fontSize: 'var(--text-small)', color: 'var(--text-primary)' }}>
                        {scan.sku}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.missing.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ fontSize: 'var(--text-body)', color: 'var(--accent)' }}>
                    <Package size={16} />
                    Missing — DB has them at {reportSession.location}, not scanned ({analysis.missing.length})
                  </h3>
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-soft)' }}>
                    {analysis.missing.map(p => (
                      <div key={p.sku} className="px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-secondary)' }}>
                        <span className="font-mono font-semibold" style={{ fontSize: 'var(--text-small)', color: 'var(--text-primary)' }}>{p.sku}</span>
                        <span className="ml-2" style={{ fontSize: 'var(--text-caption)', color: 'var(--text-muted)' }}>{p.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.misplaced.length === 0 && analysis.unknown.length === 0 && analysis.missing.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle size={44} style={{ color: 'var(--success)' }} className="mb-3" />
                  <p className="font-semibold" style={{ color: 'var(--success)' }}>All clear</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Everything scanned at {reportSession.location} matches the catalog.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => { exportReportCsv(reportSession, products); addToast('Report exported', 'success'); }}
                  className="btn-primary"
                >
                  <FileSpreadsheet size={18} />
                  Export Report CSV
                </button>
                <button
                  onClick={() => { exportScansCsv(reportSession); addToast('Scans exported', 'success'); }}
                  className="btn-secondary"
                >
                  <Download size={18} />
                  Export Scans CSV
                </button>
              </div>
              <button
                onClick={() => { resumeSession(reportSession.id); setView('scan'); }}
                className="btn-ghost w-full"
                style={{ color: 'var(--accent)' }}
              >
                <RotateCcw size={16} />
                Resume scanning this location
              </button>
            </div>
          )}
        </div>

        {/* Footer for scan view */}
        {view === 'scan' && activeSession && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-soft)] flex-shrink-0">
            <button
              onClick={() => { exportScansCsv(activeSession); addToast('Scans exported', 'success'); }}
              className="btn-ghost"
              disabled={activeSession.scans.length === 0}
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={handleComplete}
              className="btn-primary"
              disabled={activeSession.scans.length === 0}
            >
              <CheckCircle size={18} />
              Complete & View Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
