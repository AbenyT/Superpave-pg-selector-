import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AnalysePage } from '@/components/AnalysePage';

export const metadata: Metadata = { title: 'Analysis' };

export default function Page() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-muted">Loading…</div>}>
      <AnalysePage />
    </Suspense>
  );
}
