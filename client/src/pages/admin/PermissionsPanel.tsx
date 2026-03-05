import { useState, useEffect } from 'react';

interface Pattern {
  id: number;
  pattern: string;
  isRegex: boolean;
  createdAt: string;
}

export default function PermissionsPanel() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetch('/api/admin/quartermasters')
      .then((r) => r.json())
      .then(setPatterns)
      .catch(() => setError('Failed to load patterns'))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/admin/quartermasters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: newPattern, isRegex }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to add pattern');
      } else {
        setPatterns((prev) => [...prev, data]);
        setNewPattern('');
        setIsRegex(false);
      }
    } catch {
      setFormError('Network error');
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/admin/quartermasters/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPatterns((prev) => prev.filter((p) => p.id !== id));
    }
  }

  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h1>Permissions</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Email addresses or regex patterns that grant <strong>Quartermaster</strong> role
        on Google OAuth login. Users matching any pattern get elevated permissions.
        Changes take effect on next login.
      </p>

      <div style={{
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}>
        <h3 style={{ marginTop: 0 }}>Quartermaster Patterns</h3>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            placeholder="email@jointheleague.org or regex pattern"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            style={{ flex: 1, padding: '6px 8px', fontFamily: 'monospace', fontSize: 13 }}
            required
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
            />
            Regex
          </label>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '6px 16px', cursor: 'pointer' }}
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </form>

        {formError && (
          <div style={{
            padding: '8px 12px',
            marginBottom: 12,
            borderRadius: 4,
            background: '#fce8e6',
            color: '#c5221f',
            border: '1px solid #ea4335',
            fontSize: 13,
          }}>
            {formError}
          </div>
        )}

        {loading ? (
          <p style={{ color: '#999' }}>Loading...</p>
        ) : patterns.length === 0 ? (
          <p style={{ color: '#999', fontSize: 13 }}>
            No patterns configured. All users will log in as Instructors.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Pattern</th>
                <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600, width: 80 }}>Type</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: 13 }}>
                    {p.pattern}
                  </td>
                  <td style={{ padding: '8px 0' }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: p.isRegex ? '#e8f0fe' : '#e6f4ea',
                      color: p.isRegex ? '#1a73e8' : '#34a853',
                      fontWeight: 600,
                    }}>
                      {p.isRegex ? 'regex' : 'exact'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(p.id)}
                      style={{ cursor: 'pointer', color: '#c5221f', background: 'none', border: 'none', fontSize: 13 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ color: '#666', fontSize: 12 }}>
        Exact patterns match the full email address (case-insensitive).
        Regex patterns are tested with the <code>i</code> flag.
      </p>
    </div>
  );
}
