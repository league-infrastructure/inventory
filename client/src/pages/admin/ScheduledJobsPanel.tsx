import { useEffect, useState, useRef } from 'react';

interface ScheduledJob {
  id: number;
  name: string;
  description: string | null;
  frequency: string;
  lastRunAt: string | null;
  nextRunAt: string;
  lastError: string | null;
  enabled: boolean;
}

export default function ScheduledJobsPanel() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadJobs = () => {
    setLoading(true);
    fetch('/api/scheduler/jobs')
      .then((r) => r.json())
      .then((data) => { setJobs(data); setLoading(false); setError(''); })
      .catch(() => { setError('Failed to load scheduled jobs'); setLoading(false); });
  };

  useEffect(() => {
    loadJobs();
    intervalRef.current = setInterval(loadJobs, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const toggleEnabled = async (job: ScheduledJob) => {
    try {
      await fetch(`/api/scheduler/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      loadJobs();
    } catch {
      setError('Failed to update job');
    }
  };

  const runNow = async (job: ScheduledJob) => {
    try {
      await fetch(`/api/scheduler/jobs/${job.id}/run`, { method: 'POST' });
      loadJobs();
    } catch {
      setError('Failed to run job');
    }
  };

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Scheduled Jobs</h1>
        <button
          onClick={loadJobs}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="text-gray-500 text-sm">No scheduled jobs.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-2 font-semibold text-gray-700">Name</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">Frequency</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">Last Run</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">Next Run</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">Last Error</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">Enabled</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-100">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{job.name}</div>
                    {job.description && (
                      <div className="text-xs text-gray-500">{job.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{job.frequency}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {new Date(job.nextRunAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 max-w-[200px]">
                    {job.lastError ? (
                      <span className="text-xs text-red-600 truncate block" title={job.lastError}>
                        {job.lastError}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleEnabled(job)}
                      className={`text-xs px-2 py-0.5 rounded cursor-pointer border-none ${
                        job.enabled
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {job.enabled ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => runNow(job)}
                      className="text-xs px-2 py-0.5 rounded border border-gray-300 bg-white cursor-pointer hover:bg-gray-50"
                    >
                      Run Now
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
