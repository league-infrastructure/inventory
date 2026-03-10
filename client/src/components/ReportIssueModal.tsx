import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ISSUE_TYPES = [
  { value: 'MISSING_ITEM', label: 'Missing Item' },
  { value: 'REPLENISHMENT', label: 'Replenishment' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
];

interface Props {
  objectType: 'kit' | 'pack' | 'computer';
  objectId: number;
  objectName: string;
  onClose: () => void;
  onCreated?: () => void;
}

export default function ReportIssueModal({ objectType, objectId, objectName, onClose, onCreated }: Props) {
  const [type, setType] = useState('OTHER');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        type,
        notes: notes.trim() || undefined,
      };
      if (objectType === 'kit') body.kitId = objectId;
      else if (objectType === 'pack') body.packId = objectId;
      else if (objectType === 'computer') body.computerId = objectId;

      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(data.error || 'Failed to create issue');
      }
      onCreated?.();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Report Issue
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Reporting issue on <strong>{objectName}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Issue Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {ISSUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y"
            />
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white border-none cursor-pointer hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? 'Submitting...' : 'Submit Issue'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-500 text-white border-none cursor-pointer hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
