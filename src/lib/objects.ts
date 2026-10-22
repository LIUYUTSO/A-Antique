import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const FEATURED_ID = '012';

export const GROUPS: Record<string, string> = {
  P: 'Paper',
  T: 'Figures and toys',
  M: 'Metal and tools',
  K: 'Photography',
  S: 'Pins and small things',
};

// data/objects.json is shared with the Meshy and flat pipelines, so it stays the single source.
// A bad entry fails the build instead of shipping a broken page.
const ObjectSchema = z
  .object({
    id: z.string().regex(/^\d{3}$/, 'id is three digits, e.g. 012'),
    name: z.string().min(1),
    group: z.enum(['P', 'T', 'M', 'K', 'S']),
    method: z.enum(['meshy', 'flat']),
    kind: z.enum(['sheet', 'card', 'booklet', 'disc']).optional(),
    sizeMm: z.tuple([z.number().positive(), z.number().positive()]).nullable().optional(),
    printed: z.string().default(''),
    // Original ids folded into this object when a set was merged into one entry.
    aliases: z.array(z.string().regex(/^\d{3}$/)).default([]),
    // Reserved for the yard sale extension. Nothing renders prices yet.
    listing: z
      .object({
        status: z.enum(['display', 'for-sale', 'sold', 'not-for-sale']).default('display'),
        price: z.number().nonnegative().nullable().default(null),
      })
      .default({ status: 'display', price: null }),
  })
  .refine((o) => o.method !== 'flat' || o.kind !== undefined, { message: 'flat objects need a kind', path: ['kind'] });

const FileSchema = z.object({ objects: z.array(ObjectSchema).min(1) }).refine(
  (f) => new Set(f.objects.map((o) => o.id)).size === f.objects.length,
  { message: 'object ids must be unique' },
);

export type ObjectEntry = z.infer<typeof ObjectSchema>;

let cache: ObjectEntry[] | null = null;
export function getObjects(): ObjectEntry[] {
  if (!cache) {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'data', 'objects.json'), 'utf8'));
    cache = FileSchema.parse(raw).objects.sort((a, b) => a.id.localeCompare(b.id));
  }
  return cache;
}

export function getObject(id: string): ObjectEntry | undefined {
  return getObjects().find((o) => o.id === id);
}

// A still is public/objects/<id>/still.(png|jpg|webp). Missing stills render an empty plate.
export function stillFor(id: string): string | null {
  const dir = join(process.cwd(), 'public', 'objects', id);
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => /^still\.(png|jpe?g|webp)$/i.test(f));
  return file ? `/objects/${id}/${file}` : null;
}

// A model is public/models/<id>.glb: metres, Y up, origin at the base centre, front toward +Z, Draco-compressed.
// A missing file means the spread simply has no 3D view.
export function modelFor(id: string): string | null {
  return existsSync(join(process.cwd(), 'public', 'models', `${id}.glb`)) ? `/models/${id}.glb` : null;
}

// One Markdown file per object: content/stories/<id>.md. The file name is the object id.
const StorySchema = z.object({
  found: z.object({ city: z.string(), year: z.string().optional(), price: z.string().optional() }).optional(),
  related: z.string().optional(),
  draft: z.boolean().default(true),
});

export function getStory(id: string) {
  const file = join(process.cwd(), 'content', 'stories', `${id}.md`);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = m ? parseYaml(m[1]) ?? {} : {};
  return { data: StorySchema.parse(data), body: (m ? m[2] : text).trim() };
}
