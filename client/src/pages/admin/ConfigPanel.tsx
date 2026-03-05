import { useEffect, useState } from 'react';

interface ConfigEntry {
  key: string;
  group: string;
  label: string;
  value: string | null;
  source: 'environment' | 'database' | 'not set';
  isSecret: boolean;
  requiresRestart: boolean;
}

interface SaveResult { success: boolean; warning?: string; restart?: boolean; }

export default function ConfigPanel() {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState('');

  const loadConfig = () => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => setError('Failed to load configuration'));
  };

  useEffect(() => { loadConfig(); }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      });
      const data: SaveResult & { error?: string } = await res.json();
      if (!res.ok) {
        setToast({ message: data.error || 'Save failed', type: 'error' });
      } else {
        let msg = 'Saved successfully';
        if (data.warning) msg += `. ${data.warning}`;
        if (data.restart) msg += '. Restart required for this change to take effect.';
        setToast({ message: msg, type: 'success' });
        setEditing(null);
        loadConfig();
      }
    } catch {
      setToast({ message: 'Network error', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => { window.location.href = '/api/admin/config/export'; };

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const groups: Record<string, ConfigEntry[]> = {};
  for (const entry of entries) {
    if (!groups[entry.group]) groups[entry.group] = [];
    groups[entry.group].push(entry);
  }

  const sourceClasses: Record<string, string> = {
    environment: 'bg-blue-50 text-blue-600',
    database: 'bg-green-50 text-green-600',
    'not set': 'bg-gray-50 text-gray-400',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Configuration</h1>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white cursor-pointer hover:bg-gray-50"
        >
          Export .env
        </button>
      </div>

      {toast && (
        <div className={`px-4 py-3 mb-4 rounded-lg text-sm ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{group}</h3>
          <table className="w-full text-sm">
            <tbody>
              {items.map((entry) => (
                <tr key={entry.key} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-2 pr-4 w-48">
                    <span className="font-medium text-gray-700">{entry.label}</span>
                    {entry.requiresRestart && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">restart</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {editing === entry.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-2 py-1 font-mono text-xs border border-gray-300 rounded"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(entry.key);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <span className={`font-mono text-xs ${entry.value ? 'text-gray-700' : 'text-gray-400'}`}>
                        {entry.value || '—'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 w-20">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sourceClasses[entry.source] || ''}`}>
                      {entry.source}
                    </span>
                  </td>
                  <td className="py-2 w-28 text-right">
                    {editing === entry.key ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleSave(entry.key)} disabled={saving} className="px-2 py-1 text-xs bg-primary text-white rounded border-none cursor-pointer">
                          {saving ? '...' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(null)} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded border-none cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditing(entry.key); setEditValue(''); }}
                        className="px-2 py-1 text-xs text-primary hover:bg-primary/5 rounded border-none cursor-pointer bg-transparent"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="text-gray-500 text-xs">
        Environment variables take precedence over database values. Changes to OAuth credentials require a server restart.
      </p>
    </div>
  );
}
