import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

interface ComputerDetail {
  id: number;
  serialNumber: string | null;
  serviceTag: string | null;
  model: string | null;
  defaultUsername: string | null;
  defaultPassword: string | null;
  disposition: string;
  dateReceived: string | null;
  lastInventoried: string | null;
  notes: string | null;
  qrCode: string | null;
  hostName: { id: number; name: string } | null;
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

export default function ComputerDetailPage() {
  const { id } = useParams();
  const [computer, setComputer] = useState<ComputerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/computers/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Computer not found');
        return r.json();
      })
      .then(setComputer)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch(`/api/qr/c/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.qrDataUrl) setQrDataUrl(data.qrDataUrl); })
      .catch(() => {});
  }, [id]);

  async function handleDispositionChange(disposition: string) {
    const res = await fetch(`/api/computers/${id}/disposition`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disposition }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComputer((prev) => prev ? { ...prev, disposition: updated.disposition } : prev);
    }
  }

  if (loading) return <div style={styles.container}><p>Loading...</p></div>;
  if (error) return <div style={styles.container}><p style={styles.error}>{error}</p></div>;
  if (!computer) return null;

  const displayName = computer.hostName?.name || computer.model || `Computer #${computer.id}`;

  return (
    <div style={styles.container}>
      <Link to="/computers" style={styles.backLink}>Back to Computers</Link>

      <div style={styles.header}>
        <div>
          <h1>{displayName}</h1>
          <span style={{ ...styles.badge, background: dispositionColor(computer.disposition) }}>
            {computer.disposition.replace(/_/g, ' ')}
          </span>
        </div>
        <div style={styles.actions}>
          <Link to={`/computers/${computer.id}/edit`} style={styles.btn}>Edit</Link>
        </div>
      </div>

      {qrDataUrl && (
        <div style={styles.qrSection}>
          <img src={qrDataUrl} alt="QR Code" style={{ width: 120, height: 120 }} />
          <code style={{ marginLeft: '1rem' }}>{computer.qrCode}</code>
        </div>
      )}

      <table style={styles.detailTable}>
        <tbody>
          <tr><td style={styles.labelCell}>Host Name</td><td style={styles.valueCell}>{computer.hostName?.name || '—'}</td></tr>
          <tr><td style={styles.labelCell}>Model</td><td style={styles.valueCell}>{computer.model || '—'}</td></tr>
          <tr><td style={styles.labelCell}>Serial Number</td><td style={styles.valueCell}>{computer.serialNumber || '—'}</td></tr>
          <tr><td style={styles.labelCell}>Service Tag</td><td style={styles.valueCell}>{computer.serviceTag || '—'}</td></tr>
          <tr><td style={styles.labelCell}>Default Username</td><td style={styles.valueCell}>{computer.defaultUsername || '—'}</td></tr>
          <tr><td style={styles.labelCell}>Default Password</td><td style={styles.valueCell}>{computer.defaultPassword || '—'}</td></tr>
          <tr><td style={styles.labelCell}>Site</td><td style={styles.valueCell}>{computer.site ? <Link to={`/sites`}>{computer.site.name}</Link> : '—'}</td></tr>
          <tr><td style={styles.labelCell}>Kit</td><td style={styles.valueCell}>{computer.kit ? <Link to={`/kits/${computer.kit.id}`}>{computer.kit.name}</Link> : '—'}</td></tr>
          <tr><td style={styles.labelCell}>Date Received</td><td style={styles.valueCell}>{computer.dateReceived ? new Date(computer.dateReceived).toLocaleDateString() : '—'}</td></tr>
          <tr><td style={styles.labelCell}>Last Inventoried</td><td style={styles.valueCell}>{computer.lastInventoried ? new Date(computer.lastInventoried).toLocaleDateString() : '—'}</td></tr>
          <tr><td style={styles.labelCell}>Notes</td><td style={styles.valueCell}>{computer.notes || '—'}</td></tr>
        </tbody>
      </table>

      <div style={styles.section}>
        <h3>Change Disposition</h3>
        <div style={styles.dispositionRow}>
          {DISPOSITIONS.map((d) => (
            <button
              key={d}
              style={{
                ...styles.dispositionBtn,
                background: d === computer.disposition ? dispositionColor(d) : '#e5e7eb',
                color: d === computer.disposition ? 'white' : '#333',
              }}
              onClick={() => handleDispositionChange(d)}
              disabled={d === computer.disposition}
            >
              {d.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 800, margin: '40px auto', padding: '0 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  actions: { display: 'flex', gap: '0.5rem' },
  btn: { display: 'inline-block', fontSize: '0.85rem', padding: '0.4em 1em', border: 'none', borderRadius: 8, background: '#4f46e5', color: 'white', cursor: 'pointer', textDecoration: 'none' },
  badge: { display: 'inline-block', fontSize: '0.7rem', padding: '0.15em 0.5em', color: 'white', borderRadius: 4, marginLeft: '0.5rem' },
  qrSection: { display: 'flex', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: 8 },
  detailTable: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '2rem' },
  labelCell: { padding: '0.5rem', fontWeight: 600, width: '35%', borderBottom: '1px solid #eee', fontSize: '0.9rem', color: '#555' },
  valueCell: { padding: '0.5rem', borderBottom: '1px solid #eee', fontSize: '0.9rem' },
  section: { marginTop: '1.5rem' },
  dispositionRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' },
  dispositionBtn: { fontSize: '0.75rem', padding: '0.3em 0.8em', border: 'none', borderRadius: 6, cursor: 'pointer' },
  error: { color: '#dc2626' },
  backLink: { color: '#4f46e5', textDecoration: 'none', fontSize: '0.85rem' },
};
