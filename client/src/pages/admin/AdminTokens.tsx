import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface AdminToken {
  id: number;
  label: string;
  prefix: string;
  role: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  user?: { id: number; displayName: string; email: string };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function tokenStatus(token: AdminToken): { label: string; className: string } {
  if (token.revokedAt) return { label: 'Revoked', className: 'bg-red-100 text-red-700' };
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    return { label: 'Expired', className: 'bg-yellow-100 text-yellow-700' };
  }
  return { label: 'Active', className: 'bg-green-100 text-green-700' };
}

export default function AdminTokens() {
  const [tokens, setTokens] = useState<AdminToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'revoked'>('active');

  useEffect(() => {
    fetch('/api/admin/tokens')
      .then((r) => r.ok ? r.json() : [])
      .then(setTokens)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleRevoke(id: number) {
    if (!confirm("This will disconnect the user's MCP client. Continue?")) return;
    const res = await fetch(`/api/admin/tokens/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTokens((prev) =>
        prev.map((t) => t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t)
      );
    }
  }

  const filtered = tokens.filter((t) => {
    if (filter === 'active') return !t.revokedAt;
    if (filter === 'revoked') return !!t.revokedAt;
    return true;
  });

  if (loading) return <p className="text-sm text-gray-400">Loading tokens...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">API Tokens</h2>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {(['active', 'revoked', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs border-none cursor-pointer ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No tokens found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="py-2 pr-4">Prefix</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Last Used</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((token) => {
                const status = tokenStatus(token);
                return (
                  <tr key={token.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs">{token.prefix}...</td>
                    <td className="py-2 pr-4">
                      <div className="text-gray-900">{token.user?.displayName ?? '—'}</div>
                      <div className="text-xs text-gray-400">{token.user?.email ?? ''}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
                        {token.role === 'QUARTERMASTER' ? 'QM' : 'Inst'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-500 text-xs">{formatDate(token.createdAt)}</td>
                    <td className="py-2 pr-4 text-gray-500 text-xs">{formatDate(token.lastUsedAt)}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {!token.revokedAt && (
                        <button
                          onClick={() => handleRevoke(token.id)}
                          className="p-1 text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer"
                          title="Revoke token"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
