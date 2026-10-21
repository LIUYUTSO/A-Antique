import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const FEATURED_ID = '012';

export const GROUPS: Record<string, string> = {
  P: 'Paper',
  T: 'Figures and toys',
  M: 'Metal and tools',
  K: 'Photography',
  S: 'Pins and small things',
};

// A still is public/objects/<id>/still.(png|jpg|webp). Missing stills render an empty plate.
export function stillFor(id: string): string | null {
  const dir = join(process.cwd(), 'public', 'objects', id);
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => /^still\.(png|jpe?g|webp)$/i.test(f));
  return file ? `/objects/${id}/${file}` : null;
}
