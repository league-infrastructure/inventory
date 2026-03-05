import { useState, useEffect } from 'react';
import { Plus, MapPin } from 'lucide-react';

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

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formHome, setFormHome] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sites')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load sites');
        return r.json();
      })
      .then(setSites)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Address</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-20">Home</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} className="text-gray-400" />
                      {s.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.address || '—'}</td>
                  <td className="px-4 py-3">
                    {s.isHomeSite && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Home
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeactivate(s.id)}
                      className="text-xs text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
