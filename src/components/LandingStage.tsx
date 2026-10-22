'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import gsap from 'gsap';
import { ARRIVED_FROM_LANDING } from '@/components/Entrance';

type Props = {
  // The real spread of the featured object, rendered hidden underneath. The transition measures it for its end state.
  spread: ReactNode;
  id: string;
  name: string;
  still: string | null;
  count: number;
};

const OPEN_MS = 0.9;

// Landing poster. Open ↘ plays: the plate shrinks into the left page while the object travels and scales to
// its place, the gutter draws from the top (above the plate, below the object, as on the mood board), the right page blocks rise in. Then the route changes to the spread,
// which looks identical. Under reduced motion, or without JavaScript, Open is an ordinary link.
export default function LandingStage({ spread, id, name, still, count }: Props) {
  const router = useRouter();
  const under = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLDivElement>(null);
  const playing = useRef(false);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const href = `/objects/${id}`;

  useEffect(() => () => void tl.current?.kill(), []);

  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (playing.current) return e.preventDefault();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const layer = under.current;
    const post = poster.current;
    const toPlate = layer?.querySelector<HTMLElement>('[data-plate]');
    const fromPlate = post?.querySelector<HTMLElement>('[data-landing-plate]');
    if (!layer || !post || !toPlate || !fromPlate) return;

    e.preventDefault();
    playing.current = true;

    const toStill = layer.querySelector<HTMLElement>('[data-still]');
    const fromStill = post.querySelector<HTMLElement>('[data-landing-still]');
    const realGutter = layer.querySelector<HTMLElement>('[data-gutter]');
    const gutter = post.querySelector<HTMLElement>('[data-landing-gutter]');
    const blocks = layer.querySelectorAll('[data-enter]');
    const late = layer.querySelectorAll('[data-late]');
    const labels = post.querySelectorAll('[data-landing-label]');

    // Both layers are laid out, so their rectangles are real: the end state is measured, never guessed.
    const fp = fromPlate.getBoundingClientRect();
    const tp = toPlate.getBoundingClientRect();

    gsap.set(layer, { visibility: 'visible' });
    gsap.set([toPlate, toStill, realGutter].filter(Boolean), { opacity: 0 });
    gsap.set(fromPlate, { transformOrigin: '0 0' });

    const t = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: () => {
        gsap.set([toPlate, toStill, realGutter].filter(Boolean), { opacity: 1 });
        gsap.set(post, { autoAlpha: 0 });
        try {
          sessionStorage.setItem(ARRIVED_FROM_LANDING, String(Date.now()));
        } catch {
          /* the right page then fades in once more; harmless */
        }
        router.push(href);
      },
    });
    tl.current = t;

    t.to(labels, { autoAlpha: 0, duration: 0.3, ease: 'power3.out' }, 0)
      .to(
        fromPlate,
        { x: tp.left - fp.left, y: tp.top - fp.top, scaleX: tp.width / fp.width, scaleY: tp.height / fp.height, duration: OPEN_MS },
        0,
      );

    if (fromStill && toStill) {
      const fs = fromStill.getBoundingClientRect();
      const ts = toStill.getBoundingClientRect();
      t.to(
        fromStill,
        {
          x: ts.left + ts.width / 2 - (fs.left + fs.width / 2),
          y: ts.top + ts.height / 2 - (fs.top + fs.height / 2),
          scale: ts.width / fs.width,
          duration: OPEN_MS,
        },
        0,
      );
    }

    if (gutter) {
      t.fromTo(gutter, { opacity: 1, scaleY: 0, transformOrigin: 'top' }, { scaleY: 1, duration: OPEN_MS }, 0);
    }
    t.fromTo(late, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, 0.4).fromTo(
      blocks,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 },
      0.35,
    );
  };

  return (
    <div className="relative h-dvh overflow-hidden">
      <div ref={under} className="invisible">
        {spread}
      </div>

      <div ref={poster} className="absolute inset-0 p-6 md:p-10">
        <div data-landing-plate className="h-full w-full bg-plate" />
        <div data-landing-gutter aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 hidden w-px bg-ink opacity-0 md:block" />
        {still && (
          <div className="pointer-events-none absolute inset-6 grid place-items-center md:inset-10">
            <div data-landing-still className="relative aspect-square w-[min(70vw,62dvh)]">
              <Image src={still} alt={name} fill priority sizes="70vw" className="object-contain" />
            </div>
          </div>
        )}
        <span data-landing-label className="absolute left-6 top-5">
          A-Antique
        </span>
        <Link data-landing-label href="/shelf" className="absolute right-6 top-5 text-right">
          Index — {count} ↘
        </Link>
        <span data-landing-label className="absolute bottom-5 left-6">
          No. {id}
        </span>
        <span data-landing-label className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap md:block">
          {name}
        </span>
        <Link data-landing-label href={href} onClick={open} className="absolute bottom-5 right-6 text-right">
          Open ↘
        </Link>
      </div>
    </div>
  );
}
