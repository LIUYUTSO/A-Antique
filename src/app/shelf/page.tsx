import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getObjects, stillFor } from '@/lib/objects';

export const metadata: Metadata = { title: 'Index — A-Antique', description: 'Every object on one sheet.' };

export default function Shelf() {
  const objects = getObjects();
  return (
    <main className="grid min-h-[100dvh] content-start gap-6 p-6 md:p-10">
      <header className="flex flex-wrap justify-between gap-3">
        <Link href="/">← A-Antique</Link>
        <span>Index — {objects.length} objects</span>
      </header>
      <ol className="grid grid-cols-5 gap-1.5 md:grid-cols-7 xl:grid-cols-13">
        {objects.map((o) => {
          const still = stillFor(o.id);
          return (
            <li key={o.id}>
              <Link
                href={`/objects/${o.id}`}
                aria-label={`${o.id} ${o.name}`}
                className="group relative grid aspect-square place-items-center bg-plate text-[11px] tracking-[0.04em] hover:bg-ink hover:text-paper hover:no-underline"
              >
                <span className="absolute left-[5px] top-1">{o.id}</span>
                {still && (
                  <span className="relative mt-3 block h-[64%] w-[72%]">
                    <Image src={still} alt="" fill sizes="10vw" className="object-contain" />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] italic">One tile per object. Tiles fill in as each object is photographed.</p>
    </main>
  );
}
