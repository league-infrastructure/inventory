import { useState, useEffect } from 'react';
import { useAuth } from '../components/AppLayout';
import { Copy, Key, RefreshCw, CheckCircle } from 'lucide-react';

interface TokenInfo {
  id: number;
  prefix: string;
  token?: string;
}

function buildClaudeDesktopConfig(url: string, token: string): string {
  return JSON.stringify({
    mcpServers: {
      inventory: {
        type: 'http',
        url: `${url}/api/mcp`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  }, null, 2);
}

function buildClaudeCodeConfig(url: string, token: string): string {
  return JSON.stringify({
    inventory: {
      type: 'http',
      url: `${url}/api/mcp`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  }, null, 2);
}

export default function McpSetup() {
  const { user } = useAuth();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | false>(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>('');

  const serverUrl = window.location.origin;

  // Compute OAuth client ID from email hash
  useEffect(() => {
    if (!user?.email) return;
    const encoder = new TextEncoder();
    crypto.subtle.digest('SHA-256', encoder.encode(user.email.toLowerCase()))
      .then((buf) => {
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        setClientId(hex.slice(0, 32));
      });
  }, [user?.email]);

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.ok ? r.json() : [])
      .then((tokens: any[]) => {
        if (tokens.length > 0) {
          const t = tokens[0];
          const savedToken = localStorage.getItem(`mcp_token_${t.id}`);
          setTokenInfo({ id: t.id, prefix: t.prefix, token: savedToken ?? undefined });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function generateToken() {
    setGenerating(true);
    setError(null);
    try {
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
    return <p className="text-gray-500">Please sign in to view MCP setup.</p>;
  }

  const token = tokenInfo?.token ?? `${tokenInfo?.prefix ?? 'your-token'}...`;
  const hasFullToken = !!tokenInfo?.token;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">MCP Server Setup</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your AI assistant to the LAP Inventory system using the
        Model Context Protocol (MCP). This gives your AI tools to search,
        create, update, and manage inventory data.
      </p>

      {/* Step 1: Generate API Key */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">1</span>
          Generate an API Key
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Your API key authenticates the MCP connection. It is tied to your account
          and has the same permissions as your role ({user.role.toLowerCase()}).
        </p>

        {loading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : !tokenInfo ? (
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50 border-none cursor-pointer"
          >
            <Key size={16} />
            {generating ? 'Generating...' : 'Generate API Key'}
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 truncate">
                  {hasFullToken ? token : `${tokenInfo.prefix}...`}
                </code>
                <button
                  onClick={() => hasFullToken
                    ? copyToClipboard(token, 'token')
                    : undefined
                  }
                  className={`flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 shrink-0 bg-white cursor-pointer ${hasFullToken ? 'text-gray-600' : 'text-gray-400'}`}
                  title={hasFullToken ? 'Copy full token' : 'Token not available — regenerate to copy'}
                >
                  <Copy size={12} />
                  {copied === 'token' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {hasFullToken && (
              <p className="text-xs text-amber-600">
                Save this key now — it will not be shown again after you leave this page.
              </p>
            )}

            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 bg-white disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} />
              {generating ? 'Regenerating...' : 'Regenerate Key'}
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {/* Step 2: Configure your client */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">2</span>
          Configure Your AI Client
        </h2>

        {/* Claude Code */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            Claude Code
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            Add this to your project's <code className="bg-gray-100 px-1 rounded text-xs">.mcp.json</code> file
            (or <code className="bg-gray-100 px-1 rounded text-xs">~/.claude/.mcp.json</code> for global access):
          </p>
          <div className="relative">
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre">
              {buildClaudeCodeConfig(serverUrl, token)}
            </pre>
            {hasFullToken && (
              <button
                onClick={() => copyToClipboard(buildClaudeCodeConfig(serverUrl, token), 'claude-code')}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                <Copy size={12} />
                {copied === 'claude-code' ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
        </div>

        {/* Claude Desktop */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            Claude Desktop
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            Open Claude Desktop settings, go to <strong>Developer → Edit Config</strong>,
            and add this to your <code className="bg-gray-100 px-1 rounded text-xs">claude_desktop_config.json</code>:
          </p>
          <div className="relative">
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre">
              {buildClaudeDesktopConfig(serverUrl, token)}
            </pre>
            {hasFullToken && (
              <button
                onClick={() => copyToClipboard(buildClaudeDesktopConfig(serverUrl, token), 'claude-desktop')}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                <Copy size={12} />
                {copied === 'claude-desktop' ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
        </div>

        {/* Claude Web App */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            Claude Web App (claude.ai)
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            The web app uses OAuth to connect. Go to <strong>Settings → Connectors → Add Custom Connector</strong> and enter:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-2">
            <div className="flex gap-2">
              <span className="font-medium text-gray-700 w-36 shrink-0">Name:</span>
              <span className="text-gray-600">League Inventory</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium text-gray-700 w-36 shrink-0">URL:</span>
              <div className="flex items-center gap-1">
                <code className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5">{serverUrl}/api/mcp</code>
                <button
                  onClick={() => copyToClipboard(`${serverUrl}/api/mcp`, 'oauth-url')}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Copy URL"
                >
                  <Copy size={12} />
                </button>
                {copied === 'oauth-url' && <span className="text-xs text-green-500">Copied!</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <span className="font-medium text-gray-700 w-36 shrink-0">OAuth Client ID:</span>
              <div className="flex items-center gap-1">
                {clientId ? (
                  <>
                    <code className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 font-mono">{clientId}</code>
                    <button
                      onClick={() => copyToClipboard(clientId, 'oauth-client-id')}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Copy Client ID"
                    >
                      <Copy size={12} />
                    </button>
                    {copied === 'oauth-client-id' && <span className="text-xs text-green-500">Copied!</span>}
                  </>
                ) : (
                  <span className="text-gray-400 italic">loading...</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <span className="font-medium text-gray-700 w-36 shrink-0">OAuth Client Secret:</span>
              <div className="flex items-center gap-1">
                {hasFullToken ? (
                  <>
                    <code className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 font-mono break-all">{token}</code>
                    <button
                      onClick={() => copyToClipboard(token, 'oauth-secret')}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Copy Client Secret"
                    >
                      <Copy size={12} />
                    </button>
                    {copied === 'oauth-secret' && <span className="text-xs text-green-500">Copied!</span>}
                  </>
                ) : (
                  <span className="text-gray-400 italic">{tokenInfo ? `${tokenInfo.prefix}... (generate a new token to see the full key)` : 'generate an API key in Step 1'}</span>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Claude exchanges the client secret for a Bearer token via the OAuth token endpoint,
            then uses it to authenticate MCP requests. The Client ID is derived from your email address.
          </p>
        </div>

      </section>

      {/* Step 3: What you can do */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">3</span>
          What You Can Do
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          Once connected, your AI assistant can use these inventory tools:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            'Search kits, packs, items, and computers',
            'Create and update kits and packs',
            'Add items to packs',
            'Transfer kits between sites and people',
            'Look up computer details and host names',
            'Run inventory checks',
            'View sites and locations',
            'Manage notes on any object',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-gray-600">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
