import app from './router';
import { runIngestion } from './cron/ingest';
import { Env } from './types';

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runIngestion(env.DB, env.ANTHROPIC_API_KEY)
        .then((result) => {
          console.log(`[scheduled] Ingestion complete: ${result.fetched} new stories fetched`);
        })
        .catch((err) => {
          console.error('[scheduled] Ingestion failed:', err);
        })
    );
  },
};
