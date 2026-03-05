import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

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

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Permissions</h1>
      <p className="text-gray-500 text-sm mb-6">
        Email addresses or regex patterns that grant <strong>Quartermaster</strong> role on Google OAuth login.
        Changes take effect on next login.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quartermaster Patterns</h3>

        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-center mb-4">
          <input
            placeholder="email@jointheleague.org or regex pattern"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 font-mono text-xs border border-gray-300 rounded-md"
            required
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
            <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />
            Regex
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
          >
            <Plus size={14} />
            {saving ? 'Adding...' : 'Add'}
          </button>
        </form>

        {formError && (
          <div className="px-3 py-2 mb-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">
            {formError}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : patterns.length === 0 ? (
          <p className="text-gray-400 text-sm">No patterns configured. All users will log in as Instructors.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-semibold text-gray-700">Pattern</th>
                <th className="text-left py-2 font-semibold text-gray-700 w-20">Type</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 font-mono text-xs">{p.pattern}</td>
                  <td className="py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      p.isRegex ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {p.isRegex ? 'regex' : 'exact'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-gray-500 text-xs">
        Exact patterns match the full email address (case-insensitive). Regex patterns are tested with the <code>i</code> flag.
      </p>
    </div>
  );
}
