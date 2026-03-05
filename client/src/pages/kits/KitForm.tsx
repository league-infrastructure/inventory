import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

interface Site {
  id: number;
  name: string;
}

export default function KitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState<number | ''>('');
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/sites')
      .then((r) => r.json())
      .then(setSites)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      fetch(`/api/kits/${id}`)
        .then((r) => r.json())
        .then((kit) => {
          setName(kit.name);
          setDescription(kit.description || '');
          setSiteId(kit.site.id);
        })
        .catch(() => setError('Kit not found'));
    }
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      name,
      description: description || null,
      siteId: typeof siteId === 'number' ? siteId : parseInt(siteId as string, 10),
    };

    try {
      const res = await fetch(
        isEdit ? `/api/kits/${id}` : '/api/kits',
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
      const kit = await res.json();
      navigate(`/kits/${kit.id}`);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div style={styles.container}>
      <Link to={isEdit ? `/kits/${id}` : '/kits'} style={styles.backLink}>
        Back
      </Link>
      <h1>{isEdit ? 'Edit Kit' : 'New Kit'}</h1>

      {error && <p style={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Name *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
          />
        </label>

        <label style={styles.label}>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            rows={3}
          />
        </label>

        <label style={styles.label}>
          Site *
          <select
            value={siteId}
            onChange={(e) => setSiteId(parseInt(e.target.value, 10))}
            style={styles.input}
            required
          >
            <option value="">Select a site...</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div style={styles.actions}>
          <button type="submit" style={styles.btn} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Kit' : 'Create Kit'}
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
