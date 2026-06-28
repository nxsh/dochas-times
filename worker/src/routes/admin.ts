import { Hono } from 'hono';
import { Env } from '../types';

const admin = new Hono<{ Bindings: Env }>();

// Placeholder stubs for Phase 3
admin.get('/admin/review-queue', async (c) => {
  return c.json({ message: 'Review queue coming in Phase 3' }, 501);
});

admin.post('/admin/stories/:id/approve', async (c) => {
  return c.json({ message: 'Approve endpoint coming in Phase 3' }, 501);
});

admin.post('/admin/stories/:id/reject', async (c) => {
  return c.json({ message: 'Reject endpoint coming in Phase 3' }, 501);
});

export default admin;
