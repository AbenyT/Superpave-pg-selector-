'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { RequireAuth } from '@/lib/auth';
import { Analyzer } from './Analyzer';

/**
 * /analyse            → a new analysis (needs an account)
 * /analyse?a=<id>     → a saved one (anyone with the link may look; only the owner's changes are saved)
 *
 * The analyser starts afresh whenever the link changes to another analysis, but not when it is the
 * analysis this page has just saved (the address is updated to its link).
 */
export function AnalysePage() {
  const id = useSearchParams().get('a');
  const [view, setView] = useState({ id, key: 0, savedHere: null as string | null });
  if (id !== view.id) {
    setView({ id, key: id !== null && id === view.savedHere ? view.key : view.key + 1, savedHere: view.savedHere });
  }
  const analyzer = <Analyzer key={view.key} onSaved={(saved) => setView((v) => ({ ...v, savedHere: saved }))} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="display text-2xl text-ink sm:text-3xl">{id ? 'Binder analysis' : 'New binder analysis'}</h1>
        <p className="mt-1 text-sm text-muted">
          Upload daily maximum and minimum temperatures, enter the traffic, and get the Superpave PG grade.
        </p>
      </div>
      {id ? analyzer : <RequireAuth>{analyzer}</RequireAuth>}
    </div>
  );
}
