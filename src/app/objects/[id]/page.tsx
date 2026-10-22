import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Entrance from '@/components/Entrance';
import SpreadPlate from '@/components/SpreadPlate';
import { GROUPS, getObject, getObjects, getStory, modelFor, stillFor } from '@/lib/objects';

type Params = { id: string };

// Every object is rendered at build time. An id that is not in data/objects.json is a 404.
export const dynamicParams = false;
export function generateStaticParams(): Params[] {
  return getObjects().map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const o = getObject(id);
  return o ? { title: `${o.id} ${o.name} — A-Antique`, description: o.name } : {};
}

export default async function Spread({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const o = getObject(id);
  if (!o) notFound();

  const all = getObjects();
  const i = all.findIndex((x) => x.id === o.id);
  const prev = all[i - 1];
  const next = all[i + 1];
  const still = stillFor(o.id);
  const model = modelFor(o.id);
  const story = getStory(o.id);
  const n = Number(o.id);
  const dims = o.sizeMm ? `${o.sizeMm[0]} × ${o.sizeMm[1]} mm` : '[W × H mm — to measure]';
  const found = story?.data.found
    ? [story.data.found.city, story.data.found.year, story.data.found.price].filter(Boolean).join(', ')
    : '[City, year]';

  return (
    <main className="grid min-h-[100dvh] grid-cols-1 md:grid-cols-2">
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 hidden w-px bg-ink md:block" />

      <section aria-label="Object" className="grid grid-rows-[1fr_auto] gap-3.5 p-6 md:p-10">
        <SpreadPlate
          label={o.name}
          modelSrc={model}
          still={
            still ? (
              <div className="relative aspect-square w-[min(70%,420px)]">
                <Image src={still} alt={o.name} fill priority sizes="(min-width: 768px) 30vw, 70vw" className="object-contain" />
              </div>
            ) : (
              <span className="opacity-60">No photo yet</span>
            )
          }
        />
        <div className="grid text-[11px]">
          <span>Fig. {o.id} — Top-down</span>
          <span>{String(n * 2).padStart(3, '0')}</span>
        </div>
      </section>

      <Entrance className="relative flex min-h-[100dvh] flex-col gap-5 p-6 pb-16 md:p-10 md:pb-16">
        <Link href="/shelf" data-enter>
          ← Index
        </Link>
        <div data-enter className="self-end text-xl font-normal leading-none">
          {o.id}.
        </div>
        <h1 data-enter className="text-base font-normal leading-snug">
          {o.name}
        </h1>
        <div data-enter className="normal-case tracking-[0.03em] [&_p]:mb-4">
          {story ? <ReactMarkdown>{story.body}</ReactMarkdown> : <p>[Story to be written.]</p>}
          {story?.data.draft && <p className="font-normal">[Draft]</p>}
          {story?.data.related && (
            <>
              <div className="mb-1 font-normal">Related story — {story.data.related}</div>
              <p>[Second paragraph.]</p>
            </>
          )}
        </div>
        <dl data-enter className="mt-auto grid grid-cols-[14ch_minmax(0,1fr)] gap-x-3.5 gap-y-0.5">
          <dt className="italic">Item:</dt>
          <dd className="break-words">{o.name}</dd>
          <dt className="italic">Group:</dt>
          <dd>{GROUPS[o.group]}</dd>
          {o.printed && (
            <>
              <dt className="italic">Printed:</dt>
              <dd className="break-words">{o.printed}</dd>
            </>
          )}
          <dt className="italic">Dimensions:</dt>
          <dd>{dims}</dd>
          <dt className="italic">Found:</dt>
          <dd>{found}</dd>
        </dl>
        <nav data-enter className="flex justify-between gap-3 pr-14">
          {prev ? <Link href={`/objects/${prev.id}`}>← {prev.id}</Link> : <span />}
          {next ? <Link href={`/objects/${next.id}`}>{next.id} →</Link> : <span />}
        </nav>
        <span className="absolute bottom-5 right-6 text-[11px] md:right-10">{String(n * 2 + 1).padStart(3, '0')}</span>
      </Entrance>
    </main>
  );
}
