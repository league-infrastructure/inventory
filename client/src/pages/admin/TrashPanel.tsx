import { useState, useEffect } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

type Tab = 'kits' | 'computers';

interface DeletedKit {
  id: number;
  number: number;
  name: string;
  status: string;
  deletedAt: string;
}

interface DeletedComputer {
  id: number;
  model: string | null;
  serialNumber: string | null;
  hostName: { name: string } | null;
  disposition: string;
  deletedAt: string;
}

export default function TrashPanel() {
  const [tab, setTab] = useState<Tab>('kits');
  const [kits, setKits] = useState<DeletedKit[]>([]);
  const [computers, setComputers] = useState<DeletedComputer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const endpoint = tab === 'kits' ? '/api/kits/deleted' : '/api/computers/deleted';
    fetch(endpoint)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data) => {
        if (tab === 'kits') setKits(data);
        else setComputers(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleRestore(type: 'kits' | 'computers', id: number) {
    const res = await fetch(`/api/${type}/${id}/restore`, { method: 'POST' });
    if (res.ok) {
      if (type === 'kits') setKits((prev) => prev.filter((k) => k.id !== id));
      else setComputers((prev) => prev.filter((c) => c.id !== id));
    }
  }

  async function handlePermanentDelete(type: 'kits' | 'computers', id: number) {
    const key = `${type}-${id}`;
    if (confirmId !== key) {
      setConfirmId(key);
      return;
    }
    const res = await fetch(`/api/${type}/${id}/permanent`, { method: 'DELETE' });
    if (res.ok) {
      if (type === 'kits') setKits((prev) => prev.filter((k) => k.id !== id));
      else setComputers((prev) => prev.filter((c) => c.id !== id));
    }
    setConfirmId(null);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Trash</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['kits', 'computers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setConfirmId(null); }}
            className={`px-4 py-2 text-sm font-medium border-none cursor-pointer transition-colors capitalize ${
              tab === t
                ? 'bg-transparent text-primary border-b-2 border-primary -mb-px'
                : 'bg-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && tab === 'kits' && kits.length === 0 && (
        <p className="text-gray-500 text-sm">No deleted kits.</p>
      )}

      {!loading && tab === 'computers' && computers.length === 0 && (
        <p className="text-gray-500 text-sm">No deleted computers.</p>
      )}

      {tab === 'kits' && kits.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Deleted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {kits.map((k) => (
                <tr key={k.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">#{k.number} {k.name}</td>
                  <td className="px-4 py-3 text-gray-500">{k.status}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(k.deletedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRestore('kits', k.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 border border-green-200 cursor-pointer hover:bg-green-100"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDelete('kits', k.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border cursor-pointer ${
                          confirmId === `kits-${k.id}`
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <Trash2 size={12} /> {confirmId === `kits-${k.id}` ? 'Confirm?' : 'Delete Forever'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'computers' && computers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Computer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Model</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Serial</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Deleted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {computers.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.hostName?.name || `#${c.id}`}</td>
                  <td className="px-4 py-3 text-gray-500">{c.model || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.serialNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.deletedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRestore('computers', c.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 border border-green-200 cursor-pointer hover:bg-green-100"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDelete('computers', c.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border cursor-pointer ${
                          confirmId === `computers-${c.id}`
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <Trash2 size={12} /> {confirmId === `computers-${c.id}` ? 'Confirm?' : 'Delete Forever'}
                      </button>
                    </div>
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
