import app from './router';
import { runIngestion } from './cron/ingest';
import { Env } from './types';

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runIngestion(env.DB, env.ANTHROPIC_API_KEY)
        .then((result) => {
          // Screening failures are called out separately: a run that fetches
          // fine and screens nothing looks healthy in the logs otherwise, which
          // is how this went unnoticed from July to September 2026.
          const warn = result.screenFailures > 0 ? ` — ${result.screenFailures} SCREENING FAILURES` : '';
          console.log(
            `[scheduled] Ingestion complete: ${result.fetched} fetched, ` +
            `${result.screened} screened${warn}`
          );
        })
        .catch((err) => {
          console.error('[scheduled] Ingestion failed:', err);
        })
    );
  },
};
