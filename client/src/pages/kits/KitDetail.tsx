import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Copy, Trash2, Plus, X } from 'lucide-react';

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

interface Site { id: number; name: string; }

interface FormState {
  name: string;
  description: string;
  siteId: number | '';
}

export default function KitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [cloning, setCloning] = useState(false);

  const [form, setForm] = useState<FormState>({ name: '', description: '', siteId: '' });
  const savedForm = useRef<FormState>(form);

  const [status, setStatus] = useState('ACTIVE');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  const [showPackForm, setShowPackForm] = useState(false);
  const [packName, setPackName] = useState('');
  const [packDesc, setPackDesc] = useState('');
  const [itemForms, setItemForms] = useState<Record<number, boolean>>({});
  const [newItem, setNewItem] = useState({ name: '', type: 'COUNTED', expectedQuantity: 1 });

  useEffect(() => {
    Promise.all([
      fetch(`/api/kits/${id}`).then((r) => {
        if (!r.ok) throw new Error('Kit not found');
        return r.json();
      }),
      fetch('/api/sites').then((r) => r.json()),
    ])
      .then(([kit, s]) => {
        const initial: FormState = {
          name: kit.name,
          description: kit.description || '',
          siteId: kit.site.id,
        };
        setForm(initial);
        savedForm.current = initial;
        setStatus(kit.status);
        setQrCode(kit.qrCode || null);
        setPacks(kit.packs);
        setComputers(kit.computers);
        setSites(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setDirty(JSON.stringify(next) !== JSON.stringify(savedForm.current));
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/kits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          siteId: form.siteId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      savedForm.current = { ...form };
      setDirty(false);
    } catch (e: any) {
      setSaveError(e.message);
    }
    setSaving(false);
  }

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
      setStatus(updated.status);
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
      setPacks((prev) => [...prev, { ...pack, items: [] }]);
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
      setPacks((prev) =>
        prev.map((p) => p.id === packId ? { ...p, items: [...p.items, item] } : p)
      );
      setNewItem({ name: '', type: 'COUNTED', expectedQuantity: 1 });
      setItemForms((prev) => ({ ...prev, [packId]: false }));
    }
  }

  async function handleDeletePack(packId: number) {
    const res = await fetch(`/api/packs/${packId}`, { method: 'DELETE' });
    if (res.ok) {
      setPacks((prev) => prev.filter((p) => p.id !== packId));
    }
  }

  async function handleDeleteItem(packId: number, itemId: number) {
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      setPacks((prev) =>
        prev.map((p) => p.id === packId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p)
      );
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const inputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white";

  return (
    <div className="max-w-4xl">
      <Link to="/kits" className="text-sm text-primary hover:underline">
        &larr; Back to Kits
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-4 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{form.name || 'Kit'}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {status}
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'ACTIVE' && (
            <>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-600 text-white border-none cursor-pointer hover:bg-gray-700"
                onClick={handleClone}
                disabled={cloning}
              >
                <Copy size={14} /> {cloning ? 'Cloning...' : 'Clone'}
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white border-none cursor-pointer hover:bg-red-700"
                onClick={handleRetire}
              >
                Retire
              </button>
            </>
          )}
        </div>
      </div>

      {qrCode && (
        <div className="mb-6 px-4 py-2 bg-gray-50 rounded-lg text-sm">
          <strong>QR Code:</strong> <code className="text-xs">{qrCode}</code>
        </div>
      )}

      {saveError && <p className="text-red-600 text-sm mb-4">{saveError}</p>}

      {/* Editable kit fields */}
      <form onSubmit={handleSave} className="space-y-4 mb-8">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Name *</span>
          <input value={form.name} onChange={(e) => updateField('name', e.target.value)} className={inputClass} required />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Description</span>
          <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} className={inputClass + " resize-y"} rows={3} />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Site *</span>
          <select
            value={form.siteId}
            onChange={(e) => updateField('siteId', parseInt(e.target.value, 10))}
            className={inputClass}
            required
          >
            <option value="">Select a site...</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        {dirty && (
          <div className="pt-2">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>

      {/* Packs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Packs ({packs.length})</h2>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
            onClick={() => setShowPackForm(!showPackForm)}
          >
            <Plus size={14} /> Add Pack
          </button>
        </div>

        {showPackForm && (
          <form onSubmit={handleAddPack} className="flex flex-wrap gap-2 mb-4 items-center">
            <input
              placeholder="Pack name"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm flex-1 min-w-[150px]"
              required
            />
            <input
              placeholder="Description (optional)"
              value={packDesc}
              onChange={(e) => setPackDesc(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm flex-1 min-w-[150px]"
            />
            <button type="submit" className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-white border-none cursor-pointer">
              Save
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-500 text-white border-none cursor-pointer"
              onClick={() => setShowPackForm(false)}
            >
              Cancel
            </button>
          </form>
        )}

        {packs.map((pack) => (
          <div key={pack.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <strong className="text-gray-900">{pack.name}</strong>
                {pack.description && <span className="text-gray-500 text-sm ml-2">— {pack.description}</span>}
                {pack.qrCode && <code className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pack.qrCode}</code>}
              </div>
              <div className="flex gap-2">
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-primary text-white border-none cursor-pointer"
                  onClick={() => setItemForms((prev) => ({ ...prev, [pack.id]: true }))}
                >
                  <Plus size={12} /> Item
                </button>
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-600 text-white border-none cursor-pointer"
                  onClick={() => handleDeletePack(pack.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {itemForms[pack.id] && (
              <div className="flex flex-wrap gap-2 mb-3 items-center">
                <input
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[120px]"
                  required
                />
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
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
                    className="px-2 py-1 border border-gray-300 rounded text-sm w-16"
                  />
                )}
                <button
                  className="px-2 py-1 text-xs rounded bg-primary text-white border-none cursor-pointer"
                  onClick={() => handleAddItem(pack.id)}
                >
                  Save
                </button>
                <button
                  className="px-2 py-1 text-xs rounded bg-gray-500 text-white border-none cursor-pointer"
                  onClick={() => setItemForms((prev) => ({ ...prev, [pack.id]: false }))}
                >
                  Cancel
                </button>
              </div>
            )}

            {pack.items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Item</th>
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Type</th>
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Qty</th>
                    <th className="py-1.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {pack.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1.5 px-2">{item.name}</td>
                      <td className="py-1.5 px-2 text-gray-500">{item.type}</td>
                      <td className="py-1.5 px-2 text-gray-500">{item.expectedQuantity ?? '—'}</td>
                      <td className="py-1.5 px-2">
                        <button
                          className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer"
                          onClick={() => handleDeleteItem(pack.id, item.id)}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-400 text-sm">No items in this pack.</p>
            )}
          </div>
        ))}
      </div>

      {/* Computers */}
      {computers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Computers ({computers.length})</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Host Name</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Model</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Serial</th>
                </tr>
              </thead>
              <tbody>
                {computers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="px-4 py-2">
                      <Link to={`/computers/${c.id}`} className="text-primary hover:underline">
                        {c.hostName?.name || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{c.model || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{c.serialNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
