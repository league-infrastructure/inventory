import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Kit {
  id: number;
  name: string;
  status: string;
  qrCode: string | null;
  site: { id: number; name: string };
}

export default function KitList() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  useEffect(() => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : '';
    fetch(`/api/kits${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load kits');
        return r.json();
      })
      .then(setKits)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Kits</h1>
        <Link to="/kits/new" style={styles.btn}>
          + New Kit
        </Link>
      </div>

      <div style={styles.filterRow}>
        <label>
          Status:{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="RETIRED">Retired</option>
          </select>
        </label>
      </div>

      {loading && <p style={styles.hint}>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && kits.length === 0 && (
        <p style={styles.hint}>No kits found.</p>
      )}

      {kits.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Site</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {kits.map((kit) => (
              <tr key={kit.id}>
                <td style={styles.td}>
                  <Link to={`/kits/${kit.id}`}>{kit.name}</Link>
                </td>
                <td style={styles.td}>{kit.site.name}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background:
                        kit.status === 'ACTIVE' ? '#22c55e' : '#9ca3af',
                    }}
                  >
                    {kit.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '2rem' }}>
        <Link to="/" style={styles.backLink}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 800,
    margin: '40px auto',
    padding: '0 1rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  filterRow: {
    marginBottom: '1rem',
  },
  select: {
    padding: '0.3em 0.6em',
    borderRadius: 4,
    border: '1px solid #ccc',
  },
  btn: {
    display: 'inline-block',
    fontSize: '0.9rem',
    padding: '0.5em 1.25em',
    border: 'none',
    borderRadius: 8,
    background: '#4f46e5',
    color: 'white',
    textDecoration: 'none',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.5rem',
    borderBottom: '2px solid #ddd',
    fontWeight: 600,
  },
  td: {
    padding: '0.5rem',
    borderBottom: '1px solid #eee',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.7rem',
    padding: '0.15em 0.5em',
    color: 'white',
    borderRadius: 4,
  },
  hint: { color: '#888', fontSize: '0.85rem' },
  error: { color: '#dc2626' },
  backLink: { color: '#4f46e5', textDecoration: 'none' },
};
