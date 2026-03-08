import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AppLayout';
import { Copy, RefreshCw, Key } from 'lucide-react';
import { ROLE_LABELS } from '../../lib/roles';

interface TokenInfo {
  id: number;
  prefix: string;
  token?: string;
}

function buildSnippet(serverUrl: string, token: string): string {
  return JSON.stringify({
    inventory: {
      type: 'http',
      url: `${serverUrl}/api/mcp`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  }, null, 2);
}

export default function Account() {
  const { user } = useAuth();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [snippet, setSnippet] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | false>(false);
  const [error, setError] = useState<string | null>(null);

  const serverUrl = window.location.origin;

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.ok ? r.json() : [])
      .then((tokens: any[]) => {
        if (tokens.length > 0) {
          const t = tokens[0];
          const savedToken = localStorage.getItem(`mcp_token_${t.id}`);
          setTokenInfo({ id: t.id, prefix: t.prefix, token: savedToken ?? undefined });
          setSnippet(buildSnippet(serverUrl, savedToken ?? `${t.prefix}...`));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverUrl]);

  async function generateToken() {
    setGenerating(true);
    setError(null);
    try {
      // Revoke existing token if present
      if (tokenInfo) {
        localStorage.removeItem(`mcp_token_${tokenInfo.id}`);
        await fetch(`/api/tokens/${tokenInfo.id}`, { method: 'DELETE' });
      }

      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'mcp' }),
      });
      if (!res.ok) throw new Error('Failed to create token');
      const data = await res.json();
      localStorage.setItem(`mcp_token_${data.id}`, data.token);
      setTokenInfo({ id: data.id, prefix: data.prefix, token: data.token });
      setSnippet(buildSnippet(serverUrl, data.token));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm('This will disconnect any clients using the current token. Continue?')) return;
    await generateToken();
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(label);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!user) {
    return <p className="text-gray-500">Please sign in to view your account.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account</h1>

      {/* Profile section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Profile</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Name</dt>
          <dd className="text-gray-900">{user.displayName}</dd>
          <dt className="text-gray-500">Email</dt>
          <dd className="text-gray-900">{user.email}</dd>
          <dt className="text-gray-500">Role</dt>
          <dd className="text-gray-900">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}</dd>
        </dl>
      </section>

      {/* MCP Configuration section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">MCP Connection</h2>
        <p className="text-sm text-gray-500 mb-4">
          Copy this configuration into your AI client (Claude Desktop, Claude Code, etc.)
          to connect to the inventory MCP server.
        </p>

        {loading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : !tokenInfo ? (
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50"
          >
            <Key size={16} />
            {generating ? 'Generating...' : 'Generate Token'}
          </button>
        ) : (
          <>
            {/* Individual fields */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 truncate">
                    {`${serverUrl}/api/mcp`}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${serverUrl}/api/mcp`, 'url')}
                    className="flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 shrink-0"
                  >
                    <Copy size={12} />
                    {copied === 'url' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Token</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 truncate">
                    {tokenInfo.token ?? `${tokenInfo.prefix}...`}
                  </code>
                  <button
                    onClick={() => tokenInfo.token
                      ? copyToClipboard(tokenInfo.token, 'token')
                      : copyToClipboard(`Bearer ${tokenInfo.prefix}...`, 'token-unavailable')
                    }
                    className={`flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 shrink-0 ${tokenInfo.token ? 'text-gray-600' : 'text-gray-400'}`}
                    title={tokenInfo.token ? 'Copy full token' : 'Token not available — regenerate to copy'}
                  >
                    <Copy size={12} />
                    {copied === 'token' ? 'Copied!' : copied === 'token-unavailable' ? 'Regenerate to copy' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* JSON snippet */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Claude configuration block <span className="font-normal text-gray-400">(add to mcpServers in .mcp.json)</span>
              </label>
              <div className="relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre">
                  {snippet}
                </pre>
                <button
                  onClick={() => copyToClipboard(snippet, 'snippet')}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50"
                >
                  <Copy size={12} />
                  {copied === 'snippet' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {tokenInfo.token && (
              <p className="mt-2 text-xs text-amber-600">
                The full token is shown above. It will not be displayed again after you leave this page.
              </p>
            )}

            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="mt-4 flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 bg-white disabled:opacity-50"
            >
              <RefreshCw size={14} />
              {generating ? 'Regenerating...' : 'Regenerate Token'}
            </button>
          </>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </section>
    </div>
  );
}
