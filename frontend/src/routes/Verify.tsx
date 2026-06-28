import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No token provided');
      return;
    }

    api
      .verifyToken(token)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['me'] });
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Verification failed');
      });
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
