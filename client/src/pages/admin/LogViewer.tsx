import { useEffect, useState } from 'react';

interface LogEntry {
  timestamp: string;
  level: number;
  msg: string;
  req?: { method: string; url: string };
  res?: { statusCode: number };
  err?: { message: string; stack?: string };
}

const LEVEL_LABELS: Record<number, string> = {
  10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL',
};

const LEVEL_CLASSES: Record<number, string> = {
  10: 'bg-gray-100 text-gray-500',
  20: 'bg-gray-100 text-gray-600',
  30: 'bg-blue-50 text-blue-600',
  40: 'bg-amber-50 text-amber-600',
  50: 'bg-red-50 text-red-600',
  60: 'bg-red-100 text-red-700',
};

const FILTER_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: '30', label: 'Info+' },
  { value: '40', label: 'Warn+' },
  { value: '50', label: 'Error+' },
];

export default function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLogs = () => {
    setLoading(true);
    const params = level ? `?level=${level}` : '';
    fetch(`/api/admin/logs${params}`)
      .then((r) => r.json())
      .then((data) => { setEntries(data.entries); setTotal(data.total); setLoading(false); })
      .catch(() => { setError('Failed to load logs'); setLoading(false); });
  };

  useEffect(() => { loadLogs(); }, [level]);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 });
    } catch { return ts; }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Logs</h1>
        <div className="flex items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '...' : 'Refresh'}
          </button>
          <span className="text-gray-400 text-xs">{total} entries</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No log entries{level ? ' at this level' : ''}.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">Time</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Level</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Message</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Request</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 whitespace-nowrap font-mono text-gray-500">
                    {formatTime(entry.timestamp)}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold font-mono ${LEVEL_CLASSES[entry.level] || 'bg-gray-100 text-gray-600'}`}>
                      {LEVEL_LABELS[entry.level] || `L${entry.level}`}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    {entry.msg}
                    {entry.err && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-red-600 text-[11px]">{entry.err.message}</summary>
                        {entry.err.stack && (
                          <pre className="text-[10px] text-gray-500 overflow-auto max-w-xl mt-1">{entry.err.stack}</pre>
                        )}
                      </details>
                    )}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap font-mono text-gray-500">
                    {entry.req && (
                      <span>
                        {entry.req.method} {entry.req.url}
                        {entry.res && (
                          <span className={`ml-1.5 ${entry.res.statusCode >= 400 ? 'text-red-600' : 'text-green-600'}`}>
                            {entry.res.statusCode}
                          </span>
                        )}
                      </span>
                    )}
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
