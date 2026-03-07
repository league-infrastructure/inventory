import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/env', label: 'Environment' },
  { to: '/admin/db', label: 'Database' },
  { to: '/admin/config', label: 'Configuration' },
  { to: '/admin/logs', label: 'Logs' },
  { to: '/admin/sessions', label: 'Sessions' },
  { to: '/admin/permissions', label: 'Permissions' },
  { to: '/admin/tokens', label: 'API Tokens' },
  { to: '/admin/import-export', label: 'Import / Export' },
  { to: '/admin/users', label: 'Users' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/admin/check')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) navigate('/admin', { replace: true });
      })
      .catch(() => navigate('/admin', { replace: true }))
      .finally(() => setChecking(false));
  }, [navigate]);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    navigate('/admin', { replace: true });
  }

  if (checking) return null;

  return (
    <div className="flex gap-6">
      {/* Admin sub-nav */}
      <nav className="hidden sm:flex flex-col w-48 shrink-0">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Admin Panels</h3>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm no-underline transition-colors mb-0.5 ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer"
        >
          <LogOut size={14} />
          Admin Logout
        </button>
      </nav>

      {/* Mobile admin nav */}
      <div className="sm:hidden mb-4 flex flex-wrap gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-1 rounded-full text-xs no-underline ${
                isActive
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
