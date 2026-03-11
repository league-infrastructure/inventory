import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Building2, Archive, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import TransferModal from '../../components/TransferModal';
import PhotoUpload from '../../components/PhotoUpload';
import NotesSection from '../../components/NotesSection';
import ReportIssueModal from '../../components/ReportIssueModal';
import IssuesSection from '../../components/IssuesSection';

interface Site { id: number; name: string; }
interface Kit { id: number; name: string; }
interface HostName { id: number; name: string; computerId: number | null; }

import { DISPOSITIONS, dispositionClasses } from '../../lib/dispositions';

interface Category { id: number; name: string; }

interface FormState {
  serialNumber: string;
  serviceTag: string;
  model: string;
  defaultUsername: string;
  defaultPassword: string;
  disposition: string;
  dateReceived: string;
  notes: string;
  siteId: number | '';
  kitId: number | '';
  hostNameId: number | '';
  categoryId: number | '';
}

export default function ComputerDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    serialNumber: '', serviceTag: '', model: '', defaultUsername: '',
    defaultPassword: '', disposition: 'ACTIVE', dateReceived: '',
    notes: '', siteId: '', kitId: '', hostNameId: '', categoryId: '',
  });
  const savedForm = useRef<FormState>(form);

  const [sites, setSites] = useState<Site[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [hostNames, setHostNames] = useState<HostName[]>([]);
  const [custodianName, setCustodianName] = useState<string | null>(null);
  const [imageId, setImageId] = useState<number | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  function loadComputer() {
    setLoading(true);
    Promise.all([
      fetch(`/api/computers/${id}`).then((r) => {
        if (!r.ok) throw new Error('Computer not found');
        return r.json();
      }),
      fetch('/api/sites').then((r) => r.json()),
      fetch('/api/kits').then((r) => r.json()),
      fetch('/api/hostnames').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([c, s, k, h, cats]) => {
        const initial: FormState = {
          serialNumber: c.serialNumber || '',
          serviceTag: c.serviceTag || '',
          model: c.model || '',
          defaultUsername: c.defaultUsername || '',
          defaultPassword: c.defaultPassword || '',
          disposition: c.disposition,
          dateReceived: c.dateReceived ? c.dateReceived.substring(0, 10) : '',
          notes: c.notes || '',
          siteId: c.site?.id || '',
          kitId: c.kit?.id || '',
          hostNameId: c.hostName?.id || '',
          categoryId: c.category?.id || '',
        };
        setForm(initial);
        savedForm.current = initial;
        setDirty(false);
        setQrCode(c.qrCode || null);
        setCustodianName(c.custodian?.displayName ?? null);
        setImageId(c.imageId ?? null);
        setSites(s);
        setKits(k);
        setHostNames(h);
        setCategories(cats);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadComputer();

    fetch(`/api/qr/c/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.qrDataUrl) setQrDataUrl(data.qrDataUrl); })
      .catch(() => {});
  }, [id]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setDirty(JSON.stringify(next) !== JSON.stringify(savedForm.current));
      return next;
    });
  }

  const availableHostNames = hostNames.filter(
    (h) => h.computerId === null || h.computerId === parseInt(id!, 10)
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        serialNumber: form.serialNumber || null,
        serviceTag: form.serviceTag || null,
        model: form.model || null,
        defaultUsername: form.defaultUsername || null,
        defaultPassword: form.defaultPassword || null,
        disposition: form.disposition,
        dateReceived: form.dateReceived || null,
        notes: form.notes || null,
        siteId: form.siteId || null,
        kitId: form.kitId || null,
        hostNameId: form.hostNameId || null,
        categoryId: form.categoryId || null,
      };
      const res = await fetch(`/api/computers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const inputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white";
  const displayName = form.model || `Computer #${id}`;

  return (
    <div className="max-w-lg">
      <Link to="/computers" className="text-sm text-primary hover:underline">
        &larr; Back to Computers
      </Link>

      <div className="flex items-center gap-3 mt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${dispositionClasses(form.disposition)}`}>
          {form.disposition.replace(/_/g, ' ')}
        </span>
        <button
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white border-none cursor-pointer hover:bg-amber-700"
          onClick={() => setShowIssueModal(true)}
        >
          <AlertTriangle size={14} /> Report Issue
        </button>
      </div>

      {qrDataUrl && (
        <div className="flex items-center gap-4 mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <img src={qrDataUrl} alt="QR Code" className="w-24 h-24" />
          <code className="text-xs text-gray-500">{qrCode}</code>
        </div>
      )}

      {/* Custody */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Custody</h2>
        <div className="space-y-1.5">
          <p className="text-sm text-gray-800 inline-flex items-center gap-1.5">
            <User size={14} className="shrink-0 text-gray-400" />
            <span className="font-medium">Who:</span>{' '}
            {custodianName ? (
              <span className="text-amber-600 font-medium">{custodianName}</span>
            ) : (
              <span className="text-green-600">Admin (storeroom)</span>
            )}
          </p>
          <p className="text-sm text-gray-800 inline-flex items-center gap-1.5">
            <Building2 size={14} className="shrink-0 text-gray-400" />
            <span className="font-medium">Where:</span>{' '}
            {form.siteId ? (
              <span>{sites.find((s) => s.id === form.siteId)?.name ?? '—'}</span>
            ) : (
              <span className="text-gray-400">No site</span>
            )}
          </p>
          {form.kitId && (
            <p className="text-sm text-gray-800 inline-flex items-center gap-1.5">
              <Archive size={14} className="shrink-0 text-gray-400" />
              <span className="font-medium">Kit:</span>{' '}
              <Link to={`/kits/${form.kitId}`} className="text-primary hover:underline">
                {kits.find((k) => k.id === form.kitId)?.name ?? `Kit #${form.kitId}`}
              </Link>
            </p>
          )}
        </div>
      </div>

      {!form.kitId && (
        <button
          onClick={() => setShowTransfer(true)}
          className="mb-6 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
        >
          <ArrowRightLeft size={16} />
          Transfer
        </button>
      )}

      {saveError && <p className="text-red-600 text-sm mb-4">{saveError}</p>}

      <form onSubmit={handleSave} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Model</span>
          <input value={form.model} onChange={(e) => updateField('model', e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Serial Number</span>
            <input value={form.serialNumber} onChange={(e) => updateField('serialNumber', e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Service Tag</span>
            <input value={form.serviceTag} onChange={(e) => updateField('serviceTag', e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Default Username</span>
            <input value={form.defaultUsername} onChange={(e) => updateField('defaultUsername', e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Default Password</span>
            <input value={form.defaultPassword} onChange={(e) => updateField('defaultPassword', e.target.value)} className={inputClass} />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Disposition</span>
          <select value={form.disposition} onChange={(e) => updateField('disposition', e.target.value)} className={inputClass}>
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Host Name</span>
          <select value={form.hostNameId} onChange={(e) => updateField('hostNameId', e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
            <option value="">None</option>
            {availableHostNames.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Site</span>
            <select value={form.siteId} onChange={(e) => updateField('siteId', e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
              <option value="">None</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Kit</span>
            <select value={form.kitId} onChange={(e) => updateField('kitId', e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
              <option value="">None</option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Category</span>
          <select value={form.categoryId} onChange={(e) => updateField('categoryId', e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
            <option value="">None</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Date Received</span>
          <input type="date" value={form.dateReceived} onChange={(e) => updateField('dateReceived', e.target.value)} className={inputClass} />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} className={inputClass + " resize-y"} rows={3} />
        </label>

        {dirty && (
          <div className="pt-2">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>

      <PhotoUpload objectType="Computer" objectId={parseInt(id!, 10)} imageId={imageId} onUpdate={loadComputer} />

      <IssuesSection computerId={parseInt(id!, 10)} />

      <NotesSection objectType="Computer" objectId={parseInt(id!, 10)} />

      {showTransfer && (
        <TransferModal
          objectType="Computer"
          objectId={parseInt(id!, 10)}
          onClose={() => setShowTransfer(false)}
          onComplete={loadComputer}
        />
      )}

      {showIssueModal && (
        <ReportIssueModal
          objectType="computer"
          objectId={parseInt(id!, 10)}
          objectName={displayName}
          onClose={() => setShowIssueModal(false)}
        />
      )}
    </div>
  );
}
