CREATE TABLE user (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader','contributor','editor','admin')),
    home_patch_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_user_email ON user(email);

CREATE TABLE patch (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    geo_bounds TEXT
);

CREATE TABLE source (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('rss','council','charity')),
    url TEXT NOT NULL,
    feed_url TEXT NOT NULL,
    terms_ok INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    last_fetched_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE story (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    origin TEXT NOT NULL CHECK (origin IN ('aggregated','submission')),
    patch_id TEXT,
    source_id TEXT,
    contributor_id TEXT,
    title TEXT NOT NULL,
    body TEXT,
    snippet TEXT,
    external_url TEXT,
    external_guid TEXT,
    photo_url TEXT,
    photo_consent INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','ai_screened','in_review','published','rejected')),
    category TEXT CHECK (category IN ('community','youth','environment','charity','milestone','event','other')),
    valence_score INTEGER CHECK (valence_score BETWEEN 0 AND 10),
    flags TEXT DEFAULT '[]',
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_story_status ON story(status);
CREATE INDEX idx_story_published ON story(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_story_category ON story(category) WHERE status = 'published';
CREATE INDEX idx_story_external_guid ON story(external_guid) WHERE external_guid IS NOT NULL;

CREATE TABLE ai_screening (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    story_id TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_screening_story ON ai_screening(story_id);

CREATE TABLE engagement (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    story_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('upvote','flag','report')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(story_id, user_id, type)
);
CREATE INDEX idx_engagement_story ON engagement(story_id);

CREATE TABLE submission_licence (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    story_id TEXT NOT NULL,
    contributor_user_id TEXT NOT NULL,
    terms_version TEXT NOT NULL DEFAULT '1.0',
    granted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE magic_link_token (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_token_lookup ON magic_link_token(token) WHERE used = 0;

CREATE TABLE session (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_session_token ON session(token);
