import { Link } from 'react-router-dom';
import { useAuth } from '../components/AppLayout';
import { Monitor, Tags, MapPin } from 'lucide-react';

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

  const cards = [
    { to: '/kits', label: 'Kits', desc: 'View and manage equipment kits', icon: Tags, show: true },
    { to: '/computers', label: 'Computers', desc: 'Computer catalog and assignments', icon: Monitor, show: user.role === 'QUARTERMASTER' },
    { to: '/hostnames', label: 'Host Names', desc: 'Manage the host name pool', icon: Tags, show: user.role === 'QUARTERMASTER' },
    { to: '/sites', label: 'Sites', desc: 'Manage site locations', icon: MapPin, show: user.role === 'QUARTERMASTER' },
  ].filter((c) => c.show);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user.displayName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {user.role === 'QUARTERMASTER' ? 'Quartermaster' : 'Instructor'} — {user.email}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-primary hover:shadow-sm transition-all no-underline group"
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon size={20} className="text-primary" />
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary">
                  {card.label}
                </h3>
              </div>
              <p className="text-sm text-gray-500">{card.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
