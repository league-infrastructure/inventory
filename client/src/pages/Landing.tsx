import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/AppLayout';
import { Tags, AlertTriangle, Clock, PackageCheck, Monitor, MapPin, Activity, Search } from 'lucide-react';

interface CheckoutItem {
  checkoutId: number;
  kitId: number;
  kitNumber: number;
  kitName: string;
  checkedOutAt: string;
}

interface IssueRecord {
  id: number;
  type: string;
  status: string;
  description: string | null;
  packName: string;
  itemName: string | null;
  createdAt: string;
}

interface InventoryAgeRow {
  type: string;
  id: number;
  name: string;
  lastInventoried: string | null;
  daysSinceInventory: number | null;
}

interface AuditRecord {
  id: number;
  userName: string | null;
  objectType: string;
  objectId: number;
  field: string;
  createdAt: string;
}

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading...</p>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">LAP Inventory</h1>
        <p className="text-gray-500 mb-8">
          Equipment tracking for the League of Amazing Programmers
        </p>
        <a
          href="/api/auth/google"
          className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-medium no-underline hover:bg-primary-hover transition-colors"
        >
          Sign in with Google
        </a>
      </div>
    );
  }

  const isQM = user.role === 'QUARTERMASTER';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user.displayName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isQM ? 'Quartermaster' : 'Instructor'} Dashboard
        </p>
      </div>

      <div className="space-y-6">
        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink to="/kits" icon={Tags} label="Kits" />
          <QuickLink to="/checkouts" icon={PackageCheck} label="Checked Out" />
          <QuickLink to="/issues" icon={AlertTriangle} label="Issues" />
          <QuickLink to="/search" icon={Search} label="Search" />
          {isQM && <QuickLink to="/computers" icon={Monitor} label="Computers" />}
          {isQM && <QuickLink to="/sites" icon={MapPin} label="Sites" />}
          {isQM && <QuickLink to="/reports/inventory-age" icon={Clock} label="Inventory Age" />}
          {isQM && <QuickLink to="/reports/audit-log" icon={Activity} label="Audit Log" />}
        </div>

        {/* My checkouts */}
        <MyCheckouts userId={user.id} />

        {/* Open issues */}
        <OpenIssuesWidget />

        {/* QM-only: Needs inventory */}
        {isQM && <NeedsInventoryWidget />}

        {/* QM-only: Recent activity */}
        {isQM && <RecentActivityWidget />}
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-primary hover:shadow-sm transition-all no-underline text-gray-700 hover:text-primary"
    >
      <Icon size={18} />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function MyCheckouts({ userId }: { userId: number }) {
  const [data, setData] = useState<Record<string, CheckoutItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/checked-out-by-person')
      .then((r) => r.ok ? r.json() : {})
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Flatten all checkouts - the API groups by person name
  const allCheckouts = Object.values(data).flat();

  return (
    <DashboardCard title="Currently Checked Out" icon={PackageCheck} count={allCheckouts.length}>
      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {!loading && allCheckouts.length === 0 && (
        <p className="text-sm text-gray-400">No kits currently checked out</p>
      )}
      {allCheckouts.slice(0, 5).map((co) => (
        <div key={co.checkoutId} className="flex items-center justify-between py-2">
          <Link to={`/kits/${co.kitId}`} className="text-sm text-primary hover:underline">
            Kit #{co.kitNumber}: {co.kitName}
          </Link>
          <span className="text-xs text-gray-400">{new Date(co.checkedOutAt).toLocaleDateString()}</span>
        </div>
      ))}
      {allCheckouts.length > 5 && (
        <Link to="/checkouts" className="text-xs text-primary hover:underline">
          View all ({allCheckouts.length})
        </Link>
      )}
    </DashboardCard>
  );
}

function OpenIssuesWidget() {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/issues?status=OPEN')
      .then((r) => r.ok ? r.json() : [])
      .then(setIssues)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardCard title="Open Issues" icon={AlertTriangle} count={issues.length}>
      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {!loading && issues.length === 0 && (
        <p className="text-sm text-gray-400">No open issues</p>
      )}
      {issues.slice(0, 5).map((issue) => (
        <div key={issue.id} className="py-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
              {issue.type.replace('_', ' ')}
            </span>
            <span className="text-sm text-gray-700">{issue.packName}</span>
          </div>
          {issue.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{issue.description}</p>
          )}
        </div>
      ))}
      {issues.length > 5 && (
        <Link to="/issues" className="text-xs text-primary hover:underline">
          View all ({issues.length})
        </Link>
      )}
    </DashboardCard>
  );
}

function NeedsInventoryWidget() {
  const [rows, setRows] = useState<InventoryAgeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/inventory-age')
      .then((r) => r.ok ? r.json() : [])
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  // Show items that have never been inventoried or are overdue (>30 days)
  const overdue = rows.filter((r) => r.daysSinceInventory === null || r.daysSinceInventory > 30);

  return (
    <DashboardCard title="Needs Inventory" icon={Clock} count={overdue.length}>
      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {!loading && overdue.length === 0 && (
        <p className="text-sm text-gray-400">All items up to date</p>
      )}
      {overdue.slice(0, 5).map((r) => (
        <div key={`${r.type}-${r.id}`} className="flex items-center justify-between py-2">
          <Link
            to={r.type === 'kit' ? `/kits/${r.id}` : `/computers/${r.id}`}
            className="text-sm text-primary hover:underline"
          >
            {r.name}
          </Link>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            r.daysSinceInventory === null ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {r.daysSinceInventory === null ? 'Never' : `${r.daysSinceInventory}d`}
          </span>
        </div>
      ))}
      {overdue.length > 5 && (
        <Link to="/reports/inventory-age" className="text-xs text-primary hover:underline">
          View all ({overdue.length})
        </Link>
      )}
    </DashboardCard>
  );
}

function RecentActivityWidget() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/audit-log?pageSize=10')
      .then((r) => r.ok ? r.json() : { records: [] })
      .then((data) => setRecords(data.records || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardCard title="Recent Activity" icon={Activity} count={null}>
      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between py-2 text-sm">
          <div>
            <span className="text-gray-500">{r.userName || 'System'}</span>{' '}
            <span className="text-gray-400">→</span>{' '}
            <span className="font-medium">{r.objectType} #{r.objectId}</span>{' '}
            <span className="text-gray-400">{r.field}</span>
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {new Date(r.createdAt).toLocaleDateString()}
          </span>
        </div>
      ))}
      {records.length > 0 && (
        <Link to="/reports/audit-log" className="text-xs text-primary hover:underline">
          View full audit log
        </Link>
      )}
    </DashboardCard>
  );
}

function DashboardCard({ title, icon: Icon, count, children }: {
  title: string;
  icon: any;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-primary" />
        <h2 className="text-base font-semibold">{title}</h2>
        {count !== null && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {count}
          </span>
        )}
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}
