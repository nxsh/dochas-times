const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((errorBody as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getStories: (params?: { category?: string; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return fetchApi<import('./types').StoriesResponse>(`/api/stories${qs ? `?${qs}` : ''}`);
  },

  getStory: (id: string) => fetchApi<import('./types').Story>(`/api/stories/${id}`),

  getCategories: () => fetchApi<string[]>('/api/categories'),

  requestMagicLink: (email: string) =>
    fetchApi<{ ok: boolean; message: string }>('/api/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyToken: (token: string) =>
    fetchApi<{ ok: boolean; user: import('./types').User }>(`/api/auth/verify?token=${token}`, {
      method: 'GET',
    }),

  getMe: () => fetchApi<{ user: import('./types').User }>('/api/auth/me'),

  logout: () => fetchApi<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
};
