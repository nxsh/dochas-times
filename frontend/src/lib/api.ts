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

  // Admin: Sources
  getSources: () => fetchApi<{ sources: import('./types').Source[] }>('/api/admin/sources'),

  addSource: (data: { name: string; type: string; feed_url: string; url?: string; terms_ok?: boolean }) =>
    fetchApi<{ source: import('./types').Source }>('/api/admin/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSource: (id: string, data: Partial<{ name: string; type: string; feed_url: string; url: string; terms_ok: boolean; active: boolean }>) =>
    fetchApi<{ source: import('./types').Source }>(`/api/admin/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSource: (id: string) =>
    fetchApi<{ ok: boolean }>(`/api/admin/sources/${id}`, { method: 'DELETE' }),

  fetchSource: (id: string) =>
    fetchApi<{ ok: boolean; fetched: number }>(`/api/admin/sources/${id}/fetch`, { method: 'POST' }),

  // Admin: Review Queue
  getReviewQueue: () =>
    fetchApi<{ stories: import('./types').ReviewStory[] }>('/api/admin/review-queue'),

  publishStory: (id: string) =>
    fetchApi<{ ok: boolean }>(`/api/admin/stories/${id}/publish`, { method: 'POST' }),

  rejectStory: (id: string, reason?: string) =>
    fetchApi<{ ok: boolean }>(`/api/admin/stories/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
