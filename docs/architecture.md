# Dochas Times Architecture

## System Architecture

```mermaid
graph TB
    subgraph "Cloudflare Edge"
        Pages["Cloudflare Pages<br/>React SPA"]
        Worker["Cloudflare Worker<br/>Hono API"]
        D1["Cloudflare D1<br/>SQLite"]
        R2["Cloudflare R2<br/>Image Storage<br/>(Phase 2)"]
    end

    subgraph "External Services"
        Resend["Resend<br/>Magic Link Emails"]
        RSS["RSS Feeds<br/>News Sources"]
        Claude["Claude API<br/>AI Screening<br/>(Phase 2)"]
    end

    User["Browser"] --> Pages
    Pages -->|"fetch /api/*"| Worker
    Worker --> D1
    Worker --> R2
    Worker -->|"send email"| Resend
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
    participant AI as Claude API

    Cron->>Worker: Trigger fetch (every 30min)
    Worker->>RSS: Fetch feed
    RSS-->>Worker: Feed entries
    Worker->>D1: Check external_guid exists
    D1-->>Worker: Existing GUIDs
    Worker->>D1: Insert new stories (status: submitted)
    Worker->>AI: Screen story content
    AI-->>Worker: Valence score + flags
    Worker->>D1: Update status to ai_screened
    Note over Worker,D1: High-valence stories auto-publish<br/>Flagged stories go to review queue
```

## Data Flow: User Submissions

```mermaid
sequenceDiagram
    participant User as Contributor
    participant Pages as Frontend
    participant Worker as Worker API
    participant D1 as D1 Database
    participant AI as Claude API

    User->>Pages: Submit story form
    Pages->>Worker: POST /api/stories
    Worker->>D1: Insert story (status: submitted)
    Worker->>D1: Insert submission_licence
    Worker->>AI: Screen content
    AI-->>Worker: Valence score + flags
    Worker->>D1: Update to ai_screened
    Note over D1: Story enters review queue
    Note over D1: Editor approves -> published
```

## Story State Machine

```mermaid
stateDiagram-v2
    [*] --> submitted: Story created
    submitted --> ai_screened: AI screening complete
    ai_screened --> published: Auto-publish (high valence, no flags)
    ai_screened --> in_review: Needs human review
    in_review --> published: Editor approves
    in_review --> rejected: Editor rejects
    rejected --> [*]
    published --> [*]
```

## Auth Flow (Magic Link)

```mermaid
sequenceDiagram
    participant User as User
    participant FE as Frontend
    participant API as Worker API
    participant DB as D1 Database
    participant Email as Resend

    User->>FE: Enter email on /login
    FE->>API: POST /api/auth/magic-link
    API->>DB: Store magic_link_token (15min expiry)
    API->>Email: Send magic link email
    Email-->>User: Email with link

    User->>FE: Click magic link -> /verify?token=xxx
    FE->>API: GET /api/auth/verify?token=xxx
    API->>DB: Validate token, mark used
    API->>DB: Upsert user record
    API->>DB: Create session (30 day expiry)
    API-->>FE: Set-Cookie: session=xxx
    FE->>FE: Redirect to feed

    Note over FE,API: Subsequent requests include<br/>session cookie automatically
    FE->>API: GET /api/auth/me
    API->>DB: Lookup session -> user
    API-->>FE: User profile
```

## Phase 2: RSS Ingestion Pipeline

### Components

1. **RSS Service** (`worker/src/services/rss.ts`)
   - Parses RSS 2.0 and Atom feeds using `fast-xml-parser`
   - 10-second fetch timeout
   - Extracts: title, description, link, guid, pubDate
   - Strips HTML from content

2. **LLM Screening Service** (`worker/src/services/llm.ts`)
   - Calls Anthropic API (Claude Haiku `claude-haiku-4-5-20251001`)
   - Scores stories against editorial rubric (valence 0-10)
   - Categories: community, youth, environment, charity, milestone, event, other
   - Flags: none, unverifiable, possible_ad, safeguarding, needs_context
   - Defensive JSON parsing (strips code fences, fallback on parse failure)

3. **Cron Ingestion** (`worker/src/cron/ingest.ts`)
   - Runs every 30 minutes via Cloudflare cron trigger
   - Fetches all active sources, deduplicates by `external_guid`
   - Screens new stories via LLM in batches of 5
   - Auto-publishes stories with `valence_score >= 6`, `flags = ["none"]`, `needs_human_check = false`
   - Otherwise sets status to `ai_screened` for human review

4. **Admin Routes** (`worker/src/routes/admin.ts`)
   - CRUD for RSS sources (requires admin/editor role)
   - Manual fetch trigger per source
   - Review queue with AI screening data
   - Publish/reject actions

### Ingestion Flow

```mermaid
graph LR
    Cron["Cron Trigger<br/>*/30 * * * *"] --> Fetch["Fetch RSS Feeds"]
    Fetch --> Dedup["Dedup by GUID"]
    Dedup --> Insert["Insert as submitted"]
    Insert --> LLM["LLM Screening<br/>Claude Haiku"]
    LLM --> Score{"valence >= 6<br/>no flags?"}
    Score -->|Yes| Publish["Auto-publish"]
    Score -->|No| Queue["Review Queue"]
    Queue --> Editor["Editor Review"]
    Editor -->|Approve| Publish
    Editor -->|Reject| Rejected["Rejected"]
```

### Admin UI

- **Sources page** (`/admin/sources`): CRUD for RSS sources, manual fetch, active toggle
- **Review Queue** (`/admin/review`): stories pending review with AI screening details, publish/reject actions
