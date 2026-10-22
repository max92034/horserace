import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { LogIn, Mail, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const signIn = useAuthStore(state => state.signIn);
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await signIn(email.trim().toLowerCase(), password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
    // on success, App redirects to /
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setNotice('Check your email for a password reset link.');
    }
  };

  const switchMode = (next: 'signin' | 'forgot') => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <img
            src={`${import.meta.env.BASE_URL}assets/logo-desmo.png`}
            alt="DESMO Logo"
            className="h-16 object-contain mb-4"
          />
          <h1
            className="gradient-heading font-bold text-[var(--text-primary)]"
            style={{ fontSize: 'var(--text-h1)' }}
          >
            Horserace Catalog
          </h1>
          <p className="mt-2" style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
            {mode === 'signin'
              ? 'Sign in to browse the product catalog'
              : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {mode === 'forgot' ? (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label
                htmlFor="reset-email"
                className="block mb-1 text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p role="alert" style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>
                {error}
              </p>
            )}
            {notice && (
              <p role="status" style={{ fontSize: 'var(--text-small)', color: 'var(--success)' }}>
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
              style={submitting ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <Mail size={18} />
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="w-full text-center font-medium hover:underline"
              style={{ fontSize: 'var(--text-small)', color: 'var(--accent)' }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block mb-1 text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="block mb-1 text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>
              {error}
            </p>
          )}

            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="w-full text-right font-medium hover:underline"
              style={{ fontSize: 'var(--text-small)', color: 'var(--accent)' }}
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
              style={submitting ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <LogIn size={18} />
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
