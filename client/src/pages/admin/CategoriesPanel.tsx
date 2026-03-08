import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

export default function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load categories');
        return r.json();
      })
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || 'Failed to add category');
      return;
    }
    const created = await res.json();
    setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName('');
  }

  async function handleDelete(id: number) {
    setAddError(null);
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || 'Failed to delete category');
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Categories</h1>

      <form onSubmit={handleAdd} className="flex gap-2 mb-2">
        <input
          placeholder="New category name"
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
      {addError && <p className="text-red-600 text-sm mb-4">{addError}</p>}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && categories.length === 0 && (
        <p className="text-gray-500 text-sm">No categories yet.</p>
      )}

      {categories.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
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
