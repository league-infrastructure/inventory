import { useEffect, useState } from 'react';

interface EnvData {
  node: string;
  uptime: number;
  memory: { rss: number; heapUsed: number; heapTotal: number };
  deployment: string;
  database: string;
  integrations: Record<string, { configured: boolean }>;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

const INTEGRATION_LABELS: Record<string, string> = {
  github: 'GitHub OAuth',
  google: 'Google OAuth',
  pike13: 'Pike 13',
  githubToken: 'GitHub Token',
  anthropic: 'Claude API',
  openai: 'OpenAI API',
};

export default function EnvironmentInfo() {
  const [data, setData] = useState<EnvData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/env')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('Failed to load environment info'));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Environment</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Runtime</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-medium text-gray-500">Node.js</dt><dd>{data.node}</dd>
          <dt className="font-medium text-gray-500">Uptime</dt><dd>{formatUptime(data.uptime)}</dd>
          <dt className="font-medium text-gray-500">Deployment</dt><dd>{data.deployment}</dd>
        </dl>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Memory</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-medium text-gray-500">RSS</dt><dd>{formatMB(data.memory.rss)}</dd>
          <dt className="font-medium text-gray-500">Heap Used</dt><dd>{formatMB(data.memory.heapUsed)}</dd>
          <dt className="font-medium text-gray-500">Heap Total</dt><dd>{formatMB(data.memory.heapTotal)}</dd>
        </dl>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Database</h3>
        <span className={`text-sm font-semibold ${data.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
          {data.database === 'connected' ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Integrations</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(data.integrations).map(([key, val]) => (
            <div key={key} className="contents">
              <dt className="font-medium text-gray-500">{INTEGRATION_LABELS[key] || key}</dt>
              <dd>
                <span className={`font-semibold ${val.configured ? 'text-green-600' : 'text-gray-400'}`}>
                  {val.configured ? 'Configured' : 'Not set'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
