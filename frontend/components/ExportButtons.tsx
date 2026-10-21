'use client';
import { useState } from 'react';
import { reportImages } from '@/lib/report-charts';
import type { ReportInput } from '@/lib/report';
import { Download, FileIcon } from './icons';

const button =
  'inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-raised disabled:opacity-50';

/** "PDF report" and "Excel" downloads. The libraries load only when a button is pressed. */
export function ExportButtons({ report }: { report: ReportInput }) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'pdf' | 'xlsx') {
    setBusy(kind);
    setError(null);
    try {
      const images = reportImages(report);
      if (kind === 'pdf') {
        const { downloadPdf } = await import('@/lib/export-pdf');
        await downloadPdf(report, images);
      } else {
        const { downloadExcel } = await import('@/lib/export-excel');
        await downloadExcel(report, images);
      }
    } catch {
      setError(kind === 'pdf' ? 'The PDF could not be made. Please try again.' : 'The Excel file could not be made. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={button} disabled={busy !== null} onClick={() => run('pdf')}>
        <FileIcon size={16} /> {busy === 'pdf' ? 'Making PDF…' : 'PDF report'}
      </button>
      <button type="button" className={button} disabled={busy !== null} onClick={() => run('xlsx')}>
        <Download size={16} /> {busy === 'xlsx' ? 'Making Excel…' : 'Excel'}
      </button>
      {error && <span className="text-sm text-bad">{error}</span>}
    </span>
  );
}

export function PngButton({ onClick, label = 'PNG' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} title="Download the graph as a PNG picture"
      className="print-hidden inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-raised hover:text-ink">
      <Download size={15} /> {label}
    </button>
  );
}
