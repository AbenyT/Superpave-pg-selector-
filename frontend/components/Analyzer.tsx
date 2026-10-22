'use client';
/**
 * The page: inputs → results. The engine runs in the browser so results show at once; the API re-reads the
 * file, saves the analysis under the signed-in account and gives it a link (?a=<id>). Changing ESAL, speed,
 * latitude or the "consider" choice recalculates instantly from the yearly results already loaded, and the
 * owner's saved copy is updated. Anyone else opening the link sees it read-only (changes are not saved).
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalysisError, analyseClimate, computeGrade, validateDesignInputs, type DesignInputs, type GradeResult } from '@pg/engine';
import { MAX_FILE_BYTES, readTemperatureFile, type StationInfo } from '@pg/parser';
import { ApiError, createAnalysis, getAnalysis, updateAnalysis, wakeApi, type ClimateView } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSlow, WAKING_UP } from '@/lib/use-slow';
import { parseNumber } from '@/lib/format';
import { downloadCanvas } from '@/lib/chart-canvas';
import type { ReportInput } from '@/lib/report';
import { annualMinCanvas, heatmapCanvas, sevenDayCanvas } from '@/lib/report-charts';
import { BinderSection } from './BinderSection';
import { ExportButtons } from './ExportButtons';
import { GradeSection, ResultHero } from './GradeSection';
import { HeatmapSection } from './HeatmapSection';
import { Alert, Check, Cloud } from './icons';
import { InputPanel, type FormErrors, type FormState, type LoadedFile } from './InputPanel';
import { AnnualMinSection, SevenDaySection } from './YearSections';

interface Loaded {
  climate: ClimateView;
  station: StationInfo;
  fileName: string;
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; id: string; ownerId: string | null }
  | { kind: 'failed'; message: string };

const EMPTY_FORM: FormState = { projectName: '', stationName: '', latitude: '', esal: '', speed: '', acceptConsider: false };

function readInputs(form: FormState): { inputs: DesignInputs | null; errors: FormErrors } {
  const errors: FormErrors = {};
  if (!form.projectName.trim()) errors.projectName = 'Enter a project name.';
  const latitude = parseNumber(form.latitude);
  const esal = parseNumber(form.esal);
  const speed = parseNumber(form.speed);
  const inputs: DesignInputs = {
    latitude: latitude ?? NaN,
    designEsalMillions: esal ?? NaN,
    designSpeedKmh: speed ?? NaN,
    acceptConsiderBump: form.acceptConsider,
  };
  for (const p of validateDesignInputs(inputs)) {
    if (p.field === 'latitude') errors.latitude = form.latitude.trim() ? p.message : 'Enter the latitude of the station.';
    if (p.field === 'designEsalMillions') errors.esal = p.message;
    if (p.field === 'designSpeedKmh') errors.speed = p.message;
  }
  return { inputs: errors.latitude || errors.esal || errors.speed ? null : inputs, errors };
}

function periodOf(climate: ClimateView): string {
  const years = climate.monthly.tmax.map((c) => c.year);
  return years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '';
}

export function Analyzer({ onSaved }: { onSaved?: (id: string) => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const lastGrade = useRef<GradeResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { inputs, errors } = useMemo(() => readInputs(form), [form]);

  // Recalculate instantly whenever the inputs change; keep the last good result while an input is invalid.
  const grade = useMemo(() => {
    if (!loaded || !inputs) return lastGrade.current;
    try {
      return computeGrade(loaded.climate, inputs);
    } catch {
      return lastGrade.current;
    }
  }, [loaded, inputs]);
  useEffect(() => {
    lastGrade.current = grade;
  }, [grade]);

  // Wake the API and reopen a saved analysis from ?a=<id>.
  useEffect(() => {
    wakeApi();
    const id = new URLSearchParams(window.location.search).get('a');
    if (!id) return;
    setBusy(true);
    getAnalysis(id)
      .then((view) => {
        setForm({
          projectName: view.projectName,
          stationName: view.stationName ?? '',
          latitude: String(view.inputs.latitude),
          esal: String(view.inputs.designEsalMillions),
          speed: String(view.inputs.designSpeedKmh),
          acceptConsider: view.inputs.acceptConsiderBump,
        });
        setLoaded({ climate: view.climate, station: view.station, fileName: view.file.name });
        setSave({ kind: 'saved', id: view.id, ownerId: view.ownerId });
      })
      .catch((e: unknown) => setMessage(e instanceof ApiError ? e.message : 'This analysis could not be opened.'))
      .finally(() => setBusy(false));
  }, []);

  // Keep the owner's saved copy in step with the inputs (after a short pause in typing).
  const isOwner = save.kind === 'saved' && save.ownerId !== null && save.ownerId === user?.id;
  const savedId = save.kind === 'saved' && isOwner ? save.id : null;
  useEffect(() => {
    if (!savedId || !inputs || errors.projectName) return;
    const timer = setTimeout(() => {
      updateAnalysis(savedId, {
        projectName: form.projectName.trim(),
        stationName: form.stationName.trim(),
        latitude: inputs.latitude,
        designEsalMillions: inputs.designEsalMillions,
        designSpeedKmh: inputs.designSpeedKmh,
        acceptConsiderBump: form.acceptConsider,
      }).catch(() => undefined);
    }, 900);
    return () => clearTimeout(timer);
  }, [savedId, inputs, errors.projectName, form.projectName, form.stationName, form.acceptConsider]);

  const onChange = useCallback((patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })), []);

  const onFile = useCallback(async (f: File) => {
    setMessage(null);
    if (f.size > MAX_FILE_BYTES) {
      setMessage('The file is larger than 10 MB. Upload one station at a time.');
      return;
    }
    try {
      const parsed = readTemperatureFile(new Uint8Array(await f.arrayBuffer()), f.name);
      setFile({ file: f, parsed });
      setForm((current) => ({
        ...current,
        stationName: current.stationName || parsed.station.name || '',
        latitude: current.latitude || (parsed.station.latitude !== null ? String(parsed.station.latitude) : ''),
      }));
    } catch (e) {
      setFile(null);
      setMessage(e instanceof AnalysisError ? e.message : 'The file could not be read. Upload a CSV or Excel file.');
    }
  }, []);

  const saveToServer = useCallback(async (loadedFile: LoadedFile, current: FormState, values: DesignInputs) => {
    setSave({ kind: 'saving' });
    try {
      const view = await createAnalysis(loadedFile.file, {
        projectName: current.projectName.trim(),
        stationName: current.stationName.trim(),
        latitude: values.latitude,
        designEsalMillions: values.designEsalMillions,
        designSpeedKmh: values.designSpeedKmh,
        acceptConsiderBump: current.acceptConsider,
      });
      setSave({ kind: 'saved', id: view.id, ownerId: view.ownerId });
      onSaved?.(view.id);
      window.history.replaceState(null, '', `?a=${view.id}`);
    } catch (e) {
      setSave({ kind: 'failed', message: e instanceof ApiError ? e.message : 'Not saved.' });
    }
  }, [onSaved]);

  const onAnalyse = useCallback(() => {
    setShowErrors(true);
    setMessage(null);
    if (!file) {
      setMessage('Upload a temperature file (CSV or Excel).');
      return;
    }
    if (!inputs || errors.projectName) return;
    setBusy(true);
    try {
      const climate = analyseClimate(file.parsed.observations);
      setLoaded({ climate, station: file.parsed.station, fileName: file.file.name });
      void saveToServer(file, form, inputs);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setLoaded(null);
      setMessage(e instanceof AnalysisError ? e.message : 'Something went wrong. Please check the file and try again.');
    } finally {
      setBusy(false);
    }
  }, [file, inputs, errors.projectName, form, saveToServer]);

  const latitude = inputs?.latitude ?? parseNumber(form.latitude) ?? 0;
  const report: ReportInput | null =
    loaded && grade
      ? {
          projectName: form.projectName.trim() || 'Project',
          stationName: form.stationName.trim() || loaded.station.name || '',
          latitude,
          fileName: loaded.fileName,
          period: periodOf(loaded.climate),
          esal: inputs?.designEsalMillions ?? NaN,
          speed: inputs?.designSpeedKmh ?? NaN,
          climate: loaded.climate,
          grade,
          link: save.kind === 'saved' ? window.location.href : undefined,
        }
      : null;
  const pngName = (part: string) => `${(report?.projectName ?? 'project').replace(/[^\p{L}\p{N}]+/gu, '_')}_${part}.png`;

  return (
    <div className="space-y-6">
      <InputPanel form={form} errors={showErrors ? errors : {}} loaded={file} busy={busy} onChange={onChange} onFile={onFile}
        onAnalyse={onAnalyse} />

      {message && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad-soft px-5 py-4 text-bad">
          <Alert className="mt-0.5 shrink-0" />
          <p className="text-[15px] font-medium">{message}</p>
        </div>
      )}

      {loaded && grade && (
        <div ref={resultsRef} className="scroll-mt-4 space-y-6">
          <div className="print-hidden flex flex-wrap items-center justify-between gap-2 text-sm">
            <nav className="flex flex-wrap gap-1" aria-label="Results">
              {[
                ['#seven-day', '7-day maximum'],
                ['#annual-min', 'Annual minimum'],
                ['#heatmaps', 'Heatmaps'],
                ['#grade', 'PG grade & specification'],
                ['#binder', 'Binder type & tests'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="rounded-full px-3 py-1.5 text-muted transition hover:bg-surface hover:text-ink">{label}</a>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              {report && <ExportButtons report={report} />}
              <SaveBadge save={save} isOwner={isOwner} onRetry={() => file && inputs && saveToServer(file, form, inputs)} />
            </div>
          </div>
          <ResultHero grade={grade} projectName={form.projectName.trim() || '—'}
            stationName={form.stationName.trim() || loaded.station.name || ''} latitude={latitude}
            period={periodOf(loaded.climate)} />
          <SevenDaySection climate={loaded.climate} grade={grade}
            onPng={() => report && downloadCanvas(sevenDayCanvas(report), pngName('7day_maximum'))} />
          <AnnualMinSection climate={loaded.climate} grade={grade}
            onPng={() => report && downloadCanvas(annualMinCanvas(report), pngName('annual_minimum'))} />
          <HeatmapSection climate={loaded.climate}
            onPng={(el) => downloadCanvas(heatmapCanvas(loaded.climate, el), pngName(el === 'tmax' ? 'heatmap_Tmax' : 'heatmap_Tmin'))} />
          <GradeSection grade={grade} latitude={latitude} esal={inputs?.designEsalMillions ?? NaN} speed={inputs?.designSpeedKmh ?? NaN}
            onConsider={(v) => onChange({ acceptConsider: v })} />
          <BinderSection grade={grade} />
        </div>
      )}
    </div>
  );
}

function SaveBadge({ save, isOwner, onRetry }: { save: SaveState; isOwner: boolean; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const slow = useSlow(save.kind === 'saving');
  if (save.kind === 'idle') return null;
  if (save.kind === 'saving') {
    return <span className="inline-flex items-center gap-1.5 text-muted"><Cloud size={16} /> {slow ? WAKING_UP : 'Saving…'}</span>;
  }
  if (save.kind === 'failed') {
    return (
      <span className="inline-flex items-center gap-2 text-warn">
        <Alert size={16} /> Not saved: {save.message}
        {save.message.startsWith('Please log in')
          ? <Link href="/login?next=/analyse" className="rounded-md border border-line px-2 py-0.5 text-ink hover:bg-raised">Log in</Link>
          : <button type="button" onClick={onRetry} className="rounded-md border border-line px-2 py-0.5 text-ink hover:bg-raised">Retry</button>}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 ${isOwner ? 'text-ok' : 'text-muted'}`}>
      {isOwner ? <><Check size={16} /> Saved</> : <span title="Changes you make here are not saved">Shared view (read-only)</span>}
      <button type="button" className="rounded-md border border-line px-2 py-0.5 text-ink hover:bg-raised"
        onClick={() => {
          void navigator.clipboard?.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </span>
  );
}
