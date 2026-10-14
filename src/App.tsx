import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import { ToastContainer } from "@/components/Toast";
import { useSettingsStore } from './store/useSettingsStore';
import { useAuthStore } from './store/useAuthStore';

function Splash() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>Loading...</p>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useAuthStore(state => state.session);
  const loading = useAuthStore(state => state.loading);
  const location = useLocation();

  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function LoginRoute() {
  const session = useAuthStore(state => state.session);
  const loading = useAuthStore(state => state.loading);

  if (loading) return <Splash />;
  if (session) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  const theme = useSettingsStore(state => state.theme);
  const initAuth = useAuthStore(state => state.init);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-gold', 'theme-lakers');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <HashRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/*"
          element={
            <AuthGate>
              <Home />
            </AuthGate>
          }
        />
      </Routes>
    </HashRouter>
  );
}
