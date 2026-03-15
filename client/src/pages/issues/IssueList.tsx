import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Tags, Package, Monitor, Search } from 'lucide-react';

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

function issueTargetText(issue: Issue): string {
  if (issue.kit) {
    if (issue.item && issue.pack) return `${issue.item.name} in ${issue.pack.name}`;
    if (issue.pack) return issue.pack.name;
    return issue.kit.name;
  }
  if (issue.computer) return issue.computer.model || issue.computer.serialNumber || 'Computer';
  if (issue.pack) return issue.item ? `${issue.item.name} in ${issue.pack.name}` : issue.pack.name;
  return 'Unknown';
}

function IssueTargetLink({ issue }: { issue: Issue }) {
  const text = issueTargetText(issue);
  if (issue.kit) {
    return (
      <Link to={`/kits/${issue.kit.id}`} className="text-primary hover:underline">{text}</Link>
    );
  }
  if (issue.computer) {
    return (
      <Link to={`/computers/${issue.computer.id}`} className="text-primary hover:underline">{text}</Link>
    );
  }
  return <span>{text}</span>;
}

function TargetIcon({ issue }: { issue: Issue }) {
  if (issue.kit) return <Tags size={13} className="shrink-0 text-gray-400" />;
  if (issue.computer) return <Monitor size={13} className="shrink-0 text-gray-400" />;
  if (issue.pack) return <Package size={13} className="shrink-0 text-gray-400" />;
  return null;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function IssueList() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [search, setSearch] = useState('');
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

  const filtered = useMemo(() => {
    if (!search.trim()) return issues;
    const q = search.toLowerCase();
    return issues.filter((issue) => {
      const target = issueTargetText(issue).toLowerCase();
      const type = (TYPE_LABELS[issue.type] || issue.type).toLowerCase();
      const reporter = issue.reporter.displayName.toLowerCase();
      const notes = (issue.notes || '').toLowerCase();
      return target.includes(q) || type.includes(q) || reporter.includes(q) || notes.includes(q);
    });
  }, [issues, search]);

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
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
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

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search issues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle size={24} className="mx-auto text-green-500 mb-2" />
          <p className="text-sm text-green-700">
            {search ? 'No matching issues' : `No ${statusFilter.toLowerCase()} issues`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {filtered.map((issue) => (
                <tr key={issue.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 align-top w-5">
                    <AlertTriangle size={14} className={`mt-0.5 ${issue.type === 'MISSING_ITEM' ? 'text-red-500' : 'text-amber-500'}`} />
                  </td>
                  <td className="px-2 py-2">
                    {/* Line 1: type badge, target, reporter, date */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        issue.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {issue.status}
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {TYPE_LABELS[issue.type] || issue.type}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <TargetIcon issue={issue} />
                        <IssueTargetLink issue={issue} />
                      </span>
                      <span className="text-xs text-gray-400 hidden sm:inline">
                        {issue.reporter.displayName} — {formatShortDate(issue.createdAt)}
                        {issue.resolver && <> — resolved by {issue.resolver.displayName}</>}
                      </span>
                    </div>
                    {/* Line 2: notes/description */}
                    {issue.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xl">{issue.notes}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                    {issue.status === 'OPEN' && (
                      <>
                        {resolving === issue.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              placeholder="Notes"
                              value={resolveNotes}
                              onChange={(e) => setResolveNotes(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs w-28"
                            />
                            <button
                              className="px-2 py-1 text-xs rounded bg-green-600 text-white border-none cursor-pointer"
                              onClick={() => handleResolve(issue.id)}
                            >
                              OK
                            </button>
                            <button
                              className="px-2 py-1 text-xs rounded bg-gray-400 text-white border-none cursor-pointer"
                              onClick={() => setResolving(null)}
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <button
                            className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white border-none cursor-pointer hover:bg-green-700"
                            onClick={() => setResolving(issue.id)}
                          >
                            Resolve
                          </button>
                        )}
                      </>
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
