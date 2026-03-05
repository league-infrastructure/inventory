import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Computer {
  id: number;
  model: string | null;
  disposition: string;
  hostName: { name: string } | null;
  site: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
}

const DISPOSITIONS = [
  'ACTIVE', 'LOANED', 'NEEDS_REPAIR', 'IN_REPAIR',
  'SCRAPPED', 'LOST', 'DECOMMISSIONED',
];

function dispositionColor(d: string): string {
  switch (d) {
    case 'ACTIVE': return '#22c55e';
    case 'LOANED': return '#3b82f6';
    case 'NEEDS_REPAIR': return '#f59e0b';
    case 'IN_REPAIR': return '#f97316';
    case 'SCRAPPED': return '#6b7280';
    case 'LOST': return '#dc2626';
    case 'DECOMMISSIONED': return '#9ca3af';
    default: return '#6b7280';
  }
}

export default function ComputerList() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispositionFilter, setDispositionFilter] = useState('ACTIVE');

  useEffect(() => {
    setLoading(true);
    const params = dispositionFilter ? `?disposition=${dispositionFilter}` : '';
    fetch(`/api/computers${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load computers');
        return r.json();
      })
      .then(setComputers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dispositionFilter]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Computers</h1>
        <Link to="/computers/new" style={styles.btn}>
          + New Computer
        </Link>
      </div>

      <div style={styles.filterRow}>
        <label>
          Disposition:{' '}
          <select
            value={dispositionFilter}
            onChange={(e) => setDispositionFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All</option>
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p style={styles.hint}>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && computers.length === 0 && (
        <p style={styles.hint}>No computers found.</p>
      )}

      {computers.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Host Name</th>
              <th style={styles.th}>Model</th>
              <th style={styles.th}>Disposition</th>
              <th style={styles.th}>Site</th>
              <th style={styles.th}>Kit</th>
            </tr>
          </thead>
          <tbody>
            {computers.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>
                  <Link to={`/computers/${c.id}`}>
                    {c.hostName?.name || `#${c.id}`}
                  </Link>
                </td>
                <td style={styles.td}>{c.model || '—'}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: dispositionColor(c.disposition) }}>
                    {c.disposition.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={styles.td}>{c.site?.name || '—'}</td>
                <td style={styles.td}>
                  {c.kit ? <Link to={`/kits/${c.kit.id}`}>{c.kit.name}</Link> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '2rem' }}>
        <Link to="/" style={styles.backLink}>Back to Home</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900, margin: '40px auto', padding: '0 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  filterRow: { marginBottom: '1rem' },
  select: { padding: '0.3em 0.6em', borderRadius: 4, border: '1px solid #ccc' },
  btn: { display: 'inline-block', fontSize: '0.9rem', padding: '0.5em 1.25em', border: 'none', borderRadius: 8, background: '#4f46e5', color: 'white', textDecoration: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.9rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem', borderBottom: '2px solid #ddd', fontWeight: 600 },
  td: { padding: '0.5rem', borderBottom: '1px solid #eee' },
  badge: { display: 'inline-block', fontSize: '0.7rem', padding: '0.15em 0.5em', color: 'white', borderRadius: 4 },
  hint: { color: '#888', fontSize: '0.85rem' },
  error: { color: '#dc2626' },
  backLink: { color: '#4f46e5', textDecoration: 'none' },
};
