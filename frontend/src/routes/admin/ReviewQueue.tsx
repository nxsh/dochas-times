import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CATEGORY_STYLES } from '../../components/CategoryFilter';
import type { ReviewStory, AiScreening } from '../../lib/types';

function parseScreening(raw: string | null): AiScreening | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiScreening;
  } catch {
    return null;
  }
}

function parseFlags(flagsStr: string | undefined): string[] {
  if (!flagsStr) return [];
  try {
    return JSON.parse(flagsStr) as string[];
  } catch {
    return [];
  }
}

function flagColor(flag: string): string {
  switch (flag) {
    case 'none': return 'bg-green-100 text-green-800';
    case 'safeguarding': return 'bg-red-100 text-red-800';
    case 'possible_ad': return 'bg-yellow-100 text-yellow-800';
    case 'unverifiable': return 'bg-orange-100 text-orange-800';
    case 'needs_context': return 'bg-blue-100 text-blue-800';
    case 'parse_error': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function ValenceBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = (score / 10) * 100;
  const color = score >= 7 ? 'bg-emerald-500' : score >= 4 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-6 text-right">{score}</span>
    </div>
  );
}

function ReviewCard({ story, onPublish, onReject }: {
  story: ReviewStory;
  onPublish: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const screening = parseScreening(story.ai_screening);
  const flags = parseFlags(story.flags);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {story.category && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
                CATEGORY_STYLES[story.category] || CATEGORY_STYLES.other
              }`}>
                {story.category}
              </span>
            )}
            {story.source_name && (
              <span className="text-xs text-warm-gray">via {story.source_name}</span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              story.status === 'ai_screened' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {story.status}
            </span>
          </div>

          <h3 className="font-serif text-lg font-semibold text-gray-900 mb-1">{story.title}</h3>

          {story.snippet && (
            <p className="text-sm text-gray-600 mb-3">{story.snippet}</p>
          )}

          <div className="mb-3 max-w-xs">
            <ValenceBar score={story.valence_score} />
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {flags.map((flag, i) => (
              <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-medium ${flagColor(flag)}`}>
                {flag}
              </span>
            ))}
          </div>

          {screening && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-deep-green hover:underline"
            >
              {expanded ? 'Hide AI details' : 'Show AI details'}
            </button>
          )}

          {expanded && screening && (
            <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <div><span className="font-medium">Positive:</span> {screening.is_positive ? 'Yes' : 'No'}</div>
              <div><span className="font-medium">Locality:</span> {screening.locality}</div>
              <div><span className="font-medium">Rationale:</span> {screening.why_one_line}</div>
              <div><span className="font-medium">Suggested headline:</span> {screening.suggested_headline}</div>
              <div><span className="font-medium">Needs human check:</span> {screening.needs_human_check ? 'Yes' : 'No'}</div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onPublish(story.id)}
            className="px-4 py-2 bg-deep-green text-white rounded-lg text-sm font-medium hover:bg-deep-green-light transition-colors"
          >
            Publish
          </button>
          <button
            onClick={() => setShowReject(!showReject)}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>

      {showReject && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-300 focus:border-transparent outline-none"
          />
          <button
            onClick={() => {
              onReject(story.id, rejectReason);
              setShowReject(false);
              setRejectReason('');
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      )}

      {story.external_url && (
        <a
          href={story.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs text-deep-green hover:underline"
        >
          View original article
        </a>
      )}
    </div>
  );
}

export default function ReviewQueue() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['review-queue'],
    queryFn: api.getReviewQueue,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.publishStory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectStory(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
  });

  if (isLoading) {
    return <div className="text-center py-12 text-warm-gray">Loading review queue...</div>;
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-red-600">
        Failed to load review queue. Are you signed in as an admin?
      </div>
    );
  }

  const stories = data?.stories || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-gray-900">Review Queue</h1>
        <p className="text-warm-gray mt-1">
          {stories.length} {stories.length === 1 ? 'story' : 'stories'} awaiting review.
        </p>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-warm-gray">All caught up -- no stories to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stories.map((story: ReviewStory) => (
            <ReviewCard
              key={story.id}
              story={story}
              onPublish={(id) => publishMutation.mutate(id)}
              onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
