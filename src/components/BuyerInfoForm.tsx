import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { useOrderStore } from '../store/useOrderStore';
import { countries } from '../data/countries';
import { cn } from '../lib/utils';

export function BuyerInfoForm() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalityQuery, setNationalityQuery] = useState('');
  const buyer = useOrderStore(state => state.currentOrder.buyer);
  const setBuyer = useOrderStore(state => state.setBuyer);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNationalityOpen(false);
      }
    }
    if (nationalityOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [nationalityOpen]);

  const filteredCountries = nationalityQuery
    ? countries.filter(c => 
        c.name.toLowerCase().includes(nationalityQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(nationalityQuery.toLowerCase())
      )
    : countries;

  const selectedCountry = countries.find(c => c.code === buyer?.nationality);

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailInvalid = !!buyer?.email?.trim() && !EMAIL_PATTERN.test(buyer.email.trim());

  const handleSelectCountry = (code: string) => {
    setBuyer({ nationality: code });
    setNationalityOpen(false);
    setNationalityQuery('');
  };

  const requiredFields = {
    name: !buyer?.name?.trim(),
    company: !buyer?.company?.trim(),
    email: !buyer?.email?.trim(),
    nationality: !buyer?.nationality,
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p 
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            Buyer Information
          </p>
          {buyer?.name && (
            <p 
              className="mt-0.5 font-medium truncate max-w-[280px]"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}
            >
              {buyer.company || buyer.name}
            </p>
          )}
        </div>
        <div 
          className="icon-btn"
          style={{ color: 'var(--text-muted)' }}
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>
      
      <div className={cn(
        "grid transition-all duration-300",
        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label 
                  className="block mb-1 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={buyer?.name || ''}
                  onChange={(e) => setBuyer({ name: e.target.value })}
                  className={cn(
                    "input-field",
                    requiredFields.name && "input-field-error"
                  )}
                  placeholder="Enter name"
                />
              </div>
              
              <div>
                <label 
                  className="block mb-1 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Company <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={buyer?.company || ''}
                  onChange={(e) => setBuyer({ company: e.target.value })}
                  className={cn(
                    "input-field",
                    requiredFields.company && "input-field-error"
                  )}
                  placeholder="Enter company"
                />
              </div>
              
              <div>
                <label 
                  className="block mb-1 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Email <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="email"
                  value={buyer?.email || ''}
                  onChange={(e) => setBuyer({ email: e.target.value })}
                  className={cn(
                    "input-field",
                    (requiredFields.email || emailInvalid) && "input-field-error"
                  )}
                  placeholder="Enter email"
                />
                {emailInvalid && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--danger)' }}
                  >
                    Please enter a valid email address
                  </p>
                )}
              </div>
              
              <div className="relative" ref={dropdownRef}>
                <label 
                  className="block mb-1 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Nationality <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setNationalityOpen(!nationalityOpen)}
                  className={cn(
                    "input-field flex items-center justify-between text-left",
                    requiredFields.nationality && "input-field-error"
                  )}
                >
                  <span className={cn(
                    "flex items-center gap-2",
                    buyer?.nationality ? "" : "text-[var(--text-muted)]"
                  )}>
                    {selectedCountry ? (
                      <>
                        <span 
                          className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                        >
                          {selectedCountry.code}
                        </span>
                        <span style={{ color: 'var(--text-primary)' }}>{selectedCountry.name}</span>
                      </>
                    ) : (
                      'Select country'
                    )}
                  </span>
                  <Globe size={18} style={{ color: 'var(--text-muted)' }} />
                </button>
                
                {nationalityOpen && (
                  <div 
                    className="absolute top-full left-0 right-0 mt-1 border border-[var(--border-soft)] rounded-lg shadow-[var(--shadow-lg)] z-20 max-h-60 overflow-hidden flex flex-col"
                    style={{ background: 'var(--bg-card)' }}
                  >
                    <div className="p-2 border-b border-[var(--border-soft)]">
                      <input
                        type="text"
                        placeholder="Search country..."
                        value={nationalityQuery}
                        onChange={(e) => setNationalityQuery(e.target.value)}
                        className="input-field py-2 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredCountries.length === 0 ? (
                        <div 
                          className="p-3 text-sm text-center"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          No countries found
                        </div>
                      ) : (
                        filteredCountries.map(country => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => handleSelectCountry(country.code)}
                            className={cn(
                              "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                              buyer?.nationality === country.code 
                                ? "bg-[var(--accent-soft)]" 
                                : "hover:bg-[var(--bg-secondary)]"
                            )}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <span 
                              className="inline-flex items-center justify-center w-10 px-1 py-0.5 rounded text-xs font-bold flex-shrink-0"
                              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                            >
                              {country.code}
                            </span>
                            <span className="truncate">{country.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label 
                  className="block mb-1 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Phone
                </label>
                <input
                  type="tel"
                  value={buyer?.phone || ''}
                  onChange={(e) => setBuyer({ phone: e.target.value })}
                  className="input-field"
                  placeholder="Enter phone"
                />
              </div>
              
              <div>
                <label 
                  className="block mb-1 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Website
                </label>
                <input
                  type="url"
                  value={buyer?.website || ''}
                  onChange={(e) => setBuyer({ website: e.target.value })}
                  className="input-field"
                  placeholder="Enter website"
                />
              </div>
            </div>
            
            <div>
              <label 
                className="block mb-1 text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Notes
              </label>
              <div className="relative">
                <textarea
                  value={buyer?.notes || ''}
                  onChange={(e) => setBuyer({ notes: e.target.value })}
                  rows={3}
                  className="input-field resize-none pr-10"
                  placeholder="Add notes..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
