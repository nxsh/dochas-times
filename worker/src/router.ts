import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { authMiddleware } from './middleware/auth';
import stories from './routes/stories';
import auth from './routes/auth';
import admin from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('*', authMiddleware);

app.route('/api', stories);
app.route('/api', auth);
app.route('/api', admin);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
