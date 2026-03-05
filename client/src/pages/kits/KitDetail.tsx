import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

interface Item {
  id: number;
  name: string;
  type: string;
  expectedQuantity: number | null;
}

interface Pack {
  id: number;
  name: string;
  description: string | null;
  qrCode: string | null;
  items: Item[];
}

interface Computer {
  id: number;
  serialNumber: string | null;
  model: string | null;
  hostName: { name: string } | null;
}

interface Kit {
  id: number;
  name: string;
  description: string | null;
  status: string;
  qrCode: string | null;
  site: { id: number; name: string };
  packs: Pack[];
  computers: Computer[];
}

export default function KitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [showPackForm, setShowPackForm] = useState(false);
  const [packName, setPackName] = useState('');
  const [packDesc, setPackDesc] = useState('');
  const [itemForms, setItemForms] = useState<Record<number, boolean>>({});
  const [newItem, setNewItem] = useState({ name: '', type: 'COUNTED', expectedQuantity: 1 });

  useEffect(() => {
    fetch(`/api/kits/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Kit not found');
        return r.json();
      })
      .then(setKit)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleClone() {
    setCloning(true);
    try {
      const res = await fetch(`/api/kits/${id}/clone`, { method: 'POST' });
      if (!res.ok) throw new Error('Clone failed');
      const cloned = await res.json();
      navigate(`/kits/${cloned.id}`);
    } catch (e: any) {
      setError(e.message);
    }
    setCloning(false);
  }

  async function handleRetire() {
    const res = await fetch(`/api/kits/${id}/retire`, { method: 'PATCH' });
    if (res.ok) {
      const updated = await res.json();
      setKit((prev) => (prev ? { ...prev, status: updated.status } : prev));
    }
  }

  async function handleAddPack(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/kits/${id}/packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: packName, description: packDesc || null }),
    });
    if (res.ok) {
      const pack = await res.json();
      setKit((prev) => prev ? { ...prev, packs: [...prev.packs, { ...pack, items: [] }] } : prev);
      setPackName('');
      setPackDesc('');
      setShowPackForm(false);
    }
  }

  async function handleAddItem(packId: number) {
    const res = await fetch(`/api/packs/${packId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    if (res.ok) {
      const item = await res.json();
      setKit((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          packs: prev.packs.map((p) =>
            p.id === packId ? { ...p, items: [...p.items, item] } : p
          ),
        };
      });
      setNewItem({ name: '', type: 'COUNTED', expectedQuantity: 1 });
      setItemForms((prev) => ({ ...prev, [packId]: false }));
    }
  }

  async function handleDeletePack(packId: number) {
    const res = await fetch(`/api/packs/${packId}`, { method: 'DELETE' });
    if (res.ok) {
      setKit((prev) => prev ? { ...prev, packs: prev.packs.filter((p) => p.id !== packId) } : prev);
    }
  }

  async function handleDeleteItem(packId: number, itemId: number) {
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      setKit((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          packs: prev.packs.map((p) =>
            p.id === packId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p
          ),
        };
      });
    }
  }

  if (loading) return <div style={styles.container}><p>Loading...</p></div>;
  if (error) return <div style={styles.container}><p style={styles.error}>{error}</p></div>;
  if (!kit) return null;

  return (
    <div style={styles.container}>
      <Link to="/kits" style={styles.backLink}>Back to Kits</Link>

      <div style={styles.header}>
        <div>
          <h1>{kit.name}</h1>
          <span style={{ ...styles.badge, background: kit.status === 'ACTIVE' ? '#22c55e' : '#9ca3af' }}>
            {kit.status}
          </span>
          <span style={styles.siteLabel}>{kit.site.name}</span>
        </div>
        <div style={styles.actions}>
          <Link to={`/kits/${kit.id}/edit`} style={styles.btn}>Edit</Link>
          {kit.status === 'ACTIVE' && (
            <>
              <button style={styles.btn} onClick={handleClone} disabled={cloning}>
                {cloning ? 'Cloning...' : 'Clone Kit'}
              </button>
              <button style={{ ...styles.btn, background: '#dc2626' }} onClick={handleRetire}>
                Retire
              </button>
            </>
          )}
        </div>
      </div>

      {kit.description && <p style={styles.description}>{kit.description}</p>}

      {kit.qrCode && (
        <div style={styles.qrSection}>
          <strong>QR Code:</strong> <code>{kit.qrCode}</code>
        </div>
      )}

      {/* Packs */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2>Packs ({kit.packs.length})</h2>
          <button style={styles.btnSmall} onClick={() => setShowPackForm(!showPackForm)}>
            + Add Pack
          </button>
        </div>

        {showPackForm && (
          <form onSubmit={handleAddPack} style={styles.inlineForm}>
            <input
              placeholder="Pack name"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              style={styles.input}
              required
            />
            <input
              placeholder="Description (optional)"
              value={packDesc}
              onChange={(e) => setPackDesc(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.btnSmall}>Save</button>
            <button type="button" style={styles.btnSmallSecondary} onClick={() => setShowPackForm(false)}>Cancel</button>
          </form>
        )}

        {kit.packs.map((pack) => (
          <div key={pack.id} style={styles.packCard}>
            <div style={styles.packHeader}>
              <div>
                <strong>{pack.name}</strong>
                {pack.description && <span style={styles.hint}> — {pack.description}</span>}
                {pack.qrCode && <code style={styles.qrBadge}>{pack.qrCode}</code>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={styles.btnSmall} onClick={() => setItemForms((prev) => ({ ...prev, [pack.id]: true }))}>
                  + Item
                </button>
                <button style={{ ...styles.btnSmall, background: '#dc2626' }} onClick={() => handleDeletePack(pack.id)}>
                  Delete
                </button>
              </div>
            </div>

            {itemForms[pack.id] && (
              <div style={styles.inlineForm}>
                <input
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  style={styles.input}
                  required
                />
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  style={styles.select}
                >
                  <option value="COUNTED">Counted</option>
                  <option value="CONSUMABLE">Consumable</option>
                </select>
                {newItem.type === 'COUNTED' && (
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={newItem.expectedQuantity}
                    onChange={(e) => setNewItem({ ...newItem, expectedQuantity: parseInt(e.target.value) || 1 })}
                    style={{ ...styles.input, width: 60 }}
                  />
                )}
                <button style={styles.btnSmall} onClick={() => handleAddItem(pack.id)}>Save</button>
                <button style={styles.btnSmallSecondary} onClick={() => setItemForms((prev) => ({ ...prev, [pack.id]: false }))}>Cancel</button>
              </div>
            )}

            {pack.items.length > 0 ? (
              <table style={styles.itemTable}>
                <thead>
                  <tr>
                    <th style={styles.itemTh}>Item</th>
                    <th style={styles.itemTh}>Type</th>
                    <th style={styles.itemTh}>Qty</th>
                    <th style={styles.itemTh}></th>
                  </tr>
                </thead>
                <tbody>
                  {pack.items.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.itemTd}>{item.name}</td>
                      <td style={styles.itemTd}>{item.type}</td>
                      <td style={styles.itemTd}>{item.expectedQuantity ?? '—'}</td>
                      <td style={styles.itemTd}>
                        <button style={styles.deleteBtn} onClick={() => handleDeleteItem(pack.id, item.id)}>x</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={styles.hint}>No items in this pack.</p>
            )}
          </div>
        ))}
      </div>

      {/* Computers */}
      {kit.computers.length > 0 && (
        <div style={styles.section}>
          <h2>Computers ({kit.computers.length})</h2>
          <table style={styles.itemTable}>
            <thead>
              <tr>
                <th style={styles.itemTh}>Host Name</th>
                <th style={styles.itemTh}>Model</th>
                <th style={styles.itemTh}>Serial</th>
              </tr>
            </thead>
            <tbody>
              {kit.computers.map((c) => (
                <tr key={c.id}>
                  <td style={styles.itemTd}>{c.hostName?.name || '—'}</td>
                  <td style={styles.itemTd}>{c.model || '—'}</td>
                  <td style={styles.itemTd}>{c.serialNumber || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 800, margin: '40px auto', padding: '0 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  actions: { display: 'flex', gap: '0.5rem' },
  btn: { display: 'inline-block', fontSize: '0.85rem', padding: '0.4em 1em', border: 'none', borderRadius: 8, background: '#4f46e5', color: 'white', cursor: 'pointer', textDecoration: 'none' },
  btnSmall: { fontSize: '0.8rem', padding: '0.3em 0.8em', border: 'none', borderRadius: 6, background: '#4f46e5', color: 'white', cursor: 'pointer' },
  btnSmallSecondary: { fontSize: '0.8rem', padding: '0.3em 0.8em', border: 'none', borderRadius: 6, background: '#6b7280', color: 'white', cursor: 'pointer' },
  badge: { display: 'inline-block', fontSize: '0.7rem', padding: '0.15em 0.5em', color: 'white', borderRadius: 4, marginLeft: '0.5rem' },
  siteLabel: { marginLeft: '0.75rem', color: '#666', fontSize: '0.9rem' },
  description: { color: '#555', marginBottom: '1rem' },
  qrSection: { marginBottom: '1rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: 6, fontSize: '0.85rem' },
  section: { marginTop: '2rem' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  packCard: { border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1rem', background: '#fafafa' },
  packHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  qrBadge: { marginLeft: '0.5rem', fontSize: '0.75rem', background: '#e5e7eb', padding: '0.1em 0.4em', borderRadius: 4 },
  inlineForm: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' as const },
  input: { padding: '0.3em 0.6em', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.85rem' },
  select: { padding: '0.3em 0.6em', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.85rem' },
  itemTable: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' },
  itemTh: { textAlign: 'left' as const, padding: '0.3rem 0.5rem', borderBottom: '1px solid #ddd', fontWeight: 600, fontSize: '0.8rem' },
  itemTd: { padding: '0.3rem 0.5rem', borderBottom: '1px solid #eee' },
  deleteBtn: { border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' },
  hint: { color: '#888', fontSize: '0.85rem' },
  error: { color: '#dc2626' },
  backLink: { color: '#4f46e5', textDecoration: 'none', fontSize: '0.85rem' },
};
