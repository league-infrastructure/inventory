import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  avatar: string | null;
  role: string;
}

export default function Landing() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.hint}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>LAP Inventory</h1>
      <p style={styles.subtitle}>
        Equipment tracking for the League of Amazing Programmers
      </p>

      {user ? (
        <div style={styles.card}>
          <div style={styles.profile}>
            {user.avatar && (
              <img src={user.avatar} alt="" style={styles.avatar} />
            )}
            <div>
              <strong>{user.displayName}</strong>
              <br />
              <span style={styles.hint}>{user.email}</span>
              <br />
              <span style={styles.roleBadge}>
                {user.role === 'QUARTERMASTER' ? 'Quartermaster' : 'Instructor'}
              </span>
            </div>
          </div>

          <div style={styles.nav}>
            <Link to="/kits" style={styles.navLink}>
              Kits
            </Link>
            {user.role === 'QUARTERMASTER' && (
              <>
                <Link to="/computers" style={styles.navLink}>
                  Computers
                </Link>
                <Link to="/sites" style={styles.navLink}>
                  Manage Sites
                </Link>
              </>
            )}
            <Link to="/admin" style={styles.navLink}>
              Admin Dashboard
            </Link>
          </div>

          <button style={styles.btnSecondary} onClick={handleLogout}>
            Logout
          </button>
        </div>
      ) : (
        <div style={styles.card}>
          <p style={{ marginBottom: '1rem' }}>
            Sign in with your jointheleague.org Google account to get started.
          </p>
          <a href="/api/auth/google" style={styles.btn}>
            Sign in with Google
          </a>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '80px auto',
    padding: '0 1rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
  },
  title: {
    fontSize: '2.5rem',
    marginBottom: '0.25rem',
  },
  subtitle: {
    color: '#888',
    fontSize: '1rem',
    marginBottom: '2rem',
  },
  card: {
    padding: '2rem',
    border: '1px solid #e0e0e0',
    borderRadius: 12,
    background: '#fafafa',
  },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    textAlign: 'left' as const,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
  },
  roleBadge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    padding: '0.2em 0.6em',
    background: '#4f46e5',
    color: 'white',
    borderRadius: 4,
    marginTop: '0.25rem',
  },
  hint: {
    color: '#888',
    fontSize: '0.85rem',
  },
  nav: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  navLink: {
    display: 'inline-block',
    fontSize: '0.9rem',
    padding: '0.5em 1.25em',
    border: '1px solid #4f46e5',
    borderRadius: 8,
    color: '#4f46e5',
    textDecoration: 'none',
  },
  btn: {
    display: 'inline-block',
    fontSize: '1rem',
    padding: '0.6em 2em',
    border: 'none',
    borderRadius: 8,
    background: '#4f46e5',
    color: 'white',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  btnSecondary: {
    fontSize: '0.9rem',
    padding: '0.4em 1.5em',
    border: 'none',
    borderRadius: 8,
    background: '#6b7280',
    color: 'white',
    cursor: 'pointer',
  },
};
