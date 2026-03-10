import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Issue {
  id: number;
  type: string;
  status: string;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  pack: { id: number; name: string } | null;
  item: { id: number; name: string } | null;
  kit: { id: number; name: string } | null;
  computer: { id: number; model: string | null; serialNumber: string | null } | null;
  reporter: { id: number; displayName: string };
  resolver: { id: number; displayName: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  MISSING_ITEM: 'Missing Item',
  REPLENISHMENT: 'Replenishment',
  DAMAGE: 'Damage',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

function issueTarget(issue: Issue): string {
  if (issue.item && issue.pack) return `${issue.item.name} in ${issue.pack.name}`;
  if (issue.pack) return issue.pack.name;
  if (issue.kit) return issue.kit.name;
  if (issue.computer) return issue.computer.model || issue.computer.serialNumber || 'Computer';
  return 'Unknown';
}

export default function IssueList() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/issues?status=${statusFilter}`)
      .then((r) => r.json())
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  async function handleResolve(issueId: number) {
    const res = await fetch(`/api/issues/${issueId}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: resolveNotes || null }),
    });
    if (res.ok) {
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
      setResolving(null);
      setResolveNotes('');
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Issues</h1>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border-none cursor-pointer ${
              statusFilter === 'OPEN' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setStatusFilter('OPEN')}
          >
            Open
          </button>
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border-none cursor-pointer ${
              statusFilter === 'RESOLVED' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setStatusFilter('RESOLVED')}
          >
            Resolved
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : issues.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle size={24} className="mx-auto text-green-500 mb-2" />
          <p className="text-sm text-green-700">No {statusFilter.toLowerCase()} issues</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div key={issue.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className={issue.type === 'MISSING_ITEM' ? 'text-red-500' : 'text-amber-500'} />
                    <span className="text-sm font-medium text-gray-900">
                      {TYPE_LABELS[issue.type] || issue.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      issue.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <strong>{issueTarget(issue)}</strong>
                  </p>
                  {issue.notes && <p className="text-sm text-gray-500 mt-1">{issue.notes}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Reported by {issue.reporter.displayName} on{' '}
                    {new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {issue.resolver && (
                      <> — Resolved by {issue.resolver.displayName}</>
                    )}
                  </p>
                </div>
                {issue.status === 'OPEN' && (
                  <div>
                    {resolving === issue.id ? (
                      <div className="flex flex-col gap-2">
                        <input
                          placeholder="Resolution notes (optional)"
                          value={resolveNotes}
                          onChange={(e) => setResolveNotes(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm w-48"
                        />
                        <div className="flex gap-1">
                          <button
                            className="px-2 py-1 text-xs rounded bg-green-600 text-white border-none cursor-pointer"
                            onClick={() => handleResolve(issue.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="px-2 py-1 text-xs rounded bg-gray-500 text-white border-none cursor-pointer"
                            onClick={() => setResolving(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white border-none cursor-pointer hover:bg-green-700"
                        onClick={() => setResolving(issue.id)}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
