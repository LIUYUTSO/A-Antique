import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Entrance from '@/components/Entrance';
import SpreadPlate from '@/components/SpreadPlate';
import { getObject, getObjects, getStory, modelFor, stillFor } from '@/lib/objects';

// One spread. The Spread route renders it, and so does the Landing underneath its poster, so the end of the
// open transition is this same markup and cannot drift from it. data-* marks what the transition measures or fades.
export default function SpreadView({ id, entrance = true }: { id: string; entrance?: boolean }) {
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
      <div data-gutter aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 hidden w-px bg-ink md:block" />

      <section aria-label="Object" className="grid grid-rows-[1fr_auto] gap-3.5 p-6 md:p-10">
        <SpreadPlate
          label={o.name}
          modelSrc={model}
          still={
            still ? (
              <div data-still className="relative aspect-square w-[min(70%,420px)]">
                <Image src={still} alt={o.name} fill priority sizes="(min-width: 768px) 30vw, 70vw" className="object-contain" />
              </div>
            ) : (
              <span className="opacity-60">No photo yet</span>
            )
          }
        />
        <div data-late className="grid text-[11px] md:hidden">
          <span>Fig. {o.id} — Top-down</span>
          <span>{String(n * 2).padStart(3, '0')}</span>
        </div>
      </section>

      <Entrance enabled={entrance} className="relative flex min-h-[100dvh] flex-col gap-5 p-6 pb-16 md:items-center md:p-10 md:pb-16">
        <Link href="/shelf" data-enter className="md:sr-only md:focus:not-sr-only md:focus:absolute md:focus:left-10 md:focus:top-10">
          ← Index
        </Link>
        <div data-enter className="self-end text-xl font-normal leading-none md:hidden">
          {o.id}.
        </div>
        <h1 data-enter className="text-base font-normal leading-snug md:pt-[52px] md:text-center">
          {o.name}
        </h1>
        <div data-enter className="normal-case leading-[1.75] tracking-[0.03em] md:mx-[60px] md:mt-[33px] md:tracking-[0.36px] [&_p]:mb-4">
          {story ? <ReactMarkdown>{story.body}</ReactMarkdown> : <p>[Story to be written.]</p>}
          {story?.data.draft && <p className="font-normal">[Draft]</p>}
        </div>
        {story?.data.related && (
          <div data-enter className="normal-case leading-[1.75] tracking-[0.03em] md:w-[385px] [&_p]:mb-4">
            <div className="mb-1 font-normal">Related story — {story.data.related}</div>
            <p>[Second paragraph.]</p>
          </div>
        )}
        <dl data-enter className="mt-auto grid grid-cols-[14ch_minmax(0,1fr)] gap-x-3.5 gap-y-0.5 md:grid-cols-[82px_178px] md:gap-x-1 md:gap-y-0 md:text-[6px] md:leading-[8px] md:[&>dt]:text-right">
          <dt className="italic">Item:</dt>
          <dd className="break-words">{o.name}</dd>
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
        <nav data-enter className="flex justify-between gap-3 pr-14 md:justify-center md:gap-[34px] md:pr-0">
          {prev ? <Link href={`/objects/${prev.id}`}>←<span className="md:sr-only"> {prev.id}</span></Link> : <span />}
          {next ? <Link href={`/objects/${next.id}`}><span className="md:sr-only">{next.id} </span>→</Link> : <span />}
        </nav>
        <span data-late className="absolute bottom-5 right-6 text-[11px] md:hidden">
          {String(n * 2 + 1).padStart(3, '0')}
        </span>
      </Entrance>
    </main>
  );
}
