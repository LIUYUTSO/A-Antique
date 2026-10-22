'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';

// Arriving from the Landing's open transition, the right page has already faded in, so it must not do it twice.
// The Landing leaves a short-lived marker in sessionStorage; this reads and clears it.
export const ARRIVED_FROM_LANDING = 'aa-arrived-from-landing';

function arrivedFromLanding(): boolean {
  try {
    const at = Number(sessionStorage.getItem(ARRIVED_FROM_LANDING));
    sessionStorage.removeItem(ARRIVED_FROM_LANDING);
    return Number.isFinite(at) && Date.now() - at < 5000;
  } catch {
    return false;
  }
}

// Right-page blocks fade in and rise 14px, 60ms apart. gsap.from only runs after hydration,
// so the content is fully visible without JavaScript and under reduced motion.
// enabled=false is for the copy of the spread that sits under the Landing poster: the transition drives it.
export default function Entrance({ children, className, enabled = true }: { children: ReactNode; className?: string; enabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    if (arrivedFromLanding()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-enter]', { autoAlpha: 0, y: 14, duration: 0.5, ease: 'power3.out', stagger: 0.06, delay: 0.2 });
    }, root);
    return () => ctx.revert();
  }, [enabled]);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
