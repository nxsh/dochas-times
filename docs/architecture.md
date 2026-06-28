# Dochas Times Architecture

## System Architecture

```mermaid
graph TB
    subgraph "Cloudflare Edge"
        Pages["Cloudflare Pages<br/>React SPA"]
        Worker["Cloudflare Worker<br/>Hono API"]
        D1["Cloudflare D1<br/>SQLite"]
    end

    subgraph "External Services"
        RSS["RSS Feeds<br/>News Sources"]
        Claude["Claude API<br/>Haiku 4.5<br/>AI Screening"]
    end

    User["Browser"] --> Pages
    Pages -->|"fetch /api/* + Bearer token"| Worker
    Worker --> D1
    Worker -->|"scheduled cron"| RSS
    Worker -->|"screen content"| Claude
```

## Data Flow: Aggregated Stories

```mermaid
sequenceDiagram
    participant Cron as Scheduled Cron
    participant Worker as Worker
    participant RSS as RSS Feed
    participant D1 as D1 Database
    participant AI as Claude Haiku 4.5

    Cron->>Worker: Trigger fetch (every 30min)
    Worker->>D1: Get active sources
    loop Each active source
        Worker->>RSS: Fetch feed (10s timeout)
        RSS-->>Worker: Feed entries
        Worker->>D1: Batch dedup by external_guid (batches of 20)
        D1-->>Worker: Existing GUIDs
        Worker->>D1: Insert new stories (status: submitted)
    end
    Worker->>D1: Get pending submitted stories (limit 20)
    loop Batches of 5
        Worker->>AI: Screen story content
        AI-->>Worker: Valence score + flags + category
        Worker->>D1: Store ai_screening record
        alt valence >= 6 AND flags=["none"] AND !needs_human_check
            Worker->>D1: Auto-publish (status: published)
        else
            Worker->>D1: Set status: ai_screened
        end
    end
```

## Story State Machine

```mermaid
stateDiagram-v2
    [*] --> submitted: Story created (RSS ingest or submission)
    submitted --> ai_screened: AI screening complete (below auto-publish threshold)
    submitted --> published: AI screening complete (auto-publish: valence>=6, no flags, no human check)
    ai_screened --> published: Editor approves
    ai_screened --> rejected: Editor rejects
    in_review --> published: Editor approves
    in_review --> rejected: Editor rejects
    rejected --> [*]
    published --> [*]
```

## Auth Flow (Magic Link + Bearer Token)

```mermaid
sequenceDiagram
    participant User as User
    participant FE as Frontend
    participant API as Worker API
    participant DB as D1 Database

    User->>FE: Enter email on /login
    FE->>API: POST /api/auth/magic-link
    API->>DB: Store magic_link_token (15min expiry)
    API-->>FE: { ok: true }
    Note over API: Magic link logged to console (Resend integration deferred)

    User->>FE: Click magic link -> /verify?token=xxx
    FE->>API: Redirect to GET /api/auth/verify?token=xxx
    API->>DB: Validate token (not used, not expired), mark used
    API->>DB: Upsert user record
    API->>DB: Create session (30 day expiry)
    API-->>FE: Redirect to /verify?session=xxx

    FE->>FE: Store session token in localStorage
    Note over FE,API: Subsequent requests include<br/>Authorization: Bearer {token}

    FE->>API: GET /api/auth/me (+ Bearer token)
    API->>DB: Lookup session -> user
    API-->>FE: User profile { id, email, name, role }
```

## LLM Screening Pipeline

The screening pipeline uses Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) to evaluate stories against an editorial rubric.

### Rubric Prompt

The LLM receives a structured prompt that asks it to score stories on a 0-10 valence scale:

- **ACCEPT (6-10)**: Genuine improvements, solutions, generosity, recovery, community, milestones
- **REJECT (0-3)**: Toxic positivity, ads, tragedy-spin, safeguarding issues, hate, unverifiable claims

### Response Schema

```json
{
  "is_positive": true,
  "category": "community|youth|environment|charity|milestone|event|other",
  "valence_score": 0-10,
  "locality": "place name or UK-wide",
  "why_one_line": "one sentence rationale",
  "suggested_headline": "reworded headline",
  "flags": ["none"] or ["unverifiable", "possible_ad", "safeguarding", "needs_context"],
  "needs_human_check": false
}
```

### Defensive Parsing

The `parseResponse` function handles common LLM output variations:
1. Strips markdown code fences (with or without `json` tag)
2. Extracts JSON from surrounding text
3. Clamps `valence_score` to 0-10
4. Normalises `flags` to array if returned as string
5. Falls back to `parse_error` flag on JSON failure

### Auto-Publish Criteria

A story is auto-published when ALL of the following are true:
- `valence_score >= 6`
- `is_positive === true`
- `flags === ["none"]` (exactly one element, and it's "none")
- `needs_human_check === false`

Otherwise, the story goes to `ai_screened` status for human review.

## Ingestion Pipeline

```mermaid
graph LR
    Cron["Cron Trigger<br/>*/30 * * * *"] --> Fetch["Fetch RSS Feeds"]
    Manual["POST /admin/sources/:id/fetch"] --> FetchOne["Fetch Single Source"]
    Fetch --> Dedup["Batch Dedup by GUID<br/>(batches of 20)"]
    FetchOne --> Dedup
    Dedup --> Insert["Insert as submitted"]
    Insert --> LLM["LLM Screening<br/>Claude Haiku 4.5<br/>(batches of 5, Promise.allSettled)"]
    LLM --> Score{"Auto-publish<br/>criteria met?"}
    Score -->|Yes| Publish["Status: published"]
    Score -->|No| Queue["Status: ai_screened"]
    Queue --> Editor["Editor Review"]
    Editor -->|Approve| Publish
    Editor -->|Reject| Rejected["Status: rejected"]
```

### Batch Processing Details

- Feed entries are deduped against existing `external_guid` values in batches of 20 (to stay within D1's SQL variable limit)
- LLM screening processes up to 20 pending stories per run, in batches of 5 concurrent requests using `Promise.allSettled`
- Failed screenings are logged but don't block other stories

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stories` | List published stories. Query params: `category`, `cursor`, `limit` (1-100, default 20) |
| GET | `/api/stories/:id` | Get single published story |
| GET | `/api/categories` | List valid categories |
| GET | `/health` | Health check |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/magic-link` | Request magic link. Body: `{ email }` |
| GET | `/api/auth/verify` | Verify magic link token. Query: `token`. Redirects to frontend with session |
| GET | `/api/auth/me` | Get current user (requires Bearer token) |
| POST | `/api/auth/logout` | Destroy session (Bearer token or cookie) |

### Admin (requires `admin` or `editor` role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/sources` | List RSS sources |
| POST | `/api/admin/sources` | Create source. Body: `{ name, feed_url, type?, url?, terms_ok? }` |
| PUT | `/api/admin/sources/:id` | Update source fields |
| DELETE | `/api/admin/sources/:id` | Delete source |
| POST | `/api/admin/sources/:id/fetch` | Trigger manual fetch for source |
| GET | `/api/admin/review-queue` | List stories with `ai_screened` or `in_review` status |
| POST | `/api/admin/stories/:id/publish` | Publish a reviewed story |
| POST | `/api/admin/stories/:id/reject` | Reject a story. Body: `{ reason? }` |

## Environment Variables and Secrets

### Worker (wrangler.toml / Cloudflare dashboard)

| Variable | Type | Description |
|----------|------|-------------|
| `DB` | D1 Binding | Cloudflare D1 database (dochas-times) |
| `ANTHROPIC_API_KEY` | Secret | API key for Claude Haiku screening (set via `wrangler secret put`) |
| `FRONTEND_URL` | Variable | Frontend URL for auth redirects (default: `https://dochas-times.pages.dev`) |

### Frontend (build-time env)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Worker API base URL (default: `http://localhost:8787`) |

## Database Schema (D1)

Key tables:
- `user` — id, email, name, role, home_patch_id, created_at
- `session` — id, user_id, token, expires_at, created_at
- `magic_link_token` — email, token, used, expires_at
- `source` — id, name, type, url, feed_url, terms_ok, active, last_fetched_at, created_at
- `story` — id, origin, patch_id, source_id, contributor_id, title, body, snippet, external_url, external_guid, photo_url, photo_consent, status, category, valence_score, flags, rejection_reason, created_at, published_at, updated_at
- `ai_screening` — id, story_id, raw_json, model_version
- `engagement` — id, story_id, user_id, type

## Admin UI

- **Sources page** (`/admin/sources`): CRUD for RSS sources, manual fetch trigger, active/inactive toggle
- **Review Queue** (`/admin/review`): Stories pending review with AI screening details (valence bar, flags, rationale), publish/reject actions
