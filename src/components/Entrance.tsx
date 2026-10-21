'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';

// Right-page blocks fade in and rise 14px, 60ms apart. gsap.from only runs after hydration,
// so the content is fully visible without JavaScript and under reduced motion.
export default function Entrance({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-enter]', { autoAlpha: 0, y: 14, duration: 0.5, ease: 'power3.out', stagger: 0.06, delay: 0.2 });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
