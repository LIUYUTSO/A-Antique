import Image from 'next/image';
import Link from 'next/link';
import { FEATURED_ID, getObject, getObjects, stillFor } from '@/lib/objects';

export default function Landing() {
  const featured = getObject(FEATURED_ID);
  if (!featured) throw new Error(`Featured object ${FEATURED_ID} is not in data/objects.json`);
  const still = stillFor(featured.id);
  const objects = getObjects();

  return (
    <main className="relative grid min-h-[100dvh] p-6 md:p-10">
      <div className="grid min-h-[calc(100dvh-3rem)] place-items-center bg-plate md:min-h-[calc(100dvh-5rem)]">
        {still && (
          <div className="relative aspect-square w-[min(70vw,62dvh)]">
            <Image src={still} alt={featured.name} fill priority sizes="70vw" className="object-contain" />
          </div>
        )}
      </div>
      <span className="absolute left-6 top-5">A-Antique</span>
      <Link href="/shelf" className="absolute right-6 top-5 text-right">
        Index — {objects.length} ↘
      </Link>
      <span className="absolute bottom-5 left-6">No. {featured.id}</span>
      <span className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap md:block">{featured.name}</span>
      <Link href={`/objects/${featured.id}`} className="absolute bottom-5 right-6 text-right">
        Open ↘
      </Link>
    </main>
  );
}
