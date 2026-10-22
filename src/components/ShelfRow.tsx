'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// The Index is one row that moves sideways. A mouse wheel turns into horizontal scroll while the row can still move
// that way, so the page never needs a vertical scrollbar. Trackpads, touch and the keyboard scroll it natively.
// data-lenis-prevent keeps the page smoother out of the way.
export default function ShelfRow({ children, label }: { children: ReactNode; label: string }) {
  const row = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      const movingForward = e.deltaY > 0;
      if ((movingForward && el.scrollLeft >= max) || (!movingForward && el.scrollLeft <= 0)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <ol ref={row} data-lenis-prevent aria-label={label} className="shelf-row flex gap-1.5 overflow-x-auto pb-3">
      {children}
    </ol>
  );
}
