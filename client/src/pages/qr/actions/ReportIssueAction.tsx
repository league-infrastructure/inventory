import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  objectType: 'Kit' | 'Computer' | 'Pack';
  objectId: number;
}

export default function ReportIssueAction({ objectType, objectId }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType, objectId, text: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(data.error || 'Failed to report issue');
      }
      setSuccess(true);
      setText('');
      setTimeout(() => { setSuccess(false); setOpen(false); }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="w-full py-3 rounded-xl bg-green-100 text-green-700 text-center font-medium text-sm">
        Issue reported
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-semibold border border-amber-200 cursor-pointer hover:bg-amber-100"
      >
        <AlertTriangle size={16} />
        Report Issue
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe the issue..."
        rows={3}
        className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl resize-none"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={busy || !text.trim()}
          className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-semibold border-none cursor-pointer hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? 'Submitting...' : 'Submit Issue'}
        </button>
        <button
          onClick={() => { setOpen(false); setText(''); }}
          className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium border-none cursor-pointer hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
