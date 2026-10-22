'use client';

import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';

// The viewer and three.js load only when the 3D view is asked for, so the still stays the fast first paint.
const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false });

export default function SpreadPlate({ still, modelSrc, label }: { still: ReactNode; modelSrc: string | null; label: string }) {
  const [view, setView] = useState<'still' | 'model'>('still');
  const showModel = modelSrc !== null && view === 'model';

  return (
    <div className="relative grid min-h-[60dvh] place-items-center bg-plate">
      {showModel ? <ModelViewer src={modelSrc} label={label} /> : still}
      {modelSrc && (
        <button
          type="button"
          aria-pressed={showModel}
          onClick={() => setView(showModel ? 'still' : 'model')}
          className="absolute bottom-3 left-3 cursor-pointer hover:underline"
        >
          {showModel ? '[Still]' : '[3D]'}
        </button>
      )}
    </div>
  );
}
