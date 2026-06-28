export interface Env {
  DB: D1Database;
}

export type Role = 'reader' | 'contributor' | 'editor' | 'admin';
export type StoryOrigin = 'aggregated' | 'submission';
export type StoryStatus = 'submitted' | 'ai_screened' | 'in_review' | 'published' | 'rejected';
export type Category = 'community' | 'youth' | 'environment' | 'charity' | 'milestone' | 'event' | 'other';
export type SourceType = 'rss' | 'council' | 'charity';
export type EngagementType = 'upvote' | 'flag' | 'report';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  home_patch_id: string | null;
  created_at: string;
}

export interface Story {
  id: string;
  origin: StoryOrigin;
  patch_id: string | null;
  source_id: string | null;
  contributor_id: string | null;
  title: string;
  body: string | null;
  snippet: string | null;
  external_url: string | null;
  external_guid: string | null;
  photo_url: string | null;
  photo_consent: number;
  status: StoryStatus;
  category: Category | null;
  valence_score: number | null;
  flags: string;
  rejection_reason: string | null;
  created_at: string;
  published_at: string | null;
  updated_at: string;
  source_name?: string;
  upvote_count?: number;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface AuthUser {
  user: User;
}

export interface Variables {
  user?: User;
}
