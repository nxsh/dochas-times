import { Hono } from 'hono';
import { Env } from '../types';
import { getPublishedStories, getStoryById } from '../db/queries';

const CATEGORIES = ['community', 'youth', 'environment', 'charity', 'milestone', 'event', 'other'] as const;

const stories = new Hono<{ Bindings: Env }>();

stories.get('/stories', async (c) => {
  const category = c.req.query('category');
  const cursor = c.req.query('cursor');
  const limitParam = c.req.query('limit');
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : 20;
  const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100);

  if (category && !CATEGORIES.includes(category as any)) {
    return c.json({ error: 'Invalid category' }, 400);
  }

  const result = await getPublishedStories(c.env.DB, { category, cursor, limit });
  return c.json(result);
});

stories.get('/stories/:id', async (c) => {
  const id = c.req.param('id');
  const story = await getStoryById(c.env.DB, id);

  if (!story) {
    return c.json({ error: 'Story not found' }, 404);
  }

  return c.json(story);
});

stories.get('/categories', (c) => {
  return c.json(CATEGORIES);
});

export default stories;
