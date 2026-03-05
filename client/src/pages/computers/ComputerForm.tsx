import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

interface Site {
  id: number;
  name: string;
}

interface Kit {
  id: number;
  name: string;
}

interface HostName {
  id: number;
  name: string;
  computerId: number | null;
}

const DISPOSITIONS = [
  'ACTIVE', 'LOANED', 'NEEDS_REPAIR', 'IN_REPAIR',
  'SCRAPPED', 'LOST', 'DECOMMISSIONED',
];

export default function ComputerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [serialNumber, setSerialNumber] = useState('');
  const [serviceTag, setServiceTag] = useState('');
  const [model, setModel] = useState('');
  const [defaultUsername, setDefaultUsername] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [disposition, setDisposition] = useState('ACTIVE');
  const [dateReceived, setDateReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [siteId, setSiteId] = useState<number | ''>('');
  const [kitId, setKitId] = useState<number | ''>('');
  const [hostNameId, setHostNameId] = useState<number | ''>('');

  const [sites, setSites] = useState<Site[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [hostNames, setHostNames] = useState<HostName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/sites').then((r) => r.json()),
      fetch('/api/kits').then((r) => r.json()),
      fetch('/api/hostnames').then((r) => r.json()),
    ])
      .then(([s, k, h]) => {
        setSites(s);
        setKits(k);
        setHostNames(h);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      fetch(`/api/computers/${id}`)
        .then((r) => r.json())
        .then((c) => {
          setSerialNumber(c.serialNumber || '');
          setServiceTag(c.serviceTag || '');
          setModel(c.model || '');
          setDefaultUsername(c.defaultUsername || '');
          setDefaultPassword(c.defaultPassword || '');
          setDisposition(c.disposition);
          setDateReceived(c.dateReceived ? c.dateReceived.substring(0, 10) : '');
          setNotes(c.notes || '');
          setSiteId(c.site?.id || '');
          setKitId(c.kit?.id || '');
          setHostNameId(c.hostName?.id || '');
        })
        .catch(() => setError('Computer not found'));
    }
  }, [id, isEdit]);

  // Available host names: unassigned ones + the one currently assigned to this computer
  const availableHostNames = hostNames.filter(
    (h) => h.computerId === null || (isEdit && h.computerId === parseInt(id!, 10))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      serialNumber: serialNumber || null,
      serviceTag: serviceTag || null,
      model: model || null,
      defaultUsername: defaultUsername || null,
      defaultPassword: defaultPassword || null,
      disposition,
      dateReceived: dateReceived || null,
      notes: notes || null,
      siteId: siteId || null,
      kitId: kitId || null,
      hostNameId: hostNameId || null,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/computers/${id}` : '/api/computers',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      const computer = await res.json();
      navigate(`/computers/${computer.id}`);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div style={styles.container}>
      <Link to={isEdit ? `/computers/${id}` : '/computers'} style={styles.backLink}>
        Back
      </Link>
      <h1>{isEdit ? 'Edit Computer' : 'New Computer'}</h1>

      {error && <p style={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Serial Number
          <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Service Tag
          <input value={serviceTag} onChange={(e) => setServiceTag(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Default Username
          <input value={defaultUsername} onChange={(e) => setDefaultUsername(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Default Password
          <input value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Disposition
          <select value={disposition} onChange={(e) => setDisposition(e.target.value)} style={styles.input}>
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Host Name
          <select value={hostNameId} onChange={(e) => setHostNameId(e.target.value ? parseInt(e.target.value, 10) : '')} style={styles.input}>
            <option value="">None</option>
            {availableHostNames.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Site
          <select value={siteId} onChange={(e) => setSiteId(e.target.value ? parseInt(e.target.value, 10) : '')} style={styles.input}>
            <option value="">None</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Kit
          <select value={kitId} onChange={(e) => setKitId(e.target.value ? parseInt(e.target.value, 10) : '')} style={styles.input}>
            <option value="">None</option>
            {kits.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Date Received
          <input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.textarea} rows={3} />
        </label>

        <div style={styles.actions}>
          <button type="submit" style={styles.btn} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Computer' : 'Create Computer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 500, margin: '40px auto', padding: '0 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500 },
  input: { padding: '0.5em', borderRadius: 6, border: '1px solid #ccc', fontSize: '0.9rem' },
  textarea: { padding: '0.5em', borderRadius: 6, border: '1px solid #ccc', fontSize: '0.9rem', resize: 'vertical' as const },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  btn: { fontSize: '0.9rem', padding: '0.5em 1.5em', border: 'none', borderRadius: 8, background: '#4f46e5', color: 'white', cursor: 'pointer' },
  error: { color: '#dc2626', marginBottom: '0.5rem' },
  backLink: { color: '#4f46e5', textDecoration: 'none', fontSize: '0.85rem' },
};
