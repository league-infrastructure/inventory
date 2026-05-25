import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

interface Site { id: number; name: string; }
interface Kit { id: number; name: string; }
interface HostName { id: number; name: string; computerId: number | null; }
interface OperatingSystem { id: number; name: string; }
interface Category { id: number; name: string; }
interface Manufacturer { id: number; name: string; }

import { DISPOSITIONS } from '../../lib/dispositions';

export default function ComputerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [serialNumber, setSerialNumber] = useState('');
  const [serviceTag, setServiceTag] = useState('');
  const [model, setModel] = useState('');
  const [adminUsername, setDefaultUsername] = useState('');
  const [adminPassword, setDefaultPassword] = useState('');
  const [disposition, setDisposition] = useState('ACTIVE');
  const [dateReceived, setDateReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [siteId, setSiteId] = useState<number | ''>('');
  const [kitId, setKitId] = useState<number | ''>('');
  const [hostNameId, setHostNameId] = useState<number | ''>('');
  const [manufacturerId, setManufacturerId] = useState<number | ''>('');
  const [modelNumber, setModelNumber] = useState('');
  const [manufacturedYear, setManufacturedYear] = useState<number | ''>('');
  const [osId, setOsId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');

  const [sites, setSites] = useState<Site[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [hostNames, setHostNames] = useState<HostName[]>([]);
  const [operatingSystems, setOperatingSystems] = useState<OperatingSystem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/sites').then((r) => r.json()),
      fetch('/api/kits').then((r) => r.json()),
      fetch('/api/hostnames').then((r) => r.json()),
      fetch('/api/operating-systems').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/manufacturers').then((r) => r.json()),
    ])
      .then(([s, k, h, osList, cats, mfgList]) => { setSites(s); setKits(k); setHostNames(h); setOperatingSystems(osList); setCategories(cats); setManufacturers(mfgList); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      fetch(`/api/computers/${id}`)
        .then((r) => r.json())
        .then((c) => {
          setSerialNumber(c.serialNumber || '');
          setServiceTag(c.serviceTag || '');
          setModel(c.model || '');
          setDefaultUsername(c.adminUsername || '');
          setDefaultPassword(c.adminPassword || '');
          setDisposition(c.disposition);
          setDateReceived(c.dateReceived ? c.dateReceived.substring(0, 10) : '');
          setNotes(c.notes || '');
          setSiteId(c.site?.id || '');
          setKitId(c.kit?.id || '');
          setHostNameId(c.hostName?.id || '');
          setManufacturerId(c.manufacturer?.id || '');
          setModelNumber(c.modelNumber || '');
          setManufacturedYear(c.manufacturedYear ?? '');
          setOsId(c.os?.id || c.osId || '');
          setCategoryId(c.category?.id || c.categoryId || '');
        })
        .catch(() => setError('Computer not found'));
    }
  }, [id, isEdit]);

  const availableHostNames = hostNames.filter(
    (h) => h.computerId === null || (isEdit && h.computerId === parseInt(id!, 10))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      serialNumber: serialNumber || null,
      serviceTag: serviceTag || null,
      model: model || null,
      adminUsername: adminUsername || null,
      adminPassword: adminPassword || null,
      disposition,
      dateReceived: dateReceived || null,
      notes: notes || null,
      siteId: siteId || null,
      kitId: kitId || null,
      hostNameId: hostNameId || null,
      manufacturerId: manufacturerId || null,
      modelNumber: modelNumber || null,
      manufacturedYear: manufacturedYear === '' ? null : Number(manufacturedYear),
      osId: osId || null,
      categoryId: categoryId || null,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/computers/${id}` : '/api/computers',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      const computer = await res.json();
      navigate(`/computers/${computer.id}`);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  }

  const inputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white";

  return (
    <div className="max-w-lg">
      <Link to={isEdit ? `/computers/${id}` : '/computers'} className="text-sm text-primary hover:underline">
        &larr; Back
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">
        {isEdit ? 'Edit Computer' : 'New Computer'}
      </h1>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Manufacturer</span>
            <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
              <option value=""></option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Model Number</span>
            <input value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} className={inputClass} />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Model</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Serial Number</span>
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Service Tag</span>
            <input value={serviceTag} onChange={(e) => setServiceTag(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Manufactured Year</span>
            <input
              type="number"
              value={manufacturedYear}
              onChange={(e) => setManufacturedYear(e.target.value ? parseInt(e.target.value, 10) : '')}
              className={inputClass}
              placeholder="e.g. 2024"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Operating System</span>
            <select value={osId} onChange={(e) => setOsId(e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
              <option value="">None</option>
              {operatingSystems.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Admin Username</span>
            <input value={adminUsername} onChange={(e) => setDefaultUsername(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Admin Password</span>
            <input value={adminPassword} onChange={(e) => setDefaultPassword(e.target.value)} className={inputClass} />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Disposition</span>
          <select value={disposition} onChange={(e) => setDisposition(e.target.value)} className={inputClass}>
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Host Name</span>
          <select value={hostNameId} onChange={(e) => setHostNameId(e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
            <option value="">None</option>
            {availableHostNames.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Site</span>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
              <option value="">None</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Kit</span>
            <select value={kitId} onChange={(e) => setKitId(e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
              <option value="">None</option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Date Received</span>
          <input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} className={inputClass} />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass + " resize-y"} rows={3} />
        </label>

        <div className="pt-2">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : isEdit ? 'Update Computer' : 'Create Computer'}
          </button>
        </div>
      </form>
    </div>
  );
}
