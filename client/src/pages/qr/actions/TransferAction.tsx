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
  currentCustodian, onDone,
}: Props) {
  const [sites, setSites] = useState<SiteWithCoords[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Track the "return to admin" site (nearest or home) for defaulting
  const [returnSiteId, setReturnSiteId] = useState<string>('');

  // Default custodian: if current user is custodian, default to null (return to admin).
  // Otherwise default to current user (check out to me).
  const isMyItem = currentCustodian?.id === userId;
  const defaultCustodianId = isMyItem ? '' : String(userId);
  const [custodianId, setCustodianId] = useState<string>(defaultCustodianId);

  // Site default depends on direction:
  // - Checking out to a person → none (they're taking it)
  // - Returning to admin → nearest site or home site
  const [siteId, setSiteId] = useState<string>(isMyItem ? '' : '');

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

      // Find home site as fallback
      const home = sitesData.find((s: any) => s.isHomeSite);
      const homeSiteStr = home ? String(home.id) : '';

      // Try geolocation to find nearest site
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            const nearest = findNearestSite(pos.coords.latitude, pos.coords.longitude, sitesData);
            const bestReturnSite = nearest ? String(nearest.site.id) : homeSiteStr;
            setReturnSiteId(bestReturnSite);
            // If returning to admin, default site to nearest/home
            if (isMyItem) {
              setSiteId(bestReturnSite);
            }
          },
          () => {
            // Geolocation denied — use home site for returns
            setReturnSiteId(homeSiteStr);
            if (isMyItem) {
              setSiteId(homeSiteStr);
            }
          },
          { timeout: 5000 },
        );
      } else {
        setReturnSiteId(homeSiteStr);
        if (isMyItem) {
          setSiteId(homeSiteStr);
        }
      }
    });
  }, []);

  // Update defaults when currentCustodian changes (after a transfer)
  useEffect(() => {
    const newIsMyItem = currentCustodian?.id === userId;
    const newCustodianId = newIsMyItem ? '' : String(userId);
    setCustodianId(newCustodianId);
    // Return to admin → suggest nearest/home site; check out → none
    setSiteId(newCustodianId ? '' : returnSiteId);
  }, [currentCustodian, userId, returnSiteId]);

  // When custodian dropdown changes, update site default
  function handleCustodianChange(newCustodianId: string) {
    setCustodianId(newCustodianId);
    // Checking out to a person → clear site; returning to admin → suggest site
    setSiteId(newCustodianId ? '' : returnSiteId);
  }

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
            onChange={(e) => handleCustodianChange(e.target.value)}
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
