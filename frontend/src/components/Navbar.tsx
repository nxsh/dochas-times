import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Navbar() {
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  });

  const user = data?.user;
  const isAdmin = user && (user.role === 'admin' || user.role === 'editor');

  return (
    <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex-shrink-0">
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-deep-green tracking-tight">
              D&oacute;chas Times
            </h1>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4 text-sm">
            {user ? (
              <span className="text-warm-gray text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                {user.name || user.email.split('@')[0]}
              </span>
            ) : (
              <Link
                to="/login"
                className="text-deep-green hover:text-deep-green-light font-medium transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-4 mt-2 text-sm border-t border-gray-100 pt-2">
            <Link to="/" className="text-warm-gray hover:text-deep-green transition-colors">
              Feed
            </Link>
            <Link
              to="/admin/review"
              className="text-deep-green hover:text-deep-green-light font-medium transition-colors"
            >
              Review Queue
            </Link>
            <Link
              to="/admin/sources"
              className="text-deep-green hover:text-deep-green-light font-medium transition-colors"
            >
              Sources
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
