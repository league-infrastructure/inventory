import { useState, useEffect, createContext, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Monitor, Tags, PackageCheck, MapPin, Shield, Menu, X, LogOut, ChevronDown, UserCircle,
} from 'lucide-react';

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
  { to: '/', label: 'Home', icon: Home, roles: null },
  { to: '/kits', label: 'Kits', icon: Tags, roles: null,
    children: [{ to: '/packs', label: 'Packs' }],
  },
  { to: '/checkouts', label: 'Checked Out', icon: PackageCheck, roles: null },
  { to: '/computers', label: 'Computers', icon: Monitor, roles: ['QUARTERMASTER'],
    children: [{ to: '/hostnames', label: 'Host Names' }, { to: '/computers/inactive', label: 'Inactive Computers' }],
  },
  { to: '/sites', label: 'Sites', icon: MapPin, roles: ['QUARTERMASTER'] },
  { to: '/admin', label: 'Admin', icon: Shield, roles: null },
];

export default function AppLayout() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/');
  }

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  const filteredNav = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
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
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
            {showSidebar && (
              <button
                className="lg:hidden text-gray-500 hover:text-gray-700 bg-transparent border-none p-1"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>
            )}

            <div className="lg:hidden" /> {/* spacer */}

            <div className="hidden lg:block text-sm text-gray-500">
              {/* breadcrumb area — can extend later */}
            </div>

            {/* User menu */}
            <div className="relative">
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
                      {user.role === 'QUARTERMASTER' ? 'QM' : 'Inst'}
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
                    href="/api/auth/google"
                    className="text-sm px-4 py-2 bg-primary text-white rounded-lg no-underline hover:bg-primary-hover"
                  >
                    Sign in
                  </a>
                )
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
