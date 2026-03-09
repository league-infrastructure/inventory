import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';

interface Props {
  objectType: 'Kit' | 'Computer';
  objectId: number;
  userId: number;
  userName: string;
  onDone: () => void;
}

export default function CheckOutAction({ objectType, objectId, userId, userName, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { timeout: 5000 },
      );
    }
  }, []);

  async function handleCheckOut() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType, objectId, custodianId: userId, ...coords }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(data.error || 'Check-out failed');
      }
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onDone(); }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="w-full py-4 rounded-xl bg-green-100 text-green-700 text-center font-semibold text-base">
        Checked out to {userName}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleCheckOut}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-white text-base font-semibold border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
      >
        <LogOut size={20} />
        {busy ? 'Checking out...' : 'Check Out to Me'}
      </button>
      {error && <p className="text-red-600 text-sm mt-2 text-center">{error}</p>}
    </div>
  );
}
