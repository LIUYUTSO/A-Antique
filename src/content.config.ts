import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

// data/objects.json is shared with the Meshy and flat pipelines, so it stays the single source.
// A bad entry fails the build instead of shipping a broken page.
const objects = defineCollection({
  loader: file('data/objects.json', { parser: (text) => JSON.parse(text).objects }),
  schema: z
    .object({
      id: z.string().regex(/^\d{3}$/, 'id is three digits, e.g. 012'),
      name: z.string().min(1),
      group: z.enum(['P', 'T', 'M', 'K', 'S']),
      method: z.enum(['meshy', 'flat']),
      kind: z.enum(['sheet', 'card', 'booklet', 'disc']).optional(),
      sizeMm: z.tuple([z.number().positive(), z.number().positive()]).nullable().optional(),
      printed: z.string().default(''),
      // Reserved for the yard sale extension. Nothing renders prices yet.
      listing: z
        .object({
          status: z.enum(['display', 'for-sale', 'sold', 'not-for-sale']).default('display'),
          price: z.number().nonnegative().nullable().default(null),
        })
        .default({ status: 'display', price: null }),
    })
    .refine((o) => o.method !== 'flat' || o.kind !== undefined, { message: 'flat objects need a kind', path: ['kind'] }),
});

// One Markdown file per object: src/content/stories/012.md. The file name is the object id.
const stories = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/stories' }),
  schema: z.object({
    found: z.object({ city: z.string(), year: z.string().optional(), price: z.string().optional() }).optional(),
    related: z.string().optional(),
    draft: z.boolean().default(true),
  }),
});

export const collections = { objects, stories };
