import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Building2, Archive, AlertTriangle, Printer, Eye, EyeOff } from 'lucide-react';
import TransferModal from '../../components/TransferModal';
import PhotoUpload from '../../components/PhotoUpload';
import NotesSection from '../../components/NotesSection';
import ReportIssueModal from '../../components/ReportIssueModal';
import IssuesSection from '../../components/IssuesSection';
import EditableCell from '../../components/EditableCell';

interface Site { id: number; name: string; }
interface Kit { id: number; name: string; number: number; }
interface HostName { id: number; name: string; computerId: number | null; }

import { DISPOSITIONS, dispositionClasses } from '../../lib/dispositions';

interface Category { id: number; name: string; }

interface FormState {
  serialNumber: string;
  serviceTag: string;
  model: string;
  modelNumber: string;
  adminUsername: string;
  adminPassword: string;
  studentUsername: string;
  studentPassword: string;
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
  const [showCredentials, setShowCredentials] = useState(false);

  const [form, setForm] = useState<FormState>({
    serialNumber: '', serviceTag: '', model: '', modelNumber: '', adminUsername: '',
    adminPassword: '', studentUsername: '', studentPassword: '',
    disposition: 'ACTIVE', dateReceived: '',
    notes: '', siteId: '', kitId: '', hostNameId: '', categoryId: '',
  });
  const savedForm = useRef<FormState>(form);

  const [sites, setSites] = useState<Site[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [hostNames, setHostNames] = useState<HostName[]>([]);
  const [custodianId, setCustodianId] = useState<number | null>(null);
  const [custodianName, setCustodianName] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: number; displayName: string }[]>([]);
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
      fetch('/api/auth/users').then((r) => r.ok ? r.json() : []),
    ])
      .then(([c, s, k, h, cats, u]) => {
        const initial: FormState = {
          serialNumber: c.serialNumber || '',
          serviceTag: c.serviceTag || '',
          model: c.model || '',
          modelNumber: c.modelNumber || '',
          adminUsername: c.adminUsername || '',
          adminPassword: c.adminPassword || '',
          studentUsername: c.studentUsername || '',
          studentPassword: c.studentPassword || '',
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
        setCustodianId(c.custodian?.id ?? null);
        setCustodianName(c.custodian?.displayName ?? null);
        setImageId(c.imageId ?? null);
        setSites(s);
        setKits(k);
        setHostNames(h);
        setCategories(cats);
        setUsers(u);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadComputer();
  }, [id]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setDirty(JSON.stringify(next) !== JSON.stringify(savedForm.current));
      return next;
    });
  }

  async function saveField(field: string, value: string) {
    setSaveError(null);
    const body: Record<string, unknown> = {};
    if (field === 'siteId' || field === 'kitId' || field === 'hostNameId' || field === 'categoryId') {
      body[field] = value ? parseInt(value, 10) : null;
    } else if (field === 'disposition') {
      body[field] = value;
    } else {
      body[field] = value || null;
    }
    try {
      const res = await fetch(`/api/computers/${id}`, {
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
        serialNumber: updated.serialNumber || '',
        serviceTag: updated.serviceTag || '',
        model: updated.model || '',
        modelNumber: updated.modelNumber || '',
        adminUsername: updated.adminUsername || '',
        adminPassword: updated.adminPassword || '',
        studentUsername: updated.studentUsername || '',
        studentPassword: updated.studentPassword || '',
        disposition: updated.disposition,
        dateReceived: updated.dateReceived ? updated.dateReceived.substring(0, 10) : '',
        notes: updated.notes || '',
        siteId: updated.site?.id || '',
        kitId: updated.kit?.id || '',
        hostNameId: updated.hostName?.id || '',
        categoryId: updated.category?.id || '',
      };
      setForm(next);
      savedForm.current = next;
      setDirty(false);
      setCustodianId(updated.custodian?.id ?? null);
      setCustodianName(updated.custodian?.displayName ?? null);
    } catch (e: any) {
      setSaveError(e.message);
    }
  }

  async function saveCustodian(value: string) {
    setSaveError(null);
    const newCustodianId = value ? parseInt(value, 10) : null;
    if (newCustodianId === custodianId) return;
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType: 'Computer',
          objectId: Number(id),
          custodianId: newCustodianId,
          siteId: form.siteId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Transfer failed');
      }
      setCustodianId(newCustodianId);
      setCustodianName(newCustodianId ? users.find((u) => u.id === newCustodianId)?.displayName ?? null : null);
    } catch (e: any) {
      setSaveError(e.message);
    }
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
        modelNumber: form.modelNumber || null,
        adminUsername: form.adminUsername || null,
        adminPassword: form.adminPassword || null,
        studentUsername: form.studentUsername || null,
        studentPassword: form.studentPassword || null,
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
  const hostNameStr = hostNames.find((h) => h.id === form.hostNameId)?.name;
  const displayName = hostNameStr || `Computer #${id}`;

  const hasCredentials = form.adminUsername || form.adminPassword || form.studentUsername || form.studentPassword;

  const modelDisplay = [form.model, form.modelNumber].filter(Boolean).join(' ') || '';

  return (
    <div className="max-w-4xl">
      <Link to="/computers" className="text-sm text-primary hover:underline">
        &larr; Back to Computers
      </Link>

      {/* Header: host name (editable) + model (editable) + disposition + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">
            <EditableCell
              value={String(form.hostNameId)}
              onSave={(v) => saveField('hostNameId', v)}
              as="select"
              options={[{ value: '', label: displayName }, ...availableHostNames.map((h) => ({ value: String(h.id), label: h.name }))]}
            />
          </h1>
          <ModelEditor
            model={form.model}
            modelNumber={form.modelNumber}
            onSave={(m, mn) => {
              if (m !== form.model) saveField('model', m);
              if (mn !== form.modelNumber) saveField('modelNumber', mn);
            }}
          />
          <EditableCell
            value={form.disposition}
            onSave={(v) => saveField('disposition', v)}
            as="select"
            options={DISPOSITIONS.map((d) => ({ value: d, label: d.replace(/_/g, ' ') }))}
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${dispositionClasses(form.disposition)}`}
          />
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white border-none cursor-pointer hover:bg-amber-700"
            onClick={() => setShowIssueModal(true)}
          >
            <AlertTriangle size={14} /> Report Issue
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
            onClick={() => window.open(`/api/labels/computer/${id}/compact`, '_blank')}
          >
            <Printer size={14} /> Print Label
          </button>
        </div>
      </div>

      {saveError && <p className="text-red-600 text-sm mb-4">{saveError}</p>}

      {/* Two-column layout: details left, QR + custody right */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* Left column: fields */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Identity fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Serial Number</label>
              <div className="text-lg text-gray-900">
                <EditableCell value={form.serialNumber} onSave={(v) => saveField('serialNumber', v)} placeholder="add serial" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Service Tag</label>
              <div className="text-lg text-gray-900">
                <EditableCell value={form.serviceTag} onSave={(v) => saveField('serviceTag', v)} placeholder="add tag" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Category</label>
              <div className="text-lg text-gray-900">
                <EditableCell
                  value={String(form.categoryId)}
                  onSave={(v) => saveField('categoryId', v)}
                  as="select"
                  options={[{ value: '', label: 'None' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Date Received</label>
              <div className="text-lg text-gray-900">
                <EditableCell value={form.dateReceived} onSave={(v) => saveField('dateReceived', v)} placeholder="none" />
              </div>
            </div>
          </div>

          {/* Credentials box with toggle */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-transparent border-none cursor-pointer text-left"
              onClick={() => setShowCredentials(!showCredentials)}
            >
              <h3 className="text-sm font-semibold text-gray-700">Credentials</h3>
              <span className="text-gray-400">
                {showCredentials ? <EyeOff size={16} /> : <Eye size={16} />}
              </span>
            </button>
            {showCredentials && (
              <div className="px-4 pb-4 space-y-3">
                {(!hasCredentials) && (
                  <p className="text-sm text-gray-400 italic">No credentials set.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Username</span>
                    <input value={form.adminUsername} onChange={(e) => updateField('adminUsername', e.target.value)} onBlur={() => saveField('adminUsername', form.adminUsername)} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Password</span>
                    <input value={form.adminPassword} onChange={(e) => updateField('adminPassword', e.target.value)} onBlur={() => saveField('adminPassword', form.adminPassword)} className={inputClass} />
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Username</span>
                    <input value={form.studentUsername} onChange={(e) => updateField('studentUsername', e.target.value)} onBlur={() => saveField('studentUsername', form.studentUsername)} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Password</span>
                    <input value={form.studentPassword} onChange={(e) => updateField('studentPassword', e.target.value)} onBlur={() => saveField('studentPassword', form.studentPassword)} className={inputClass} />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Notes field */}
          <div>
            <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              onBlur={() => saveField('notes', form.notes)}
              className="w-full min-h-[3rem] px-3 py-2 text-base text-gray-900 border border-gray-300 rounded-md resize-vertical focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              rows={2}
              placeholder="Add notes..."
            />
          </div>
        </div>

        {/* Right column: QR + Custody */}
        <div className="w-full lg:w-60 shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
            {/* QR code */}
            <div className="flex flex-col items-center">
              <img
                src={`/api/labels/qr/c/${id}?v=${Date.now()}`}
                alt="QR code"
                className="w-20 h-20"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <code className="text-[10px] text-gray-400 mt-1">/qr/c/{id}</code>
            </div>

            <hr className="border-gray-200" />

            {/* Custody */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Custody</h3>
              <div className="space-y-3">
                <div className="text-base flex items-center gap-2">
                  <User size={16} className="shrink-0 text-gray-400" />
                  <EditableCell
                    value={String(custodianId ?? '')}
                    onSave={saveCustodian}
                    as="select"
                    options={[{ value: '', label: 'Storeroom' }, ...users.map((u) => ({ value: String(u.id), label: u.displayName }))]}
                    className={custodianName ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}
                  />
                </div>
                <div className="text-base flex items-center gap-2">
                  <Building2 size={16} className="shrink-0 text-gray-400" />
                  <EditableCell
                    value={String(form.siteId)}
                    onSave={(v) => saveField('siteId', v)}
                    as="select"
                    options={[{ value: '', label: 'No site' }, ...sites.map((s) => ({ value: String(s.id), label: s.name }))]}
                  />
                </div>
                <div className="text-base flex items-center gap-2">
                  <Archive size={16} className="shrink-0 text-gray-400" />
                  <EditableCell
                    value={String(form.kitId)}
                    onSave={(v) => saveField('kitId', v)}
                    as="select"
                    options={[{ value: '', label: 'No kit' }, ...kits.map((k) => ({ value: String(k.id), label: k.name }))]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

function ModelEditor({ model, modelNumber, onSave }: {
  model: string;
  modelNumber: string;
  onSave: (model: string, modelNumber: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftModel, setDraftModel] = useState(model);
  const [draftNumber, setDraftNumber] = useState(modelNumber);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftModel(model);
    setDraftNumber(modelNumber);
  }, [model, modelNumber]);

  function commit() {
    setEditing(false);
    const m = draftModel.trim();
    const mn = draftNumber.trim();
    if (m !== model || mn !== modelNumber) {
      onSave(m, mn);
    }
  }

  function handleBlur(e: React.FocusEvent) {
    // Only commit if focus is leaving the container entirely
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      commit();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setDraftModel(model);
      setDraftNumber(modelNumber);
      setEditing(false);
    }
  }

  const display = [model, modelNumber].filter(Boolean).join(' ');

  if (!editing) {
    return (
      <span
        className="text-base text-gray-500 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1"
        onClick={() => setEditing(true)}
        title="Click to edit model"
      >
        {display || <span className="text-gray-300 italic">add model</span>}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={draftModel}
        onChange={(e) => setDraftModel(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Model"
        className="px-1 py-0 border border-primary rounded text-sm w-28"
      />
      <input
        value={draftNumber}
        onChange={(e) => setDraftNumber(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Model #"
        className="px-1 py-0 border border-gray-300 rounded text-sm w-24"
      />
    </div>
  );
}
