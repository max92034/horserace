import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn } from 'lucide-react';

export default function Login() {
  const signIn = useAuthStore(state => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
    // on success, App redirects to /
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
            Sign in to browse the product catalog
          </p>
        </div>

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
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>
              {error}
            </p>
          )}

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
      </div>
    </div>
  );
}
