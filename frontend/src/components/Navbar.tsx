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

  return (
    <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <h1 className="font-serif text-2xl font-bold text-deep-green tracking-tight">
            Dochas Times
          </h1>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <>
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
            </>
          )}
          {user ? (
            <span className="text-warm-gray">{user.email}</span>
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
    </nav>
  );
}
