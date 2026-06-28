export type Category = 'community' | 'youth' | 'environment' | 'charity' | 'milestone' | 'event' | 'other';

export interface Story {
  id: string;
  origin: 'aggregated' | 'submission';
  patch_id: string | null;
  source_id: string | null;
  title: string;
  body: string | null;
  snippet: string | null;
  external_url: string | null;
  photo_url: string | null;
  status: string;
  category: Category | null;
  valence_score: number | null;
  created_at: string;
  published_at: string | null;
  source_name?: string;
  upvote_count?: number;
}

export interface StoriesResponse {
  stories: Story[];
  nextCursor: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface Source {
  id: string;
  name: string;
  type: string;
  url: string;
  feed_url: string;
  terms_ok: number;
  active: number;
  last_fetched_at: string | null;
  created_at: string;
}

export interface AiScreening {
  is_positive: boolean;
  category: string;
  valence_score: number;
  locality: string;
  why_one_line: string;
  suggested_headline: string;
  flags: string[];
  needs_human_check: boolean;
}

export interface ReviewStory extends Story {
  ai_screening: string | null;
  flags: string;
}
