import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] content-center justify-items-start gap-3 p-6 md:p-10">
      <span>404 — No such object</span>
      <Link href="/shelf">← Index</Link>
    </main>
  );
}
