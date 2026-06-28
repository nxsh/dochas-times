# Dochas Times

A hyperlocal good-news platform for Oxfordshire (and broader UK). Aggregates positive local stories from RSS feeds, screens them with AI, and surfaces them in a clean, community-focused feed. Accepts community submissions (deferred to Phase 3).

## Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript, Tailwind CSS, React Router v7, TanStack Query
- **API**: Cloudflare Worker with Hono framework
- **Database**: Cloudflare D1 (SQLite at the edge)
- **AI Screening**: Claude Haiku 4.5 via Anthropic API
- **Auth**: Magic link email (Bearer token sessions)
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Workers (API)

## Project Structure

```
dochas-times/
  frontend/    React SPA deployed to Cloudflare Pages
  worker/      Hono API deployed as Cloudflare Worker
  docs/        Architecture documentation
```

## Local Development

### Prerequisites

- Node.js 22+
- Cloudflare account with D1 database provisioned
- Anthropic API key (for LLM screening)

### Worker

```bash
cd worker
npm install
npx wrangler dev
```

The worker runs on `http://localhost:8787` by default. Set the `ANTHROPIC_API_KEY` secret:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

### Frontend

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8787 npm run dev
```

The frontend runs on `http://localhost:5173` by default.

## Deployment

### Worker

```bash
cd worker
npx wrangler deploy
```

### Frontend

```bash
cd frontend
VITE_API_URL=https://dochas-api.ryan-nash43.workers.dev npm run build
npx wrangler pages deploy dist --project-name dochas-times --commit-dirty=true --branch main
```

## Adding RSS Sources

1. Sign in as an admin user
2. Navigate to `/admin/sources`
3. Click "Add Source" and provide:
   - **Name**: Human-readable source name (e.g. "BBC Oxfordshire")
   - **Feed URL**: RSS/Atom feed URL
   - **Type**: `rss`, `council`, or `charity`
   - **Terms OK**: Confirm you've reviewed the source's terms
4. Click "Fetch Now" to trigger an immediate ingestion
5. New stories appear in the Review Queue or are auto-published based on AI screening

Sources are polled automatically every 30 minutes via cron trigger.

## Running Tests

```bash
cd worker
npm test           # Single run
npm run test:watch # Watch mode
```

## Current MVP Scope

**Implemented:**
- RSS feed aggregation with cron (every 30 minutes) and manual fetch
- AI screening with Claude Haiku 4.5 (rubric-based valence scoring)
- Auto-publish for high-quality stories (valence >= 6, no flags)
- Editorial review queue with publish/reject actions
- Magic link auth with Bearer token sessions
- Source management (CRUD, active toggle)
- Category filtering and cursor-based pagination
- Responsive UI with Tailwind CSS

**Deferred:**
- Email delivery (magic links logged to console; Resend integration planned)
- Image uploads to R2
- User submission form
- Engagement features (upvotes visible but not yet interactive from frontend)
- Multi-patch support
- Contributor profiles and notifications
- Rate limiting on auth endpoints

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed diagrams covering:
- System architecture
- Ingestion pipeline with batch dedup
- LLM screening rubric and auto-publish criteria
- Auth flow (magic link + Bearer token)
- Story state machine
- API endpoint reference
- Environment variables
