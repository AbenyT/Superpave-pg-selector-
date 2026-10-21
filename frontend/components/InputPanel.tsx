'use client';
import { useRef, useState } from 'react';
import { ACCEPTED_EXTENSIONS, templateWorkbook, type ParsedDataset } from '@pg/parser';
import { Check, Download, FileIcon, Upload } from './icons';
import { Card, Field, Pill, inputClass } from './ui';

export interface FormState {
  projectName: string;
  stationName: string;
  latitude: string;
  esal: string;
  speed: string;
  acceptConsider: boolean;
}

export type FormErrors = Partial<Record<'projectName' | 'latitude' | 'esal' | 'speed', string>>;

export interface LoadedFile {
  file: File;
  parsed: ParsedDataset;
}

function downloadTemplate() {
  const blob = new Blob([templateWorkbook() as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PG_temperature_template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

function fileSummary(p: ParsedDataset): string {
  const years = p.observations.map((o) => o.year).filter((y) => y >= 1800 && y <= 2200);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return `${first}–${last} · ${p.observations.length.toLocaleString()} values`;
}

export function InputPanel({
  form,
  errors,
  loaded,
  busy,
  onChange,
  onFile,
  onAnalyse,
}: {
  form: FormState;
  errors: FormErrors;
  loaded: LoadedFile | null;
  busy: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onFile: (file: File) => void;
  onAnalyse: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <Card className="print-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Project inputs</h1>
          <p className="text-sm text-muted">Upload daily temperature data. The PG grade and its specification appear below.</p>
        </div>
        <Pill tone="ok">Reliability 98%</Pill>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" error={errors.projectName}>
            <input className={inputClass} value={form.projectName} onChange={(e) => onChange({ projectName: e.target.value })}
              placeholder="e.g. Meisso – Dire Dawa road" />
          </Field>
          <Field label="Station name" hint="Taken from the file if left empty">
            <input className={inputClass} value={form.stationName} onChange={(e) => onChange({ stationName: e.target.value })}
              placeholder={loaded?.parsed.station.name ?? 'e.g. Meiso Mission'} />
          </Field>
          <Field label="Latitude (°)" error={errors.latitude} hint="North positive. Filled in from the file when it has one.">
            <input className={inputClass} inputMode="decimal" value={form.latitude} onChange={(e) => onChange({ latitude: e.target.value })}
              placeholder="e.g. 9.23" />
          </Field>
          <Field label="Design ESAL (million)" error={errors.esal}>
            <input className={inputClass} inputMode="decimal" value={form.esal} onChange={(e) => onChange({ esal: e.target.value })}
              placeholder="e.g. 115.6" />
          </Field>
          <Field label="Design speed (km/h)" error={errors.speed}>
            <input className={inputClass} inputMode="decimal" value={form.speed} onChange={(e) => onChange({ speed: e.target.value })}
              placeholder="e.g. 100" />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
            className={`flex min-h-36 flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
              dragging ? 'border-lo bg-lo-soft' : 'border-line-strong hover:border-lo hover:bg-raised'
            }`}
          >
            {loaded ? (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ok-soft text-ok"><Check /></span>
                <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold"><FileIcon size={16} />{loaded.file.name}</div>
                <div className="num text-xs text-muted">
                  {loaded.parsed.station.name ? `${loaded.parsed.station.name} · ` : ''}{fileSummary(loaded.parsed)}
                </div>
                <div className="mt-1 text-xs text-lo">Click or drop another file to replace it</div>
              </>
            ) : (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-lo-soft text-lo"><Upload /></span>
                <div className="mt-2 text-sm font-semibold">Drop your daily temperature file here</div>
                <div className="text-xs text-muted">or click to choose · CSV or Excel · Tmax and Tmin, any common layout</div>
              </>
            )}
            <input ref={inputRef} type="file" className="hidden" accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-medium transition hover:bg-raised">
              <Download size={16} /> Download template
            </button>
            <button type="button" onClick={onAnalyse} disabled={busy}
              className="ml-auto inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-50">
              {busy ? 'Analysing…' : 'Analyse'}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
