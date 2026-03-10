import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Tags, Package, Box, Monitor, MapPin } from 'lucide-react';

interface SearchResult {
  type: 'kit' | 'pack' | 'item' | 'computer' | 'site';
  id: number;
  title: string;
  subtitle: string | null;
  url: string;
}

const typeIcons: Record<string, any> = {
  kit: Tags,
  pack: Package,
  item: Box,
  computer: Monitor,
  site: MapPin,
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <div className="relative mb-8">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search kits, packs, items, computers, sites..."
          className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
      </div>

      {loading && <p className="text-sm text-gray-500">Searching...</p>}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-gray-500">No results found for "{query}"</p>
      )}

      {Object.entries(grouped).map(([type, items]) => {
        const Icon = typeIcons[type] || Box;
        return (
          <div key={type} className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
              <Icon size={16} />
              {type}s ({items.length})
            </h2>
            <div className="bg-white rounded-lg shadow divide-y">
              {items.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  to={r.url}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 no-underline text-gray-900"
                >
                  <div className="flex items-center gap-2">
                    {(() => { const I = typeIcons[r.type] || Box; return <I size={16} className="shrink-0 text-gray-400" />; })()}
                    <div>
                      <div className="font-medium">{r.title}</div>
                      {r.subtitle && <div className="text-sm text-gray-500">{r.subtitle}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
