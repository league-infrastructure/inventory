import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

interface QrInfo {
  type: string;
  id: number;
  name: string;
  qrDataUrl?: string;
}

export default function QrLanding() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Determine type from path
  const isKit = location.pathname.startsWith('/k/');
  const isComputer = location.pathname.startsWith('/c/');
  const typePrefix = isKit ? 'k' : isComputer ? 'c' : 'p';
  const detailPath = isKit ? `/kits/${id}` : isComputer ? `/computers/${id}` : `/packs/${id}`;

  useEffect(() => {
    // Check if user is authenticated
    fetch('/api/auth/me')
      .then((r) => {
        if (r.ok) {
          // Authenticated — redirect to detail page
          navigate(detailPath, { replace: true });
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => setCheckingAuth(false));
  }, [navigate, detailPath]);

  useEffect(() => {
    if (checkingAuth) return;
    fetch(`/api/qr/${typePrefix}/${id}`)
      .then((r) => {
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => { if (data) setInfo(data); })
      .catch(() => setNotFound(true));
  }, [id, typePrefix, checkingAuth]);

  if (checkingAuth) {
    return <div style={styles.container}><p>Loading...</p></div>;
  }

  if (notFound) {
    return (
      <div style={styles.container}>
        <h1>Not Found</h1>
        <p>This QR code does not match any inventory item.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>LAP Inventory</h1>
      {info && (
        <div style={styles.card}>
          <p style={styles.type}>{info.type}</p>
          <h2>{info.name}</h2>
          <p style={styles.hint}>Sign in to view full details.</p>
          <a href="/api/auth/google" style={styles.btn}>
            Sign in with Google
          </a>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 400, margin: '80px auto', padding: '0 1rem', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center' },
  title: { fontSize: '2rem', marginBottom: '1.5rem' },
  card: { padding: '2rem', border: '1px solid #e0e0e0', borderRadius: 12, background: '#fafafa' },
  type: { fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  hint: { color: '#888', fontSize: '0.9rem', margin: '1rem 0' },
  btn: { display: 'inline-block', fontSize: '1rem', padding: '0.6em 2em', border: 'none', borderRadius: 8, background: '#4f46e5', color: 'white', textDecoration: 'none' },
};
