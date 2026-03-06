import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Copy, Trash2, Plus, X } from 'lucide-react';
import EditableCell from '../../components/EditableCell';

interface Item {
  id: number;
  name: string;
  type: string;
  expectedQuantity: number | null;
}

interface Pack {
  id: number;
  name: string;
  description: string | null;
  qrCode: string | null;
  items: Item[];
}

interface Computer {
  id: number;
  serialNumber: string | null;
  model: string | null;
  hostName: { name: string } | null;
}

interface CheckoutRecord {
  id: number;
  kitId: number;
  userId: number;
  checkedOutAt: string;
  checkedInAt: string | null;
  user: { id: number; displayName: string };
  returnSite: { id: number; name: string } | null;
}

interface Site { id: number; name: string; }

type ContainerType = 'BAG' | 'LARGE_TOTE' | 'SMALL_TOTE' | 'DUFFEL';

const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  BAG: 'Bag',
  LARGE_TOTE: 'Large Tote',
  SMALL_TOTE: 'Small Tote',
  DUFFEL: 'Duffel',
};

interface FormState {
  number: number | '';
  containerType: ContainerType;
  name: string;
  description: string;
  siteId: number | '';
}

export default function KitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [cloning, setCloning] = useState(false);

  const [form, setForm] = useState<FormState>({ number: '', containerType: 'BAG', name: '', description: '', siteId: '' });
  const savedForm = useRef<FormState>(form);

  const [status, setStatus] = useState('ACTIVE');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  // Checkout state
  const [checkoutHistory, setCheckoutHistory] = useState<CheckoutRecord[]>([]);
  const [checkoutMode, setCheckoutMode] = useState<'idle' | 'checkin'>('idle');
  const [checkoutSiteId, setCheckoutSiteId] = useState<number | ''>('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [showPackForm, setShowPackForm] = useState(false);
  const [packName, setPackName] = useState('');
  const [packDesc, setPackDesc] = useState('');
  const [templatePackId, setTemplatePackId] = useState<number | null>(null);
  const [allPacks, setAllPacks] = useState<Pack[]>([]);
  const [packSuggestions, setPackSuggestions] = useState<Pack[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [itemForms, setItemForms] = useState<Record<number, boolean>>({});
  const [newItem, setNewItem] = useState({ name: '', type: 'COUNTED', expectedQuantity: 1 });

  // Computer add/remove
  const [showComputerAdd, setShowComputerAdd] = useState(false);
  const [availableComputers, setAvailableComputers] = useState<Computer[]>([]);
  const [selectedComputerId, setSelectedComputerId] = useState<number | ''>('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/kits/${id}`).then((r) => {
        if (!r.ok) throw new Error('Kit not found');
        return r.json();
      }),
      fetch('/api/sites').then((r) => r.json()),
      fetch(`/api/checkouts/history/${id}`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([kit, s, history]) => {
        const initial: FormState = {
          number: kit.number,
          containerType: kit.containerType,
          name: kit.name,
          description: kit.description || '',
          siteId: kit.site.id,
        };
        setForm(initial);
        savedForm.current = initial;
        setStatus(kit.status);
        setQrCode(kit.qrCode || null);
        setPacks(kit.packs);
        setComputers(kit.computers);
        setSites(s);
        setCheckoutHistory(history);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setDirty(JSON.stringify(next) !== JSON.stringify(savedForm.current));
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/kits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          siteId: form.siteId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      savedForm.current = { ...form };
      setDirty(false);
    } catch (e: any) {
      setSaveError(e.message);
    }
    setSaving(false);
  }

  async function updateKitField(field: string, value: string) {
    setSaveError(null);
    const body: any = {};
    if (field === 'siteId') {
      body.siteId = parseInt(value, 10);
    } else if (field === 'number') {
      body.number = parseInt(value, 10);
    } else {
      body[field] = value || null;
    }
    try {
      const res = await fetch(`/api/kits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      const updated = await res.json();
      const next: FormState = {
        number: updated.number,
        containerType: updated.containerType,
        name: updated.name,
        description: updated.description || '',
        siteId: updated.site.id,
      };
      setForm(next);
      savedForm.current = next;
      setDirty(false);
    } catch (e: any) {
      setSaveError(e.message);
    }
  }

  async function handleClone() {
    setCloning(true);
    try {
      const res = await fetch(`/api/kits/${id}/clone`, { method: 'POST' });
      if (!res.ok) throw new Error('Clone failed');
      const cloned = await res.json();
      navigate(`/kits/${cloned.id}`);
    } catch (e: any) {
      setError(e.message);
    }
    setCloning(false);
  }

  async function handleRetire() {
    const res = await fetch(`/api/kits/${id}/retire`, { method: 'PATCH' });
    if (res.ok) {
      const updated = await res.json();
      setStatus(updated.status);
    }
  }

  async function fetchCheckoutHistory() {
    const res = await fetch(`/api/checkouts/history/${id}`);
    if (res.ok) setCheckoutHistory(await res.json());
  }

  const openCheckout = checkoutHistory.find((c) => c.checkedInAt === null);

  async function requestNearestSite(): Promise<number | null> {
    setGeoLoading(true);
    setCheckoutError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const res = await fetch('/api/sites/nearest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.site.id as number;
      }
      return null;
    } catch {
      // GPS not available or denied — user can still pick manually
      return null;
    } finally {
      setGeoLoading(false);
    }
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitId: Number(id) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Checkout failed');
      }
      await fetchCheckoutHistory();
    } catch (e: any) {
      setCheckoutError(e.message);
    }
    setCheckoutLoading(false);
  }

  async function startCheckin() {
    setCheckoutMode('checkin');
    setCheckoutSiteId('');
    const nearestId = await requestNearestSite();
    if (nearestId) setCheckoutSiteId(nearestId);
  }

  // confirmCheckout removed — checkout is now immediate via startCheckout

  async function confirmCheckin() {
    if (!openCheckout || !checkoutSiteId) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch(`/api/checkouts/${openCheckout.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSiteId: checkoutSiteId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Check-in failed');
      }
      setCheckoutMode('idle');
      await fetchCheckoutHistory();
    } catch (e: any) {
      setCheckoutError(e.message);
    }
    setCheckoutLoading(false);
  }

  async function fetchAllPacks() {
    if (allPacks.length > 0) return;
    const res = await fetch('/api/packs');
    if (res.ok) setAllPacks(await res.json());
  }

  function handlePackNameChange(value: string) {
    setPackName(value);
    setTemplatePackId(null);
    if (value.trim().length >= 2) {
      const lower = value.toLowerCase();
      const matches = allPacks.filter((p) => p.name.toLowerCase().includes(lower));
      // Dedupe by name — show one representative per unique pack name
      const seen = new Set<string>();
      const unique = matches.filter((p) => {
        const key = p.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setPackSuggestions(unique.slice(0, 8));
      setShowSuggestions(unique.length > 0);
      setSuggestionIndex(-1);
    } else {
      setPackSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function selectSuggestion(pack: Pack) {
    setPackName(pack.name);
    setPackDesc(pack.description || '');
    setTemplatePackId(pack.id);
    setShowSuggestions(false);
    setSuggestionIndex(-1);
  }

  function handlePackNameKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || packSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestionIndex((prev) => Math.min(prev + 1, packSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && suggestionIndex >= 0) {
      e.preventDefault();
      selectSuggestion(packSuggestions[suggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  function packItemSummary(items: Item[]): string {
    if (items.length === 0) return 'Empty';
    return items.map((i) => {
      const qty = i.expectedQuantity != null ? `${i.expectedQuantity}x ` : '';
      return `${qty}${i.name}`;
    }).join(', ');
  }

  async function handleAddPack(e: React.FormEvent) {
    e.preventDefault();
    const body: any = { name: packName, description: packDesc || null };
    if (templatePackId) body.templatePackId = templatePackId;
    const res = await fetch(`/api/kits/${id}/packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const pack = await res.json();
      setPacks((prev) => [...prev, pack]);
      setPackName('');
      setPackDesc('');
      setTemplatePackId(null);
      setShowPackForm(false);
    }
  }

  async function handleAddItem(packId: number) {
    const res = await fetch(`/api/packs/${packId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    if (res.ok) {
      const item = await res.json();
      setPacks((prev) =>
        prev.map((p) => p.id === packId ? { ...p, items: [...p.items, item] } : p)
      );
      setNewItem({ name: '', type: 'COUNTED', expectedQuantity: 1 });
      setItemForms((prev) => ({ ...prev, [packId]: false }));
    }
  }

  async function handleDeletePack(packId: number) {
    const res = await fetch(`/api/packs/${packId}`, { method: 'DELETE' });
    if (res.ok) {
      setPacks((prev) => prev.filter((p) => p.id !== packId));
    }
  }

  async function handleDeleteItem(packId: number, itemId: number) {
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      setPacks((prev) =>
        prev.map((p) => p.id === packId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p)
      );
    }
  }

  async function fetchAvailableComputers() {
    const res = await fetch('/api/computers?disposition=ACTIVE');
    if (res.ok) {
      const all: Computer[] = await res.json();
      // Filter out computers already in this kit
      const kitComputerIds = new Set(computers.map((c) => c.id));
      setAvailableComputers(all.filter((c) => !kitComputerIds.has(c.id)));
    }
  }

  async function handleAddComputer() {
    if (!selectedComputerId) return;
    const res = await fetch(`/api/computers/${selectedComputerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitId: Number(id) }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComputers((prev) => [...prev, updated]);
      setAvailableComputers((prev) => prev.filter((c) => c.id !== selectedComputerId));
      setSelectedComputerId('');
      setShowComputerAdd(false);
    }
  }

  async function handleRemoveComputer(computerId: number) {
    const res = await fetch(`/api/computers/${computerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitId: null }),
    });
    if (res.ok) {
      setComputers((prev) => prev.filter((c) => c.id !== computerId));
    }
  }

  async function handleUpdatePack(packId: number, field: string, value: string) {
    const res = await fetch(`/api/packs/${packId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPacks((prev) => prev.map((p) => p.id === packId ? { ...p, name: updated.name, description: updated.description } : p));
    }
  }

  async function handleUpdateItem(packId: number, itemId: number, field: string, value: string) {
    const body: any = { [field]: value };
    if (field === 'expectedQuantity') body[field] = value ? parseInt(value, 10) : null;
    const res = await fetch(`/api/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setPacks((prev) => prev.map((p) =>
        p.id === packId ? { ...p, items: p.items.map((i) => i.id === itemId ? updated : i) } : p
      ));
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const inputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white";

  return (
    <div className="max-w-4xl">
      <Link to="/kits" className="text-sm text-primary hover:underline">
        &larr; Back to Kits
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-4 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {form.containerType ? CONTAINER_TYPE_LABELS[form.containerType] : ''} {form.number} — <EditableCell value={form.name} onSave={(v) => updateKitField('name', v)} />
          </h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {status}
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'ACTIVE' && (
            <>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-600 text-white border-none cursor-pointer hover:bg-gray-700"
                onClick={handleClone}
                disabled={cloning}
              >
                <Copy size={14} /> {cloning ? 'Cloning...' : 'Clone'}
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white border-none cursor-pointer hover:bg-red-700"
                onClick={handleRetire}
              >
                Retire
              </button>
            </>
          )}
        </div>
      </div>

      {qrCode && (
        <div className="mb-6 px-4 py-2 bg-gray-50 rounded-lg text-sm">
          <strong>QR Code:</strong> <code className="text-xs">{qrCode}</code>
        </div>
      )}

      {saveError && <p className="text-red-600 text-sm mb-4">{saveError}</p>}

      {/* Kit fields — click to edit */}
      <div className="space-y-3 mb-8">
        <div className="flex gap-6 flex-wrap">
          <div>
            <span className="text-sm font-medium text-gray-500">Number</span>
            <div className="text-sm text-gray-700 mt-0.5">
              {form.number}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Container</span>
            <div className="text-sm text-gray-700 mt-0.5">
              <EditableCell
                value={form.containerType}
                onSave={(v) => updateKitField('containerType', v)}
                as="select"
                options={Object.entries(CONTAINER_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Site</span>
            <div className="text-sm text-gray-700 mt-0.5">
              <EditableCell
                value={String(form.siteId)}
                onSave={(v) => updateKitField('siteId', v)}
                as="select"
                options={sites.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </div>
          </div>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-500">Description</span>
          <div className="text-sm text-gray-700 mt-0.5">
            <EditableCell value={form.description} onSave={(v) => updateKitField('description', v)} placeholder="add description" />
          </div>
        </div>
      </div>

      {/* Checkout / Check-in */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Checkout Status</h2>

        {openCheckout ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-gray-800">
              <span className="font-medium">Checked out</span> by{' '}
              <span className="font-medium">{openCheckout.user.displayName}</span> on{' '}
              {new Date(openCheckout.checkedOutAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>

            {checkoutMode !== 'checkin' && (
              <button
                className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
                onClick={startCheckin}
                disabled={geoLoading}
              >
                {geoLoading ? 'Getting location...' : 'Check In'}
              </button>
            )}

            {checkoutMode === 'checkin' && (
              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Return site</span>
                  <select
                    value={checkoutSiteId}
                    onChange={(e) => setCheckoutSiteId(parseInt(e.target.value, 10))}
                    className={inputClass}
                    required
                  >
                    <option value="">Select a site...</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
                    onClick={confirmCheckin}
                    disabled={checkoutLoading || !checkoutSiteId}
                  >
                    {checkoutLoading ? 'Checking in...' : 'Confirm Check In'}
                  </button>
                  <button
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-500 text-white border-none cursor-pointer hover:bg-gray-600"
                    onClick={() => setCheckoutMode('idle')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : status === 'ACTIVE' ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">This kit is available for checkout.</p>

            <button
              className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              onClick={startCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Checking out...' : 'Check Out'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Kit is {status.toLowerCase()} and cannot be checked out.</p>
        )}

        {checkoutError && <p className="text-red-600 text-sm mt-2">{checkoutError}</p>}

        {/* Recent checkout history */}
        {checkoutHistory.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">History</h3>
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">User</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Checked Out</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Return Site</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Checked In</th>
                  </tr>
                </thead>
                <tbody>
                  {checkoutHistory.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="px-4 py-2">{c.user.displayName}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {new Date(c.checkedOutAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{c.returnSite?.name || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {c.checkedInAt
                          ? new Date(c.checkedInAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : <span className="text-amber-600 font-medium">Open</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Packs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Packs ({packs.length})</h2>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
            onClick={() => { setShowPackForm(!showPackForm); fetchAllPacks(); }}
          >
            <Plus size={14} /> Add Pack
          </button>
        </div>

        {showPackForm && (
          <form onSubmit={handleAddPack} className="mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[150px]">
                <input
                  placeholder="Pack name (type to search existing)"
                  value={packName}
                  onChange={(e) => handlePackNameChange(e.target.value)}
                  onKeyDown={handlePackNameKeyDown}
                  onFocus={() => { if (packSuggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  required
                  autoComplete="off"
                />
                {showSuggestions && packSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {packSuggestions.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer ${
                          idx === suggestionIndex ? 'bg-primary/10' : 'bg-white hover:bg-gray-50'
                        }`}
                        onMouseDown={() => selectSuggestion(p)}
                      >
                        <div className="font-medium text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500 truncate">{packItemSummary(p.items)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                placeholder="Description (optional)"
                value={packDesc}
                onChange={(e) => setPackDesc(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm flex-1 min-w-[150px]"
              />
              <button type="submit" className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-white border-none cursor-pointer">
                Save
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-500 text-white border-none cursor-pointer"
                onClick={() => { setShowPackForm(false); setShowSuggestions(false); }}
              >
                Cancel
              </button>
            </div>
            {templatePackId && (
              <p className="text-xs text-green-600 mt-1">
                Items will be copied from existing pack template.
              </p>
            )}
          </form>
        )}

        {packs.map((pack) => (
          <div key={pack.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 flex-wrap">
                <strong className="text-gray-900">
                  <EditableCell value={pack.name} onSave={(v) => handleUpdatePack(pack.id, 'name', v)} />
                </strong>
                <span className="text-gray-400 text-sm">—</span>
                <span className="text-gray-500 text-sm">
                  <EditableCell value={pack.description || ''} onSave={(v) => handleUpdatePack(pack.id, 'description', v)} placeholder="add description" />
                </span>
                {pack.qrCode && <code className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pack.qrCode}</code>}
              </div>
              <div className="flex gap-2">
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-primary text-white border-none cursor-pointer"
                  onClick={() => setItemForms((prev) => ({ ...prev, [pack.id]: true }))}
                >
                  <Plus size={12} /> Item
                </button>
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-600 text-white border-none cursor-pointer"
                  onClick={() => handleDeletePack(pack.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {itemForms[pack.id] && (
              <div className="flex flex-wrap gap-2 mb-3 items-center">
                <input
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[120px]"
                  required
                />
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="COUNTED">Counted</option>
                  <option value="CONSUMABLE">Consumable</option>
                </select>
                {newItem.type === 'COUNTED' && (
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={newItem.expectedQuantity}
                    onChange={(e) => setNewItem({ ...newItem, expectedQuantity: parseInt(e.target.value) || 1 })}
                    className="px-2 py-1 border border-gray-300 rounded text-sm w-16"
                  />
                )}
                <button
                  className="px-2 py-1 text-xs rounded bg-primary text-white border-none cursor-pointer"
                  onClick={() => handleAddItem(pack.id)}
                >
                  Save
                </button>
                <button
                  className="px-2 py-1 text-xs rounded bg-gray-500 text-white border-none cursor-pointer"
                  onClick={() => setItemForms((prev) => ({ ...prev, [pack.id]: false }))}
                >
                  Cancel
                </button>
              </div>
            )}

            {pack.items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Item</th>
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Type</th>
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500">Qty</th>
                    <th className="py-1.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {pack.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1.5 px-2">
                        <EditableCell value={item.name} onSave={(v) => handleUpdateItem(pack.id, item.id, 'name', v)} />
                      </td>
                      <td className="py-1.5 px-2 text-gray-500">
                        <EditableCell
                          value={item.type}
                          onSave={(v) => handleUpdateItem(pack.id, item.id, 'type', v)}
                          as="select"
                          options={[{ value: 'COUNTED', label: 'Counted' }, { value: 'CONSUMABLE', label: 'Consumable' }]}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-gray-500">
                        <EditableCell
                          value={item.expectedQuantity != null ? String(item.expectedQuantity) : ''}
                          onSave={(v) => handleUpdateItem(pack.id, item.id, 'expectedQuantity', v)}
                          as="number"
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <button
                          className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer"
                          onClick={() => handleDeleteItem(pack.id, item.id)}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-400 text-sm">No items in this pack.</p>
            )}
          </div>
        ))}
      </div>

      {/* Computers */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Computers ({computers.length})</h2>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
            onClick={() => { setShowComputerAdd(!showComputerAdd); fetchAvailableComputers(); }}
          >
            <Plus size={14} /> Add Computer
          </button>
        </div>

        {showComputerAdd && (
          <div className="flex gap-2 mb-4 items-center">
            <select
              value={selectedComputerId}
              onChange={(e) => setSelectedComputerId(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="">Select a computer...</option>
              {availableComputers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.hostName?.name || `#${c.id}`} — {c.model || 'Unknown model'} {c.serialNumber ? `(${c.serialNumber})` : ''}
                </option>
              ))}
            </select>
            <button
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-white border-none cursor-pointer disabled:opacity-50"
              onClick={handleAddComputer}
              disabled={!selectedComputerId}
            >
              Add
            </button>
            <button
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-500 text-white border-none cursor-pointer"
              onClick={() => setShowComputerAdd(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {computers.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Host Name</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Model</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Serial</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {computers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="px-4 py-2">
                      <Link to={`/computers/${c.id}`} className="text-primary hover:underline">
                        {c.hostName?.name || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{c.model || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{c.serialNumber || '—'}</td>
                    <td className="px-4 py-2">
                      <button
                        className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer"
                        onClick={() => handleRemoveComputer(c.id)}
                        title="Remove from kit"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No computers in this kit.</p>
        )}
      </div>
    </div>
  );
}
