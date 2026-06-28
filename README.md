# Dochas Times

A hyperlocal good-news platform. Aggregates positive local stories from RSS feeds and accepts community submissions, with AI-powered content screening.

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, React Router v7, TanStack Query
- **API**: Cloudflare Worker with Hono framework
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Auth**: Magic link email authentication

## Project Structure

```
dochas-times/
  frontend/    React SPA deployed to Cloudflare Pages
  worker/      Hono API deployed as Cloudflare Worker
  docs/        Architecture documentation
```

## Development

### Worker

```bash
cd worker
npm install
npx wrangler dev
```

### Frontend

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8787 npm run dev
```

## Deployment

Both the worker and frontend are deployed to Cloudflare. See `worker/wrangler.toml` for worker config. The frontend is deployed via `wrangler pages deploy`.

## Phases

- **Phase 1** (current): Foundation -- feed, auth, project structure, deployment
- **Phase 2**: RSS aggregation cron, AI screening with Claude, image uploads to R2
- **Phase 3**: Submission form, editorial review queue, engagement (upvotes)
- **Phase 4**: Multi-patch support, contributor profiles, notifications
