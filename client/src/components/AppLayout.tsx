import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Monitor, Tags, PackageCheck, MapPin, Shield, Menu, X, LogOut, ChevronDown, UserCircle, AlertTriangle, Search, BarChart3, Package, Box,
} from 'lucide-react';
import AiChat from './AiChat';
import { ROLE_SHORT_LABELS, hasQMAccess } from '../lib/roles';

interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  avatar: string | null;
  role: string;
}

const AuthContext = createContext<{ user: AuthUser | null; loading: boolean }>({
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/kits', label: 'Kits', icon: Tags,
    children: [{ to: '/packs', label: 'Packs' }, { to: '/kits/retired', label: 'Retired Kits' }],
  },
  { to: '/checkouts', label: 'Transferred Out', icon: PackageCheck },
  { to: '/issues', label: 'Issues', icon: AlertTriangle },
  { to: '/computers', label: 'Computers', icon: Monitor, qmOnly: true,
    children: [{ to: '/hostnames', label: 'Host Names' }, { to: '/computers/inactive', label: 'Inactive Computers' }],
  },
  { to: '/sites', label: 'Sites', icon: MapPin, qmOnly: true },
  { to: '/reports/audit-log', label: 'Reports', icon: BarChart3, qmOnly: true,
    children: [
      { to: '/reports/inventory-age', label: 'Inventory Age' },
      { to: '/reports/transferred-by-person', label: 'By Person' },
    ],
  },
  { to: '/admin', label: 'Admin', icon: Shield },
];

// Search result types
interface SearchResult {
  type: 'kit' | 'pack' | 'item' | 'computer' | 'site';
  id: number;
  title: string;
  subtitle: string | null;
  url: string;
}

const typeIcons: Record<string, any> = {
  kit: Tags,
  pack: Package,
  item: Box,
  computer: Monitor,
  site: MapPin,
};

const typeColors: Record<string, string> = {
  kit: 'bg-blue-100 text-blue-800',
  pack: 'bg-purple-100 text-purple-800',
  item: 'bg-green-100 text-green-800',
  computer: 'bg-orange-100 text-orange-800',
  site: 'bg-gray-100 text-gray-800',
};

function SearchResults({ query, results, loading, onNavigate }: {
  query: string;
  results: SearchResult[];
  loading: boolean;
  onNavigate: () => void;
}) {
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto">
      {loading && <p className="text-sm text-gray-500">Searching...</p>}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-gray-500">No results found for &ldquo;{query}&rdquo;</p>
      )}

      {Object.entries(grouped).map(([type, items]) => {
        const Icon = typeIcons[type] || Box;
        return (
          <div key={type} className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
              <Icon size={16} />
              {type}s ({items.length})
            </h2>
            <div className="bg-white rounded-lg shadow divide-y">
              {items.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  to={r.url}
                  onClick={onNavigate}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 no-underline text-gray-900"
                >
                  <div>
                    <div className="font-medium">{r.title}</div>
                    {r.subtitle && <div className="text-sm text-gray-500">{r.subtitle}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[r.type]}`}>
                    {r.type}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AppLayout() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchActive = searchQuery.length >= 2;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close sidebar on route change (mobile) and clear search
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [location.pathname]);

  // Search debounce
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ }
      setSearchLoading(false);
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/');
  }

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
  }

  const filteredNav = navItems.filter(
    (item) => !item.qmOnly || (user && hasQMAccess(user.role))
  );

  const showSidebar = !loading && !!user;

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <div className="flex h-screen bg-gray-50">
        {/* Mobile overlay */}
        {showSidebar && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — only shown when authenticated */}
        {showSidebar && (
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-text
            transform transition-transform duration-200 ease-in-out
            lg:relative lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
            <Link to="/" className="text-white font-bold text-lg no-underline">
              LAP Inventory
            </Link>
            <button
              className="lg:hidden text-slate-400 hover:text-white bg-transparent border-none p-1"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mt-4 px-2 space-y-1">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              const sectionActive = active || (item.children?.some((c) => isActive(c.to)) ?? false);
              return (
                <div key={item.to}>
                  <Link
                    to={item.to}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline
                      transition-colors duration-150
                      ${sectionActive
                        ? 'bg-sidebar-hover text-sidebar-active font-medium'
                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-active'
                      }
                    `}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                  {sectionActive && item.children?.map((child) => (
                    <Link
                      key={child.to}
                      to={child.to}
                      className={`
                        flex items-center gap-3 pl-10 pr-3 py-1.5 rounded-lg text-xs no-underline
                        transition-colors duration-150
                        ${isActive(child.to)
                          ? 'text-sidebar-active font-medium'
                          : 'text-sidebar-text hover:text-sidebar-active'
                        }
                      `}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header bar */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 gap-4">
            {showSidebar && (
              <button
                className="lg:hidden text-gray-500 hover:text-gray-700 bg-transparent border-none p-1"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>
            )}

            {/* Search bar */}
            {showSidebar && (
              <div className="flex-1 max-w-xl relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search kits, packs, items, computers..."
                  className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0.5"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {!showSidebar && <div />}

            {/* User menu */}
            <div className="relative shrink-0">
              {user ? (
                <>
                  <button
                    className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-gray-700 hover:text-gray-900 p-1"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                        {user.displayName.charAt(0)}
                      </div>
                    )}
                    <span className="hidden sm:inline text-sm">{user.displayName}</span>
                    <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-primary text-white">
                      {ROLE_SHORT_LABELS[user.role as keyof typeof ROLE_SHORT_LABELS] || user.role}
                    </span>
                    <ChevronDown size={14} />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                          {user.email}
                        </div>
                        <Link
                          to="/account"
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 no-underline"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <UserCircle size={14} />
                          Account
                        </Link>
                        <button
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer text-left"
                          onClick={handleLogout}
                        >
                          <LogOut size={14} />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                !loading && (
                  <a
                    href={`/api/auth/google?returnTo=${encodeURIComponent(location.pathname)}`}
                    className="text-sm px-4 py-2 bg-primary text-white rounded-lg no-underline hover:bg-primary-hover"
                  >
                    Sign in
                  </a>
                )
              )}
            </div>
          </header>

          {/* Page content — replaced by search results when searching */}
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {searchActive ? (
              <SearchResults
                query={searchQuery}
                results={searchResults}
                loading={searchLoading}
                onNavigate={clearSearch}
              />
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
      {showSidebar && <AiChat />}
    </AuthContext.Provider>
  );
}
