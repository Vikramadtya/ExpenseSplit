import { z } from 'zod';

/** "#Trip " and "trip" are the same tag: stored lower-case, without the hash. */
export const tag = z
  .string()
  .transform((s) => s.trim().replace(/^#+/, '').trim().toLowerCase())
  .pipe(z.string().min(1).max(50));

export const uniqueTags = (tags: string[]) => [...new Set(tags)];
