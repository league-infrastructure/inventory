import { useState, useEffect } from 'react';

interface TransferModalProps {
  title?: string;
  objectType: 'Kit' | 'Computer';
  objectId: number;
  onClose: () => void;
  onComplete: () => void;
}

export default function TransferModal({ title, objectType, objectId, onClose, onComplete }: TransferModalProps) {
  const [users, setUsers] = useState<{ id: number; displayName: string }[]>([]);
  const [sites, setSites] = useState<{ id: number; name: string }[]>([]);
  const [custodianId, setCustodianId] = useState<number | ''>('');
  const [siteId, setSiteId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/users').then((r) => r.ok ? r.json() : []).then(setUsers);
    fetch('/api/sites').then((r) => r.ok ? r.json() : []).then(setSites);
  }, []);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const body: any = { objectType, objectId };
      if (custodianId !== '') body.custodianId = custodianId;
      else body.custodianId = null;
      if (siteId !== '') body.siteId = siteId;
      else body.siteId = null;
      if (notes) body.notes = notes;

      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Transfer failed' }));
        throw new Error(data.error || 'Transfer failed');
      }
      onComplete();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title || `Transfer ${objectType}`}</h3>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">New Custodian</span>
            <select
              value={custodianId}
              onChange={(e) => setCustodianId(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Admin (storeroom)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Site</span>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">No site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Notes (optional)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Reason for transfer..."
            />
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Transferring...' : 'Confirm Transfer'}
          </button>
          <button
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-500 text-white border-none cursor-pointer hover:bg-gray-600"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
