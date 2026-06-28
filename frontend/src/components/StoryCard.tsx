import { Link } from 'react-router-dom';
import type { Story } from '../lib/types';
import { CATEGORY_STYLES } from './CategoryFilter';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

interface StoryCardProps {
  story: Story;
}

export default function StoryCard({ story }: StoryCardProps) {
  const isExternal = story.origin === 'aggregated' && story.external_url;

  const cardContent = (
    <article className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
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
          <span className="text-xs text-warm-gray">
            via {story.source_name}
          </span>
        )}
      </div>
      <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2 leading-snug">
        {story.title}
      </h2>
      {story.snippet && (
        <p className="text-sm text-gray-600 leading-relaxed mb-3">{story.snippet}</p>
      )}
      <div className="flex items-center justify-between text-xs text-warm-gray">
        <span>{story.published_at ? timeAgo(story.published_at) : ''}</span>
        <span>{story.upvote_count || 0} upvotes</span>
      </div>
    </article>
  );

  if (isExternal) {
    return (
      <a href={story.external_url!} target="_blank" rel="noopener noreferrer">
        {cardContent}
      </a>
    );
  }

  return <Link to={`/story/${story.id}`}>{cardContent}</Link>;
}
