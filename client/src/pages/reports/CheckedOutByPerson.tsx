import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

interface TransferredItem {
  type: 'kit' | 'computer';
  id: number;
  number?: number;
  name: string;
  site: string | null;
}

export default function CheckedOutByPerson() {
  const [data, setData] = useState<Record<string, TransferredItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/transferred-by-person')
      .then((r) => r.ok ? r.json() : {})
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const people = Object.entries(data);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="text-primary" size={24} />
        <h1 className="text-2xl font-bold">Transferred by Person</h1>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {!loading && people.length === 0 && (
        <p className="text-sm text-gray-500">No items are currently transferred out.</p>
      )}

      {people.map(([name, items]) => (
        <div key={name} className="mb-6">
          <h2 className="text-lg font-semibold mb-2">{name} ({items.length})</h2>
          <div className="bg-white rounded-lg shadow divide-y">
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link
                    to={item.type === 'kit' ? `/kits/${item.id}` : `/computers/${item.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {item.type === 'kit' ? `Kit #${item.number}: ${item.name}` : item.name}
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  {item.site && <span className="text-xs text-gray-400">{item.site}</span>}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    item.type === 'kit' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
