import type { Metadata } from 'next';
import SpreadView from '@/components/SpreadView';
import { getObject, getObjects } from '@/lib/objects';

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
  return <SpreadView id={id} />;
}
