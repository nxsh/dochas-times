import { useState } from 'react';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const result = await api.requestMagicLink(email);
      setStatus('sent');
      setMessage(result.message);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <h1 className="font-serif text-3xl font-bold text-gray-900 mb-2">Sign in</h1>
      <p className="text-warm-gray mb-8">
        Enter your email and we will send you a magic link to sign in.
      </p>

      {status === 'sent' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800">
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deep-green focus:border-transparent outline-none transition"
            />
          </div>

          {status === 'error' && (
            <p className="text-red-600 text-sm">{message}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full px-4 py-2.5 bg-deep-green text-white rounded-lg font-medium hover:bg-deep-green-light transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  );
}
