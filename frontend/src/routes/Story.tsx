import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CATEGORY_STYLES } from '../components/CategoryFilter';

export default function StoryPage() {
  const { id } = useParams<{ id: string }>();

  const { data: story, isLoading, isError } = useQuery({
    queryKey: ['story', id],
    queryFn: () => api.getStory(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-center py-12 text-warm-gray">Loading...</div>;
  }

  if (isError || !story) {
    return (
      <div className="text-center py-12">
        <p className="text-warm-gray mb-4">Story not found.</p>
        <Link to="/" className="text-deep-green hover:underline">Back to feed</Link>
      </div>
    );
  }

  if (story.origin === 'aggregated' && story.external_url) {
    return <Navigate to={story.external_url} replace />;
  }

  return (
    <article className="max-w-2xl mx-auto">
      <Link to="/" className="text-sm text-deep-green hover:underline mb-6 inline-block">
        Back to feed
      </Link>

      <div className="flex items-center gap-2 mb-3">
        {story.category && (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
              CATEGORY_STYLES[story.category] || CATEGORY_STYLES.other
            }`}
          >
            {story.category}
          </span>
        )}
        {story.source_name && (
          <span className="text-xs text-warm-gray">via {story.source_name}</span>
        )}
      </div>

      <h1 className="font-serif text-3xl font-bold text-gray-900 mb-4 leading-tight">
        {story.title}
      </h1>

      {story.published_at && (
        <p className="text-sm text-warm-gray mb-6">
          {new Date(story.published_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}

      {story.photo_url && (
        <img
          src={story.photo_url}
          alt=""
          className="w-full rounded-lg mb-6 object-cover max-h-96"
        />
      )}

      {story.body && (
        <div className="prose prose-gray max-w-none leading-relaxed text-gray-700 whitespace-pre-line">
          {story.body}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-gray-200 text-sm text-warm-gray">
        {story.upvote_count || 0} upvotes
      </div>
    </article>
  );
}
