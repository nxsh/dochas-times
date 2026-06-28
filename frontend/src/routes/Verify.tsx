import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = searchParams.get('session');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(
        errorParam === 'invalid_token'
          ? 'Invalid or expired link. Please try signing in again.'
          : errorParam === 'token_required'
            ? 'No token provided.'
            : 'Verification failed.'
      );
      return;
    }

    if (session) {
      // Store session token from the redirect
      localStorage.setItem('session', session);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/', { replace: true });
      return;
    }

    // Legacy: handle token param (direct API call)
    const token = searchParams.get('token');
    if (!token) {
      setError('No token provided');
      return;
    }

    // Redirect to the worker verify endpoint which will redirect back with session
    window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/auth/verify?token=${token}`;
  }, [searchParams, navigate, queryClient]);

  if (error) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-4">Verification failed</h1>
        <p className="text-warm-gray mb-4">{error}</p>
        <Link to="/login" className="text-deep-green hover:underline">
          Try signing in again
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center py-12 text-warm-gray">Verifying your magic link...</div>
  );
}
