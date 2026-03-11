import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface Issue {
  id: number;
  type: string;
  status: string;
  notes: string | null;
  createdAt: string;
  reporter: { id: number; displayName: string };
}

const TYPE_LABELS: Record<string, string> = {
  MISSING_ITEM: 'Missing Item',
  REPLENISHMENT: 'Replenishment',
  DAMAGE: 'Damage',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

interface Props {
  kitId?: number;
  computerId?: number;
}

export default function IssuesSection({ kitId, computerId }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (kitId) params.set('kitId', String(kitId));
    if (computerId) params.set('computerId', String(computerId));
    params.set('status', 'OPEN');

    fetch(`/api/issues?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kitId, computerId]);

  if (loading) return null;
  if (issues.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-500" />
        Open Issues ({issues.length})
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {issues.map((issue) => (
          <Link
            key={issue.id}
            to="/issues"
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 no-underline"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                  {TYPE_LABELS[issue.type] || issue.type}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              {issue.notes && (
                <p className="text-sm text-gray-500 mt-1 truncate max-w-md">{issue.notes}</p>
              )}
            </div>
            <span className="text-xs text-gray-400">View &rarr;</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
