import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PageContext {
  page: string;
  entityType?: string;
  entityId?: number;
}

function getPageContext(pathname: string): PageContext | null {
  const patterns: { pattern: RegExp; type: string; page: string }[] = [
    { pattern: /^\/kits\/(\d+)/, type: 'kit', page: 'Kit Detail' },
    { pattern: /^\/computers\/(\d+)/, type: 'computer', page: 'Computer Detail' },
    { pattern: /^\/sites\/(\d+)/, type: 'site', page: 'Site Detail' },
  ];

  for (const { pattern, type, page } of patterns) {
    const match = pathname.match(pattern);
    if (match) {
      return { page, entityType: type, entityId: parseInt(match[1], 10) };
    }
  }

  // Non-entity pages
  const pageNames: Record<string, string> = {
    '/': 'Dashboard',
    '/kits': 'Kits List',
    '/computers': 'Computers List',
    '/sites': 'Sites List',
    '/issues': 'Issues List',
    '/search': 'Search',
    '/checkouts': 'Checked Out',
  };

  for (const [path, name] of Object.entries(pageNames)) {
    if (pathname === path) return { page: name };
  }

  return null;
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Intercept internal links in markdown and use client-side navigation
  const markdownComponents = useCallback(() => ({
    a: ({ href, children, ...props }: any) => {
      if (href && href.startsWith('/')) {
        return (
          <a
            {...props}
            href={href}
            className="text-primary underline hover:text-primary-hover"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              navigate(href);
            }}
          >
            {children}
          </a>
        );
      }
      return <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
  }), [navigate]);

  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(data => setConfigured(data.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (configured === null || configured === false) return null;

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages];
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    // Add placeholder assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationHistory: history, pageContext: getPageContext(location.pathname) }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.error}` };
          return updated;
        });
        setStreaming(false);
        return;
      }

      // Check for topic guard rejection (JSON response, not SSE)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.rejected) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: data.reason || 'Please ask about inventory management.' };
            return updated;
          });
          setStreaming(false);
          return;
        }
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'delta') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = { ...last, content: last.content + data.text };
                  return updated;
                });
              } else if (data.type === 'error') {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: `Error: ${data.error}` };
                  return updated;
                });
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message}` };
        return updated;
      });
    }

    setStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center cursor-pointer border-none hover:bg-primary-hover z-50"
          title="Open AI Chat"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              <span className="font-semibold text-gray-900 text-sm">AI Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-gray-400 text-sm text-center mt-8">
                Ask me about your inventory — I can look things up, create items, check out kits, and more.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-white whitespace-pre-wrap'
                      : 'bg-gray-100 text-gray-800 prose prose-sm prose-gray max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:bg-gray-200 [&_pre]:p-2 [&_pre]:rounded [&_code]:text-xs'
                  }`}
                >
                  {msg.role === 'assistant'
                    ? (msg.content
                      ? <ReactMarkdown components={markdownComponents()}>{msg.content}</ReactMarkdown>
                      : (streaming && i === messages.length - 1 ? '...' : ''))
                    : (msg.content || '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={streaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className="px-3 py-2 bg-primary text-white rounded-lg border-none cursor-pointer disabled:opacity-50 hover:bg-primary-hover"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
