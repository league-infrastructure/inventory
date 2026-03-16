import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Copy, Trash2, Plus, X, Printer, User, Building2, AlertTriangle } from 'lucide-react';
import ReportIssueModal from '../../components/ReportIssueModal';
import EditableCell from '../../components/EditableCell';
import InventoryCheckSection from '../../components/InventoryCheckSection';
import LabelPrintModal from '../../components/LabelPrintModal';
import PhotoUpload from '../../components/PhotoUpload';
import NotesSection from '../../components/NotesSection';
import IssuesSection from '../../components/IssuesSection';
import type { ContainerType } from '../../lib/containers';
import { CONTAINER_TYPE_LABELS } from '../../lib/containers';

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
  imageId: number | null;
  items: Item[];
}

interface Computer {
  id: number;
  serialNumber: string | null;
  model: string | null;
  hostName: { name: string } | null;
}

interface TransferRecord {
  id: number;
  objectType: string;
  objectId: number;
  userId: number;
  fromCustodian: string | null;
  toCustodian: string | null;
  fromSiteId: number | null;
  toSiteId: number | null;
  notes: string | null;
  createdAt: string;
  user: { id: number; displayName: string };
}

interface Site { id: number; name: string; }


interface Category { id: number; name: string; }

interface FormState {
  number: number | '';
  containerType: ContainerType;
  name: string;
  description: string;
  siteId: number | '';
  categoryId: number | '';
}

export default function KitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, setDirty] = useState(false);
  const [cloning, setCloning] = useState(false);

  const [form, setForm] = useState<FormState>({ number: '', containerType: 'BAG', name: '', description: '', siteId: '', categoryId: '' });
  const savedForm = useRef<FormState>(form);

  const [status, setStatus] = useState('ACTIVE');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Transfer state
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [custodianName, setCustodianName] = useState<string | null>(null);
  const [imageId, setImageId] = useState<number | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

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

  // Label printing
  const [showLabelModal, setShowLabelModal] = useState(false);
  // Issue reporting
  const [showIssueModal, setShowIssueModal] = useState(false);

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
      fetch(`/api/transfers/history/Kit/${id}`).then((r) => r.ok ? r.json() : []),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([kit, s, history, cats]) => {
        const initial: FormState = {
          number: kit.number,
          containerType: kit.containerType,
          name: kit.name,
          description: kit.description || '',
          siteId: kit.site?.id ?? '',
          categoryId: kit.category?.id ?? '',
        };
        setCategories(cats);
        setForm(initial);
        savedForm.current = initial;
        setStatus(kit.status);
        setPacks(kit.packs);
        setComputers(kit.computers);
        setSites(s);
        setCustodianName(kit.custodian?.displayName ?? null);
        setImageId(kit.imageId ?? null);
        setTransferHistory(history);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function updateKitField(field: string, value: string) {
    setSaveError(null);
    const body: any = {};
    if (field === 'siteId') {
      body.siteId = parseInt(value, 10);
    } else if (field === 'categoryId') {
      body.categoryId = value ? parseInt(value, 10) : null;
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
        siteId: updated.site?.id ?? '',
        categoryId: updated.category?.id ?? '',
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

  async function fetchTransferHistory() {
    const res = await fetch(`/api/transfers/history/Kit/${id}`);
    if (res.ok) setTransferHistory(await res.json());
  }

  async function handleTransfer(custodianId: number | null, siteId: number | null, notes?: string) {
    setTransferLoading(true);
    setTransferError(null);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType: 'Kit', objectId: Number(id), custodianId, siteId, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Transfer failed');
      }
      // Reload kit data
      const kitRes = await fetch(`/api/kits/${id}`);
      if (kitRes.ok) {
        const kit = await kitRes.json();
        setCustodianName(kit.custodian?.displayName ?? null);
        const next: FormState = {
          number: kit.number,
          containerType: kit.containerType,
          name: kit.name,
          description: kit.description || '',
          siteId: kit.site?.id ?? '',
          categoryId: kit.category?.id ?? '',
        };
        setForm(next);
        savedForm.current = next;
      }
      await fetchTransferHistory();
      setShowTransferModal(false);
    } catch (e: any) {
      setTransferError(e.message);
    }
    setTransferLoading(false);
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

  return (
    <div className="max-w-4xl">
      <Link to="/kits" className="text-sm text-primary hover:underline">
        &larr; Back to Kits
      </Link>

      {/* Header: title + status + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 mb-6">
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
        {status === 'ACTIVE' && (
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white border-none cursor-pointer hover:bg-amber-700"
              onClick={() => setShowIssueModal(true)}
            >
              <AlertTriangle size={14} /> Report Issue
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
              onClick={() => setShowLabelModal(true)}
            >
              <Printer size={14} /> Print Labels
            </button>
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
          </div>
        )}
      </div>

      {saveError && <p className="text-red-600 text-sm mb-4">{saveError}</p>}

      {/* Two-column layout: details left, QR + custody right */}
      <div className="flex gap-6 mb-8 items-stretch">
        {/* Left column: kit fields as form grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 flex-1">
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Number</label>
              <div className="text-lg text-gray-900">{form.number}</div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Container</label>
              <div className="text-lg text-gray-900">
                <EditableCell
                  value={form.containerType}
                  onSave={(v) => updateKitField('containerType', v)}
                  as="select"
                  options={Object.entries(CONTAINER_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Site</label>
              <div className="text-lg text-gray-900">
                <EditableCell
                  value={String(form.siteId)}
                  onSave={(v) => updateKitField('siteId', v)}
                  as="select"
                  options={sites.map((s) => ({ value: String(s.id), label: s.name }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Category</label>
              <div className="text-lg text-gray-900">
                <EditableCell
                  value={String(form.categoryId)}
                  onSave={(v) => updateKitField('categoryId', v)}
                  as="select"
                  options={[{ value: '', label: 'None' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
                />
              </div>
            </div>
            <div className="col-span-2 flex flex-col">
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</label>
              <textarea
                className="w-full flex-1 min-h-[3rem] px-3 py-2 text-base text-gray-900 border border-gray-300 rounded-md resize-vertical focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                rows={2}
                value={form.description}
                placeholder="Add description..."
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                onBlur={(e) => updateKitField('description', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right column: QR + custody in one card */}
        <div className="w-60 shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
            {/* QR code */}
            <div className="flex flex-col items-center">
              <img
                src={`/api/labels/qr/k/${id}?v=${Date.now()}`}
                alt="QR code"
                className="w-20 h-20"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <code className="text-[10px] text-gray-400 mt-1">/qr/k/{id}</code>
            </div>

            <hr className="border-gray-200" />

            {/* Custody */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Custody</h3>
              <div className="space-y-3">
                <p className="text-base inline-flex items-center gap-2">
                  <User size={16} className="shrink-0 text-gray-400" />
                  {custodianName ? (
                    <span className="text-amber-600 font-medium">{custodianName}</span>
                  ) : (
                    <span className="text-green-600 font-medium">Storeroom</span>
                  )}
                </p>
                <p className="text-base inline-flex items-center gap-2">
                  <Building2 size={16} className="shrink-0 text-gray-400" />
                  {form.siteId ? (
                    <span className="text-gray-700">{sites.find((s) => s.id === form.siteId)?.name ?? '—'}</span>
                  ) : (
                    <span className="text-gray-400">No site</span>
                  )}
                </p>
              </div>
              {status === 'ACTIVE' && (
                <button
                  className="mt-4 w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
                  onClick={() => setShowTransferModal(true)}
                >
                  Transfer
                </button>
              )}
              {transferError && <p className="text-red-600 text-xs mt-1">{transferError}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Transfer modal */}
      {showTransferModal && (
        <TransferModal
          sites={sites}
          loading={transferLoading}
          onConfirm={handleTransfer}
          onClose={() => setShowTransferModal(false)}
        />
      )}

      {/* Inventory Check */}
      <div id="inventory-check-section">
        <InventoryCheckSection kitId={Number(id)} packs={packs} computers={computers} />
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
              <div className="flex gap-2 items-center">
                <PhotoUpload
                  objectType="Pack"
                  objectId={pack.id}
                  imageId={pack.imageId ?? null}
                  onUpdate={() => {
                    fetch(`/api/kits/${id}`).then((r) => r.ok ? r.json() : null)
                      .then((kit) => { if (kit) setPacks(kit.packs); });
                  }}
                  compact
                />
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

            <NotesSection objectType="Pack" objectId={pack.id} />
          </div>
        ))}
      </div>

      {/* Computers */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Computers ({computers.length})</h2>
          <div className="flex gap-2">
            {computers.length > 0 && (
              <button
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
                onClick={async () => {
                  const ids = computers.map((c) => c.id);
                  const pdfWindow = window.open('', '_blank');
                  try {
                    const res = await fetch('/api/labels/computers/batch', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ computerIds: ids }),
                    });
                    if (!res.ok) throw new Error('Failed to generate labels');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    if (pdfWindow) pdfWindow.location.href = url;
                    else window.open(url, '_blank');
                  } catch {
                    if (pdfWindow) pdfWindow.close();
                  }
                }}
              >
                <Printer size={14} /> Print Labels
              </button>
            )}
            <button
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover"
              onClick={() => { setShowComputerAdd(!showComputerAdd); fetchAvailableComputers(); }}
            >
              <Plus size={14} /> Add Computer
            </button>
          </div>
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

      <PhotoUpload
        objectType="Kit"
        objectId={Number(id)}
        imageId={imageId}
        onUpdate={() => {
          fetch(`/api/kits/${id}`).then((r) => r.ok ? r.json() : null)
            .then((kit) => { if (kit) setImageId(kit.imageId ?? null); });
        }}
      />

      {/* Transfer history */}
      {transferHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Transfer History</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">By</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">From</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">To</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="px-4 py-2">{t.user.displayName}</td>
                    <td className="px-4 py-2 text-gray-600">{t.fromCustodian || 'Admin'}</td>
                    <td className="px-4 py-2 text-gray-600">{t.toCustodian || 'Admin'}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <IssuesSection kitId={Number(id)} />

      <NotesSection objectType="Kit" objectId={Number(id)} />

      {showLabelModal && (
        <LabelPrintModal
          kitId={Number(id)}
          kitName={`${form.number} — ${form.name}`}
          packs={packs}
          onClose={() => setShowLabelModal(false)}
        />
      )}

      {showIssueModal && (
        <ReportIssueModal
          objectType="kit"
          objectId={Number(id)}
          objectName={`Kit ${form.number} — ${form.name}`}
          onClose={() => setShowIssueModal(false)}
        />
      )}
    </div>
  );
}

function TransferModal({ sites, loading, onConfirm, onClose }: {
  sites: Site[];
  loading: boolean;
  onConfirm: (custodianId: number | null, siteId: number | null, notes?: string) => void;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<{ id: number; displayName: string }[]>([]);
  const [custodianId, setCustodianId] = useState<number | ''>('');
  const [siteId, setSiteId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch('/api/auth/users')
      .then((r) => r.ok ? r.json() : [])
      .then(setUsers);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Transfer Kit</h3>

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
            onClick={() => onConfirm(
              custodianId === '' ? null : custodianId,
              siteId === '' ? null : siteId,
              notes || undefined,
            )}
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
