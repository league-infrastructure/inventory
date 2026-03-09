import { useState, useEffect } from 'react';
import { LogIn, MapPin } from 'lucide-react';
import { findNearestSite, NEARBY_THRESHOLD_M } from '../../../lib/geo';
import type { SiteWithCoords } from '../../../lib/geo';

interface Props {
  objectType: 'Kit' | 'Computer';
  objectId: number;
  onDone: () => void;
}

export default function CheckInAction({ objectType, objectId, onDone }: Props) {
  const [sites, setSites] = useState<SiteWithCoords[]>([]);
  const [suggestedSite, setSuggestedSite] = useState<SiteWithCoords | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [geoStatus, setGeoStatus] = useState<'pending' | 'found' | 'denied' | 'none'>('pending');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    fetch('/api/sites')
      .then((r) => r.ok ? r.json() : [])
      .then((data: SiteWithCoords[]) => {
        setSites(data);
        // Try geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              const nearest = findNearestSite(pos.coords.latitude, pos.coords.longitude, data);
              if (nearest && nearest.distance <= NEARBY_THRESHOLD_M) {
                setSuggestedSite(nearest.site);
                setGeoStatus('found');
              } else {
                setGeoStatus('none');
                setShowPicker(true);
              }
            },
            () => {
              setGeoStatus('denied');
              setShowPicker(true);
            },
            { timeout: 5000 },
          );
        } else {
          setGeoStatus('denied');
          setShowPicker(true);
        }
      });
  }, []);

  async function doCheckIn(siteId: number) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType, objectId, siteId, custodianId: null, ...coords }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(data.error || 'Check-in failed');
      }
      const siteName = sites.find((s) => s.id === siteId)?.name || 'site';
      setSuccess(`Checked in to ${siteName}`);
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
    <div>
      {/* Suggested site from geolocation */}
      {suggestedSite && !showPicker && (
        <div>
          <button
            onClick={() => doCheckIn(suggestedSite.id)}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600 text-white text-base font-semibold border-none cursor-pointer hover:bg-green-700 disabled:opacity-50"
          >
            <MapPin size={20} />
            {busy ? 'Checking in...' : `Check In to ${suggestedSite.name}`}
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="w-full mt-2 py-2 text-sm text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-700"
          >
            Choose a different site
          </button>
        </div>
      )}

      {/* Loading geolocation */}
      {geoStatus === 'pending' && !suggestedSite && (
        <button disabled className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gray-200 text-gray-500 text-base font-semibold border-none">
          <LogIn size={20} />
          Finding your location...
        </button>
      )}

      {/* Site picker */}
      {showPicker && (
        <div className="space-y-2">
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(Number(e.target.value))}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl bg-white"
          >
            <option value="">Select a site...</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={() => selectedSiteId && doCheckIn(selectedSiteId as number)}
            disabled={busy || !selectedSiteId}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600 text-white text-base font-semibold border-none cursor-pointer hover:bg-green-700 disabled:opacity-50"
          >
            <LogIn size={20} />
            {busy ? 'Checking in...' : 'Check In'}
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-2 text-center">{error}</p>}
    </div>
  );
}
