import { useState, useEffect, useCallback } from 'react';
import { Plus, MapPin, Pencil, X, Check, LocateFixed } from 'lucide-react';
import { useTableSort } from '../../lib/useTableSort';
import SortableHeader from '../../components/SortableHeader';

interface Site {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isHomeSite: boolean;
  isActive: boolean;
}

export default function SiteList() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { processed: sorted, sort, toggleSort, filters, setFilter } = useTableSort(sites, { key: 'name', direction: 'asc' });

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formHome, setFormHome] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Editing state
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editHome, setEditHome] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadSites = useCallback(() => {
    setLoading(true);
    fetch('/api/sites')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load sites');
        return r.json();
      })
      .then(setSites)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSites(); }, [loadSites]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          address: formAddress.trim() || null,
          isHomeSite: formHome,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || 'Failed to create site');
        setSaving(false);
        return;
      }
      const created = await res.json();
      setSites((prev) => [...prev, created]);
      setFormName('');
      setFormAddress('');
      setFormHome(false);
      setShowForm(false);
    } catch {
      setFormError('Network error');
    }
    setSaving(false);
  }

  function startEdit(site: Site) {
    setEditId(site.id);
    setEditName(site.name);
    setEditAddress(site.address || '');
    setEditHome(site.isHomeSite);
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/sites/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          address: editAddress.trim() || null,
          isHomeSite: editHome,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || 'Failed to update site');
        setSaving(false);
        return;
      }
      const updated = await res.json();
      setSites((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      setEditId(null);
    } catch {
      setEditError('Network error');
    }
    setSaving(false);
  }

  async function handleGeocode(id: number) {
    try {
      const res = await fetch(`/api/sites/${id}/geocode`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Geocoding failed');
        return;
      }
      const updated = await res.json();
      setSites((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    } catch {
      alert('Network error');
    }
  }

  async function handleDeactivate(id: number) {
    const res = await fetch(`/api/sites/${id}/deactivate`, { method: 'PATCH' });
    if (res.ok) {
      setSites((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover"
          >
            <Plus size={16} />
            Add Site
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">New Site</h3>
          <div className="space-y-3">
            <input
              placeholder="Site name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
            <input
              placeholder="Address (optional)"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={formHome} onChange={(e) => setFormHome(e.target.checked)} />
              Home site
            </label>
          </div>
          {formError && <p className="text-red-600 text-sm mt-2">{formError}</p>}
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2 bg-white text-gray-700 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && sites.length === 0 && (
        <p className="text-gray-500 text-sm">No sites found.</p>
      )}

      {sites.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={toggleSort} filterValue={filters['name']} onFilter={setFilter} />
                <SortableHeader label="Address" sortKey="address" currentSort={sort} onSort={toggleSort} filterValue={filters['address']} onFilter={setFilter} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lat/Lng</th>
                <SortableHeader label="Home" sortKey="isHomeSite" currentSort={sort} onSort={toggleSort} className="w-20" />
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                editId === s.id ? (
                  <tr key={s.id} className="border-b border-gray-100 bg-blue-50">
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Address"
                      />
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {s.latitude != null ? `${s.latitude.toFixed(4)}, ${s.longitude?.toFixed(4)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={editHome} onChange={(e) => setEditHome(e.target.checked)} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={saveEdit}
                          disabled={saving || !editName.trim()}
                          className="inline-flex items-center p-1 text-green-600 bg-transparent border-none cursor-pointer hover:text-green-800 disabled:opacity-50"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="inline-flex items-center p-1 text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-700"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => startEdit(s)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-gray-400" />
                        {s.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.address || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {s.latitude != null ? (
                        `${s.latitude.toFixed(4)}, ${s.longitude?.toFixed(4)}`
                      ) : s.address ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGeocode(s.id); }}
                          className="inline-flex items-center gap-1 text-xs text-primary bg-transparent border-none cursor-pointer hover:underline"
                          title="Geocode address"
                        >
                          <LocateFixed size={12} />
                          Geocode
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {s.isHomeSite && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          Home
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                          className="text-xs text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeactivate(s.id); }}
                          className="text-xs text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
