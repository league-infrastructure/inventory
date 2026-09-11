import { useState, useEffect } from 'react';
import { useAuth } from '../components/AppLayout';
import { Copy, Key, RefreshCw, CheckCircle, Trash2 } from 'lucide-react';

interface TokenListItem {
  id: number;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  token: string | null;
}

const NO_TOKEN_PLACEHOLDER = '<generate a key above>';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Picks the token used to fill in the config snippets: the most recently
 * created token labeled "mcp" that has a recoverable value, else the newest
 * token overall that has a recoverable value, else null (no snippet token).
 */
function pickDefaultToken(tokens: TokenListItem[]): TokenListItem | null {
  const sorted = [...tokens].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const withToken = sorted.filter((t) => t.token != null);
  if (withToken.length === 0) return null;
  return withToken.find((t) => t.label === 'mcp') ?? withToken[0];
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
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | false>(false);
  const [error, setError] = useState<string | null>(null);
  const serverUrl = window.location.origin;

  async function refreshTokens() {
    try {
      const res = await fetch('/api/tokens');
      const data: TokenListItem[] = res.ok ? await res.json() : [];
      setTokens(data);
    } catch {
      setTokens([]);
    }
  }

  useEffect(() => {
    refreshTokens().finally(() => setLoading(false));
  }, []);

  async function generateToken() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'mcp' }),
      });
      if (!res.ok) throw new Error('Failed to create token');
      await refreshTokens();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(current: TokenListItem | null) {
    if (!current) {
      await generateToken();
      return;
    }
    if (!confirm('This will disconnect any clients using the current default token. Continue?')) return;
    setGenerating(true);
    setError(null);
    try {
      await fetch(`/api/tokens/${current.id}`, { method: 'DELETE' });
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'mcp' }),
      });
      if (!res.ok) throw new Error('Failed to create token');
      await refreshTokens();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: number) {
    if (!confirm('This will disconnect any clients using this token. Continue?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke token');
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
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

  const defaultToken = pickDefaultToken(tokens);
  const hasSnippetToken = defaultToken != null;
  const snippetToken = defaultToken?.token ?? NO_TOKEN_PLACEHOLDER;
  const oauthCommand = `claude mcp add --transport http inventory ${serverUrl}/api/mcp`;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">MCP Server Setup</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your AI assistant to the LAP Inventory system using the
        Model Context Protocol (MCP). This gives your AI tools to search,
        create, update, and manage inventory data.
      </p>

      {/* Step 1: API keys */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">1</span>
          Manage Your API Keys
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          An API key authenticates the MCP connection. It is tied to your account
          and has the same permissions as your role ({user.role.toLowerCase()}).
          You can keep several keys at once — for example one for a hand-configured
          client and one minted automatically by an OAuth sign-in.
        </p>

        <button
          onClick={generateToken}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50 border-none cursor-pointer"
        >
          <Key size={16} />
          {generating ? 'Generating...' : 'Generate API Key'}
        </button>

        {loading ? (
          <div className="mt-4 text-sm text-gray-400">Loading...</div>
        ) : tokens.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No API keys yet. Generate one to get started.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {tokens.map((t) => (
              <div key={t.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{t.label}</span>
                    {defaultToken?.id === t.id && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Default for snippets below
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRevoke(t.id)}
                    className="p-1 text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer"
                    title="Revoke token"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Created {formatDate(t.createdAt)} · Last used {formatDate(t.lastUsedAt)}
                </div>
                {t.token != null ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 break-all">
                      {t.token}
                    </code>
                    <button
                      onClick={() => copyToClipboard(t.token as string, `token-${t.id}`)}
                      className="flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 shrink-0 bg-white cursor-pointer"
                      title="Copy full token"
                    >
                      <Copy size={12} />
                      {copied === `token-${t.id}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-gray-400 italic">
                      Created before token recovery was enabled — regenerate to reveal
                    </span>
                    <button
                      disabled
                      className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded text-xs text-gray-300 shrink-0 bg-white cursor-not-allowed"
                      title="Token value not available"
                    >
                      <Copy size={12} />
                      Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {defaultToken && (
          <button
            onClick={() => handleRegenerate(defaultToken)}
            disabled={generating}
            className="mt-4 flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 bg-white disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} />
            {generating ? 'Regenerating...' : 'Regenerate Default Key'}
          </button>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {/* Step 2: Configure your client */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">2</span>
          Configure Your AI Client
        </h2>

        {/* Claude Code via OAuth */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            Claude Code (recommended — OAuth, no API key needed)
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            Run this in your terminal:
          </p>
          <div className="relative">
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre">
              {oauthCommand}
            </pre>
            <button
              onClick={() => copyToClipboard(oauthCommand, 'oauth-command')}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              <Copy size={12} />
              {copied === 'oauth-command' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            then run <code className="bg-gray-100 px-1 rounded text-xs">/mcp</code> inside
            Claude Code and choose <strong>inventory</strong> to sign in with your
            jointheleague.org Google account.
          </p>
        </div>

        {/* Claude Web App */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            Claude Web App (claude.ai)
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            The web app connects automatically via OAuth. Go to <strong>Settings → Connectors → Add Custom Connector</strong> and enter the URL below.
            Claude will handle the rest — it will redirect you to sign in with Google, then connect automatically.
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
          </div>
          <p className="text-xs text-gray-400 mt-2">
            No client ID or secret needs to be entered manually — claude.ai registers
            itself automatically and uses the OAuth authorization code flow with PKCE
            to authenticate. You'll be prompted to sign in with your jointheleague.org
            Google account.
          </p>
        </div>

        {/* Bearer-token alternative */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Alternative: static API key (Claude Code / Claude Desktop)
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            If your client doesn't support OAuth, or you prefer a fixed bearer token,
            use one of the API keys from step 1 instead.{' '}
            {hasSnippetToken
              ? 'The snippets below use your default key.'
              : 'Generate a key above to fill in these snippets.'}
          </p>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Claude Code</h4>
            <p className="text-sm text-gray-500 mb-2">
              Add this to your project's <code className="bg-gray-100 px-1 rounded text-xs">.mcp.json</code> file
              (or <code className="bg-gray-100 px-1 rounded text-xs">~/.claude/.mcp.json</code> for global access):
            </p>
            <div className="relative">
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre">
                {buildClaudeCodeConfig(serverUrl, snippetToken)}
              </pre>
              {hasSnippetToken && (
                <button
                  onClick={() => copyToClipboard(buildClaudeCodeConfig(serverUrl, snippetToken), 'claude-code')}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <Copy size={12} />
                  {copied === 'claude-code' ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Claude Desktop</h4>
            <p className="text-sm text-gray-500 mb-2">
              Open Claude Desktop settings, go to <strong>Developer → Edit Config</strong>,
              and add this to your <code className="bg-gray-100 px-1 rounded text-xs">claude_desktop_config.json</code>:
            </p>
            <div className="relative">
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre">
                {buildClaudeDesktopConfig(serverUrl, snippetToken)}
              </pre>
              {hasSnippetToken && (
                <button
                  onClick={() => copyToClipboard(buildClaudeDesktopConfig(serverUrl, snippetToken), 'claude-desktop')}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <Copy size={12} />
                  {copied === 'claude-desktop' ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>
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
