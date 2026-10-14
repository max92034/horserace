import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { KeyRound, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const clearPasswordRecovery = useAuthStore(state => state.clearPasswordRecovery);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => {
      clearPasswordRecovery();
      navigate('/', { replace: true });
    }, 2000);
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
            Reset Password
          </h1>
          <p className="mt-2" style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
            Choose a new password for your account
          </p>
        </div>

        {success ? (
          <p
            role="status"
            className="text-center"
            style={{ fontSize: 'var(--text-body)', color: 'var(--success)' }}
          >
            Password updated! Redirecting...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block mb-1 text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-11"
                  placeholder="At least 8 characters"
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
            <div>
              <label
                htmlFor="confirm-password"
                className="block mb-1 text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-field pr-11"
                  placeholder="Repeat your new password"
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
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
              style={submitting ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <KeyRound size={18} />
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
