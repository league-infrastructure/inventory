import { useEffect, useState } from 'react';

interface SessionInfo {
  sid: string;
  expire: string;
  isAdmin: boolean;
  hasUser: boolean;
  provider: string | null;
}

export default function SessionViewer() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSessions = () => {
    setLoading(true);
    fetch('/api/admin/sessions')
      .then((r) => r.json())
      .then((data) => { setSessions(data); setLoading(false); })
      .catch(() => { setError('Failed to load sessions'); setLoading(false); });
  };

  useEffect(() => { loadSessions(); }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const isExpiringSoon = (expire: string) => {
    const diff = new Date(expire).getTime() - Date.now();
    return diff > 0 && diff < 60 * 60 * 1000;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Sessions</h1>
        <button
          onClick={loadSessions}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="text-gray-500 text-sm">No active sessions.</p>
      ) : (
        <>
          <p className="text-gray-500 text-xs mb-3">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">Session ID</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">Admin</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">User</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">Expires</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sid} className={`border-b border-gray-100 ${isExpiringSoon(s.expire) ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{s.sid}...</td>
                    <td className="px-4 py-2">
                      {s.isAdmin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">admin</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {s.hasUser ? (
                        <span>
                          {s.provider && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-semibold mr-1">
                              {s.provider}
                            </span>
                          )}
                          Authenticated
                        </span>
                      ) : (
                        <span className="text-gray-400">Anonymous</span>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-xs ${isExpiringSoon(s.expire) ? 'text-amber-600' : 'text-gray-600'}`}>
                      {new Date(s.expire).toLocaleString()}
                      {isExpiringSoon(s.expire) && (
                        <span className="ml-1.5 text-[10px] text-amber-600">expiring soon</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
