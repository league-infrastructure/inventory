import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { ContainerType } from '../../lib/containers';
import { CONTAINER_OPTIONS } from '../../lib/containers';

interface Site {
  id: number;
  name: string;
}

export default function KitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [number, setNumber] = useState<number | ''>('');
  const [containerType, setContainerType] = useState<ContainerType>('BAG');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState<number | ''>('');
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/sites')
      .then((r) => r.json())
      .then(setSites)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      fetch(`/api/kits/${id}`)
        .then((r) => r.json())
        .then((kit) => {
          setNumber(kit.number);
          setContainerType(kit.containerType);
          setName(kit.name);
          setDescription(kit.description || '');
          setSiteId(kit.site.id);
        })
        .catch(() => setError('Kit not found'));
    }
  }, [id, isEdit]);

  const inputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: any = {
      name,
      containerType,
      description: description || null,
      siteId: typeof siteId === 'number' ? siteId : parseInt(siteId as string, 10),
    };
    if (!isEdit) {
      body.number = typeof number === 'number' ? number : parseInt(number as string, 10);
    }

    try {
      const res = await fetch(
        isEdit ? `/api/kits/${id}` : '/api/kits',
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
      const kit = await res.json();
      navigate(`/kits/${kit.id}`);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-lg">
      <Link to={isEdit ? `/kits/${id}` : '/kits'} className="text-sm text-primary hover:underline">
        &larr; Back
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">
        {isEdit ? 'Edit Kit' : 'New Kit'}
      </h1>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <label className="block w-24">
            <span className="text-sm font-medium text-gray-700">Number *</span>
            <input
              type="number"
              min={1}
              value={number}
              onChange={(e) => setNumber(e.target.value ? parseInt(e.target.value, 10) : '')}
              className={inputClass}
              required
              disabled={isEdit}
            />
          </label>
          <label className="block flex-1">
            <span className="text-sm font-medium text-gray-700">Container *</span>
            <select
              value={containerType}
              onChange={(e) => setContainerType(e.target.value as ContainerType)}
              className={inputClass + " bg-white"}
            >
              {CONTAINER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
            placeholder="e.g. HP Laptops"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass + " resize-y"}
            rows={3}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Site *</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(parseInt(e.target.value, 10))}
            className={inputClass + " bg-white"}
            required
          >
            <option value="">Select a site...</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <div className="pt-2">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : isEdit ? 'Update Kit' : 'Create Kit'}
          </button>
        </div>
      </form>
    </div>
  );
}
