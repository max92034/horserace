import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, LogOut, Menu, Moon, Settings, Sparkles, Sun, Trophy, Upload, X } from 'lucide-react';
import { useSettingsStore, ThemeMode } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../lib/utils';

interface MobileMenuProps {
  onUploadClick: () => void;
  onHistoryClick: () => void;
  onSettingsClick: () => void;
}

const themeIconMap: Record<ThemeMode, React.ReactNode> = {
  light: <Sun size={18} strokeWidth={1.5} />,
  dark: <Moon size={18} strokeWidth={1.5} />,
  gold: <Sparkles size={18} strokeWidth={1.5} />,
  lakers: <Trophy size={18} strokeWidth={1.5} />,
};

const themeLabelMap: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  gold: 'Gold',
  lakers: 'Lakers',
};

export function MobileMenu({ onUploadClick, onHistoryClick, onSettingsClick }: MobileMenuProps) {
  const theme = useSettingsStore(state => state.theme);
  const toggleTheme = useSettingsStore(state => state.toggleTheme);
  const isAdmin = useAuthStore(state => state.isAdmin);
  const signOut = useAuthStore(state => state.signOut);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | globalThis.TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    closeMenu();
  }, [toggleTheme, closeMenu]);

  return (
    <div className="relative sm:hidden" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 active:scale-95"
        style={{
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
      </button>

      <div
        className={cn(
          "absolute right-0 top-12 w-64 rounded-2xl shadow-xl overflow-hidden z-50",
          "transition-all duration-200 origin-top-right",
          menuOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => {
            onSettingsClick();
            closeMenu();
          }}
          className="w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Settings size={18} strokeWidth={1.5} />
          <div className="flex-1 text-left">
            <div className="font-medium text-sm">Settings</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>设置</div>
          </div>
        </button>

        <button
          onClick={handleThemeToggle}
          className="w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200"
          style={{
            color: 'var(--text-secondary)',
            borderTop: '1px solid var(--border-soft)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {themeIconMap[theme]}
          <div className="flex-1 text-left">
            <div className="font-medium text-sm">
              Theme: {themeLabelMap[theme]}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Tap to switch / 点击切换
            </div>
          </div>
          <div
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            {theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '✨'}
          </div>
        </button>

        <div style={{ borderTop: '1px solid var(--border-soft)' }}>
          <button
            onClick={() => {
              onHistoryClick();
              closeMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <History size={18} strokeWidth={1.5} />
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Order History</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>订单历史</div>
            </div>
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                onUploadClick();
                closeMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <Upload size={18} strokeWidth={1.5} />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">Upload Products</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>上传产品</div>
              </div>
            </button>
          )}

          <button
            onClick={() => {
              void signOut();
              closeMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <LogOut size={18} strokeWidth={1.5} />
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">Sign Out</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>登出</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
