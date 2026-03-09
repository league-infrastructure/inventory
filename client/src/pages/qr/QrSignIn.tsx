import { useLocation } from 'react-router-dom';

const isDev = import.meta.env.DEV;

interface Props {
  signInUrl: string;
  title?: string;
  subtitle?: string;
}

export default function QrSignIn({ signInUrl, title, subtitle }: Props) {
  const location = useLocation();
  const devLoginUrl = `/api/auth/test-login?role=first-instructor&returnTo=${encodeURIComponent(location.pathname)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">LAP Inventory</h1>
        {title && <p className="text-lg font-semibold text-gray-700 mb-1">{title}</p>}
        {subtitle && <p className="text-gray-500 text-sm mb-6">{subtitle}</p>}
        <a
          href={signInUrl}
          className="inline-block w-full px-6 py-3 bg-primary text-white rounded-lg text-base font-medium no-underline hover:bg-primary-hover transition-colors"
        >
          Sign in with Google
        </a>
        {isDev && (
          <a
            href={devLoginUrl}
            className="inline-block w-full px-6 py-3 mt-3 bg-amber-500 text-white rounded-lg text-base font-medium no-underline hover:bg-amber-600 transition-colors"
          >
            Sign in as first instructor
          </a>
        )}
      </div>
    </div>
  );
}
