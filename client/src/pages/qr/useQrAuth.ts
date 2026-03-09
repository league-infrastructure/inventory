import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  avatar: string | null;
  role: string;
}

export function useQrAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signInUrl = `/api/auth/google?returnTo=${encodeURIComponent(location.pathname)}`;

  return { user, loading, signInUrl };
}
