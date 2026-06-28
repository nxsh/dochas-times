import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import StoryCard from '../components/StoryCard';
import CategoryFilter from '../components/CategoryFilter';
import type { StoriesResponse } from '../lib/types';

export default function Feed() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cursors, setCursors] = useState<string[]>([]);
  const currentCursor = cursors[cursors.length - 1] || undefined;

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });

  const { data, isLoading, isError } = useQuery<StoriesResponse>({
    queryKey: ['stories', selectedCategory, currentCursor],
    queryFn: () =>
      api.getStories({
        category: selectedCategory || undefined,
        cursor: currentCursor,
      }),
  });

  const handleCategoryChange = (cat: string | null) => {
    setSelectedCategory(cat);
    setCursors([]);
  };

  const loadMore = () => {
    if (data?.nextCursor) {
      setCursors((prev) => [...prev, data.nextCursor!]);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-serif text-3xl font-bold text-gray-900 mb-1">Good News Feed</h2>
        <p className="text-warm-gray">Stories that make your community shine.</p>
      </div>

      {categories && (
        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
          onSelect={handleCategoryChange}
        />
      )}

      {isLoading && (
        <div className="text-center py-12 text-warm-gray">Loading stories...</div>
      )}

      {isError && (
        <div className="text-center py-12 text-red-600">
          Something went wrong loading stories. Please try again.
        </div>
      )}

      {data && data.stories.length === 0 && (
        <div className="text-center py-16">
          <p className="text-lg text-warm-gray">No stories yet -- check back soon!</p>
        </div>
      )}

      {data && data.stories.length > 0 && (
        <div className="flex flex-col gap-4">
          {data.stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}

      {data?.nextCursor && (
        <div className="text-center mt-8">
          <button
            onClick={loadMore}
            className="px-6 py-2.5 bg-deep-green text-white rounded-lg font-medium hover:bg-deep-green-light transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
