import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface HostName {
  id: number;
  name: string;
  computerId: number | null;
  computer: { id: number; model: string | null } | null;
}

export default function HostNameList() {
  const [hostNames, setHostNames] = useState<HostName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hostnames')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load host names');
        return r.json();
      })
      .then(setHostNames)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const res = await fetch('/api/hostnames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.status === 409) {
      setAddError('A host name with that name already exists.');
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || 'Failed to add host name');
      return;
    }
    const created = await res.json();
    setHostNames((prev) => [...prev, { ...created, computer: null }]);
    setNewName('');
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/hostnames/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setHostNames((prev) => prev.filter((h) => h.id !== id));
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Host Names</h1>
        <Link to="/computers" style={styles.backLink}>Back to Computers</Link>
      </div>

      <form onSubmit={handleAdd} style={styles.addForm}>
        <input
          placeholder="New host name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={styles.input}
          required
        />
        <button type="submit" style={styles.btn}>Add</button>
      </form>
      {addError && <p style={styles.error}>{addError}</p>}

      {loading && <p style={styles.hint}>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && hostNames.length === 0 && (
        <p style={styles.hint}>No host names found.</p>
      )}

      {hostNames.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Assigned Computer</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {hostNames.map((h) => (
              <tr key={h.id}>
                <td style={styles.td}>{h.name}</td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    background: h.computerId ? '#3b82f6' : '#22c55e',
                  }}>
                    {h.computerId ? 'Assigned' : 'Available'}
                  </span>
                </td>
                <td style={styles.td}>
                  {h.computer ? (
                    <Link to={`/computers/${h.computer.id}`}>
                      {h.computer.model || `Computer #${h.computer.id}`}
                    </Link>
                  ) : '—'}
                </td>
                <td style={styles.td}>
                  {!h.computerId && (
                    <button style={styles.deleteBtn} onClick={() => handleDelete(h.id)}>
                      Delete
                    </button>
                  )}
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
  container: { maxWidth: 800, margin: '40px auto', padding: '0 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  addForm: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' },
  input: { padding: '0.5em', borderRadius: 6, border: '1px solid #ccc', fontSize: '0.9rem', flex: 1 },
  btn: { fontSize: '0.9rem', padding: '0.5em 1.25em', border: 'none', borderRadius: 8, background: '#4f46e5', color: 'white', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.9rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem', borderBottom: '2px solid #ddd', fontWeight: 600 },
  td: { padding: '0.5rem', borderBottom: '1px solid #eee' },
  badge: { display: 'inline-block', fontSize: '0.7rem', padding: '0.15em 0.5em', color: 'white', borderRadius: 4 },
  deleteBtn: { fontSize: '0.8rem', padding: '0.2em 0.6em', border: 'none', borderRadius: 4, background: '#dc2626', color: 'white', cursor: 'pointer' },
  hint: { color: '#888', fontSize: '0.85rem' },
  error: { color: '#dc2626', fontSize: '0.85rem' },
  backLink: { color: '#4f46e5', textDecoration: 'none', fontSize: '0.85rem' },
};
