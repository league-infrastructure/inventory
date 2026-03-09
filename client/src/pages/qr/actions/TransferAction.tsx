import { useState, useEffect } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { findNearestSite } from '../../../lib/geo';
import type { SiteWithCoords } from '../../../lib/geo';

interface Props {
  objectType: 'Kit' | 'Computer';
  objectId: number;
  userId: number;
  userName: string;
  currentCustodian: { id: number; displayName: string } | null;
  currentSite: { id: number; name: string } | null;
  onDone: () => void;
}

interface UserOption {
  id: number;
  displayName: string;
}

export default function TransferAction({
  objectType, objectId, userId,
  currentCustodian, currentSite, onDone,
}: Props) {
  const [sites, setSites] = useState<SiteWithCoords[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Default custodian: if current user is custodian, default to null (return to admin).
  // Otherwise default to current user (check out to me).
  const defaultCustodianId = currentCustodian?.id === userId ? '' : String(userId);
  const [custodianId, setCustodianId] = useState<string>(defaultCustodianId);
  const [siteId, setSiteId] = useState<string>(currentSite ? String(currentSite.id) : '');

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Load sites and users in parallel
    Promise.all([
      fetch('/api/sites').then((r) => r.ok ? r.json() : []),
      fetch('/api/auth/users').then((r) => r.ok ? r.json() : []),
    ]).then(([sitesData, usersData]: [SiteWithCoords[], UserOption[]]) => {
      setSites(sitesData);
      setUsers(usersData);

      // Try geolocation to suggest nearest site
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            const nearest = findNearestSite(pos.coords.latitude, pos.coords.longitude, sitesData);
            if (nearest && !currentSite) {
              setSiteId(String(nearest.site.id));
            }
          },
          () => {},
          { timeout: 5000 },
        );
      }
    });
  }, []);

  // Update defaults when currentCustodian changes (after a transfer)
  useEffect(() => {
    setCustodianId(currentCustodian?.id === userId ? '' : String(userId));
  }, [currentCustodian, userId]);

  async function handleTransfer() {
    setBusy(true);
    setError('');
    try {
      const body: Record<string, any> = {
        objectType,
        objectId,
        custodianId: custodianId ? Number(custodianId) : null,
        siteId: siteId ? Number(siteId) : null,
      };
      if (coords) {
        body.latitude = coords.latitude;
        body.longitude = coords.longitude;
      }
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(data.error || 'Transfer failed');
      }
      const toName = custodianId
        ? users.find((u) => u.id === Number(custodianId))?.displayName || 'user'
        : 'Admin';
      setSuccess(`Transferred to ${toName}`);
      setTimeout(() => { setSuccess(''); onDone(); }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="w-full py-4 rounded-xl bg-green-100 text-green-700 text-center font-semibold text-base">
        {success}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Transfer button */}
      <button
        onClick={handleTransfer}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-white text-base font-semibold border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
      >
        <ArrowRightLeft size={20} />
        {busy ? 'Transferring...' : 'Transfer'}
      </button>

      {/* Transfer options (indented) */}
      <div className="pl-4 space-y-2">
        <label className="block">
          <span className="text-xs text-gray-500">New Custodian</span>
          <select
            value={custodianId}
            onChange={(e) => setCustodianId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
          >
            <option value="">None (Admin)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}{u.id === userId ? ' (me)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-gray-500">New Site</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
          >
            <option value="">None</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
