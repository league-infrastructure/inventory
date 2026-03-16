import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface NamedRecord {
  id: number;
  name: string;
}

type Tab = 'categories' | 'operatingSystems' | 'containerTypes' | 'dispositions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'operatingSystems', label: 'Operating Systems' },
  { key: 'containerTypes', label: 'Container Types' },
  { key: 'dispositions', label: 'Dispositions' },
];

// These are Prisma enums — displayed read-only since they require schema changes to modify
const CONTAINER_TYPES = ['BAG', 'LARGE_TOTE', 'SMALL_TOTE', 'DUFFEL', 'PENCIL_BOX'];
const DISPOSITIONS = ['ACTIVE', 'LOANED', 'NEEDS_REPAIR', 'IN_REPAIR', 'SCRAPPED', 'LOST', 'DECOMMISSIONED'];

function EditableList({ endpoint, label }: { endpoint: string; label: string }) {
  const [items, setItems] = useState<NamedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(endpoint)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${label.toLowerCase()}`);
        return r.json();
      })
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpoint]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error || `Failed to add`);
      return;
    }
    const created = await res.json();
    setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName('');
  }

  async function handleDelete(id: number) {
    setActionError(null);
    const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || `Failed to delete`);
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-2">
        <input
          placeholder={`New ${label.toLowerCase().replace(/s$/, '')} name`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          required
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg border-none cursor-pointer hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add
        </button>
      </form>
      {actionError && <p className="text-red-600 text-sm mb-4">{actionError}</p>}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-gray-500 text-sm">No {label.toLowerCase()} yet.</p>
      )}

      {items.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer p-1"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReadOnlyEnumList({ values, label }: { values: string[]; label: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        {label} are defined in the database schema and cannot be edited here.
      </p>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Value</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v) => (
              <tr key={v} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{v.replace(/_/g, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CategoriesPanel() {
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Categories &amp; Types</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-none cursor-pointer transition-colors ${
              tab === t.key
                ? 'bg-transparent text-primary border-b-2 border-primary -mb-px'
                : 'bg-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <EditableList endpoint="/api/categories" label="Categories" />
      )}
      {tab === 'operatingSystems' && (
        <EditableList endpoint="/api/operating-systems" label="Operating Systems" />
      )}
      {tab === 'containerTypes' && (
        <ReadOnlyEnumList values={CONTAINER_TYPES} label="Container types" />
      )}
      {tab === 'dispositions' && (
        <ReadOnlyEnumList values={DISPOSITIONS} label="Computer dispositions" />
      )}
    </div>
  );
}
