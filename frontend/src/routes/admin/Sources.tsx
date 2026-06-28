import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Source } from '../../lib/types';

export default function Sources() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', feed_url: '', type: 'rss', terms_ok: false });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sources'],
    queryFn: api.getSources,
  });

  const addMutation = useMutation({
    mutationFn: (data: { name: string; feed_url: string; type: string; terms_ok: boolean }) =>
      api.addSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sources'] });
      setShowForm(false);
      setFormData({ name: '', feed_url: '', type: 'rss', terms_ok: false });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateSource(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
  });

  const fetchMutation = useMutation({
    mutationFn: (id: string) => api.fetchSource(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-sources'] });
      alert(`Fetched ${data.fetched} new stories`);
    },
    onError: (err) => {
      alert(`Fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-warm-gray">Loading sources...</div>;
  }

  const sources = data?.sources || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900">RSS Sources</h1>
          <p className="text-warm-gray mt-1">Manage RSS feeds for story ingestion.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-deep-green text-white rounded-lg font-medium hover:bg-deep-green-light transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Source'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deep-green focus:border-transparent outline-none"
                placeholder="BBC England"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deep-green focus:border-transparent outline-none"
              >
                <option value="rss">RSS</option>
                <option value="council">Council</option>
                <option value="charity">Charity</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feed URL</label>
            <input
              type="url"
              required
              value={formData.feed_url}
              onChange={(e) => setFormData({ ...formData, feed_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deep-green focus:border-transparent outline-none"
              placeholder="https://example.com/rss.xml"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="terms_ok"
              checked={formData.terms_ok}
              onChange={(e) => setFormData({ ...formData, terms_ok: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="terms_ok" className="text-sm text-gray-700">
              Terms of use reviewed and accepted
            </label>
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="px-4 py-2 bg-deep-green text-white rounded-lg font-medium hover:bg-deep-green-light transition-colors disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adding...' : 'Add Source'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {sources.map((source: Source) => (
          <div
            key={source.id}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-gray-900">{source.name}</h3>
              <div className="flex gap-1.5 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  source.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                }`}>
                  {source.active ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                  {source.type}
                </span>
              </div>
            </div>
            <p className="text-sm text-warm-gray truncate">{source.feed_url}</p>
            {source.last_fetched_at && (
              <p className="text-xs text-warm-gray mt-1">
                Last fetched: {new Date(source.last_fetched_at).toLocaleString()}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => fetchMutation.mutate(source.id)}
                disabled={fetchMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                Fetch Now
              </button>
              <button
                onClick={() => toggleMutation.mutate({ id: source.id, active: !source.active })}
                className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {source.active ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete source "${source.name}"?`)) {
                    deleteMutation.mutate(source.id);
                  }
                }}
                className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {sources.length === 0 && (
          <p className="text-center py-8 text-warm-gray">No sources configured yet.</p>
        )}
      </div>
    </div>
  );
}
