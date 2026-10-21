import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StaticImageData } from 'next/image';
import { ArrowRight, Broom, Chart, Download, FileIcon, Flask, Grid, Layers, LinkedIn, LinkIcon, Mail, Snow, Table, Thermo, Truck, Upload } from '@/components/icons';
import { HeroAccount, OldLinkRedirect } from '@/components/landing/HeroAccount';
import { HeroSlides, type Slide } from '@/components/landing/HeroSlides';
import { Squares } from '@/components/Squares';
import { mailto, SITE } from '@/lib/site';
import roller from '@/public/landing/asphalt-roller.jpg';
import binderDrums from '@/public/landing/binder-drums.jpg';
import drumsYard from '@/public/landing/bitumen-drums-yard.jpg';
import pellets from '@/public/landing/bitumen-pellets.jpg';
import openDrums from '@/public/landing/open-bitumen-drums.jpg';
import paverAndRoller from '@/public/landing/paver-and-roller.jpg';
import paverScreed from '@/public/landing/paver-screed.webp';
import pavingTrain from '@/public/landing/paving-train.jpg';

// Each photo is used once: the paving photos in the hero, the binder photos in "From the binder drum…".
const HERO_SLIDES: Slide[] = [
  { image: paverAndRoller, alt: 'A paver laying asphalt with a roller compacting behind it', caption: 'Paving and compaction' },
  { image: pavingTrain, alt: 'Several pavers working side by side on a wide carriageway', caption: 'Paving in echelon' },
  { image: paverScreed, alt: 'Crew checking the screed of an asphalt paver', caption: 'Screed control' },
  { image: roller, alt: 'A tandem roller compacting fresh asphalt on a new road', caption: 'Final rolling' },
];

/** Landing page. Every number on it is either a fixed rule of the method or clearly marked as an example. */
export default function Home() {
  return (
    <>
      <OldLinkRedirect />
      <Hero />
      <Facts />
      <Features />
      <Workflow />
      <Benefits />
      <Field />
      <ClosingBanner />
    </>
  );
}

// ---- 1. Hero ---------------------------------------------------------------------------------------------

const CHIPS = [
  [Thermo, 'SHRP'],
  [Snow, 'LTPP'],
  [Layers, 'M320'],
  [Truck, 'M323'],
  [FileIcon, 'PDF'],
  [Table, 'Excel'],
] as const;

function Hero() {
  return (
    <section className="hero-glow relative overflow-hidden">
      <Squares items={[{ className: 'hidden lg:block left-[47%] top-10 h-5 w-5 bg-accent-blue' }, { className: 'left-[3%] bottom-10 h-4 w-4 bg-accent-purple' }]} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pb-24 lg:pt-20">
        <div>
          <h1 className="display text-4xl leading-[1.12] text-ink sm:text-5xl lg:text-[2.6rem] xl:text-5xl">
            Read the climate.<br />Pick the binder.<br />Pave with confidence.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Upload daily temperatures from any weather station and get the Superpave PG grade, the AASHTO M320
            specification table and a full report, in seconds.
          </p>
          <div className="mt-8 max-w-sm"><HeroAccount /></div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <HeroSlides slides={HERO_SLIDES} />
          <ul className="relative mx-auto -mt-7 grid w-fit grid-cols-3 gap-2 px-2 sm:-mt-8">
            {CHIPS.map(([Icon, label]) => (
              <li key={label} className="inline-flex items-center justify-between gap-2 rounded-full bg-primary py-1.5 pl-3.5 pr-1.5 text-sm font-semibold text-on-primary shadow-float">
                {label}
                <span className="grid h-7 w-7 place-items-center rounded-full bg-on-primary/20"><Icon size={15} /></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---- 2. Facts strip ----------------------------------------------------------------------------------------

function Facts() {
  const facts = [
    {
      title: 'Any station file',
      text: 'Station sheets, daily lists, month columns, CSV or Excel. The reader finds the date, Tmax and Tmin columns by itself.',
      tag: 'Input',
    },
    {
      title: '98% reliability',
      text: 'High temperature at 20 mm depth with the SHRP model, low temperature at the surface with the LTPP model.',
      tag: 'Method',
    },
    {
      title: 'Report-ready',
      text: 'A PDF with every calculation step, an Excel workbook with all tables, and print-quality chart pictures.',
      tag: 'Output',
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h2 className="display text-center text-lg text-ink sm:text-xl">One temperature file in, a complete binder decision out</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {facts.map((f) => (
          <article key={f.title} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
            <span className="w-fit rounded-full bg-raised px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">{f.tag}</span>
            <h3 className="display mt-4 text-lg text-ink">{f.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---- 3. Features ---------------------------------------------------------------------------------------------

function Features() {
  return (
    <section id="features" className="relative scroll-mt-20">
      <Squares items={[{ className: 'right-[6%] top-0 h-9 w-9 bg-accent-blue' }, { className: 'left-0 top-1/3 h-8 w-8 bg-accent-purple' }]} />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="display text-3xl leading-tight text-ink sm:text-4xl">7-day maximum, annual minimum, heatmaps and more</h2>
            <p className="mt-4 text-muted">
              Every step from the raw daily record to the binder grade is shown on screen, with the formulas and the
              numbers put into them.
            </p>
          </div>
          <div className="rounded-2xl bg-ink px-5 py-3 text-center text-canvas shadow-float">
            <div className="display text-2xl">PG 46–88</div>
            <div className="text-xs opacity-75">high grades · −10 to −46 low</div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <FeatureCard big tag="Result" icons={[Thermo, Snow, Chart]} title="Climate analysis"
            text="The hottest 7 consecutive days and the coldest day of every year, with gaps filled and incomplete years left out and shown in grey." />
          <FeatureCard big tag="Result" icons={[Layers, Table, FileIcon]} title="Grade and specification"
            text="The final PG grade with the AASHTO M323 traffic adjustment and the M320 specification table, ready to put in a report." />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard tag="Step" icons={[Grid]} title="Heatmaps" text="Monthly mean Tmax and Tmin for every year, so hot and cold years stand out at a glance." />
          <FeatureCard tag="Step" icons={[Thermo]} title="SHRP & LTPP" text="Both temperature models written out with every number filled in, the way a checker wants to see them." />
          <FeatureCard tag="Step" icons={[Truck]} title="Traffic bump" text="Design ESAL and speed move the high grade up by the M323 table, with the “consider” case as a switch." />
          <FeatureCard tag="Step" icons={[Flask]} title="Binder type & tests" text="Crude oil, high-quality crude or modifier required, and the laboratory tests the grade calls for." />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ tag, icons, title, text, big = false }: {
  tag: string; icons: ((p: { size?: number }) => ReactNode)[]; title: string; text: string; big?: boolean;
}) {
  return (
    <Link href="/analyse" className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-primary/70">
      <div className="flex items-center justify-between">
        <span className="flex gap-1.5 text-primary">
          {icons.map((Icon, i) => <span key={i} className="grid h-8 w-8 place-items-center rounded-lg bg-raised"><Icon size={17} /></span>)}
        </span>
        <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{tag}</span>
      </div>
      <h3 className={`display mt-5 text-ink ${big ? 'text-xl' : 'text-base'}`}>{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{text}</p>
      <span className="mt-5 inline-flex items-center justify-between text-sm font-semibold text-ink">
        Start analysis <ArrowRight size={16} className="transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

// ---- 4. How it works + preview ---------------------------------------------------------------------------------

/** Illustrative numbers for the preview only. */
const EXAMPLE_BARS = [33.6, 34.1, 33.2, 34.8, 33.9, 34.4, 35.0, 33.7, 34.6, 34.2];

function Workflow() {
  const steps = [
    [Upload, 'Upload', 'Drop a CSV or Excel file of daily Tmax and Tmin.'],
    [Thermo, 'Analyse', 'Yearly extremes, statistics and both temperature models.'],
    [Layers, 'Grade', 'PG grade, traffic adjustment and specification table.'],
    [Download, 'Report', 'Download the PDF, the Excel workbook or the charts.'],
  ] as const;
  return (
    <section id="how-it-works" className="relative scroll-mt-20">
      <Squares items={[{ className: 'left-[2%] top-24 h-10 w-10 bg-accent-yellow' }, { className: 'right-[3%] top-1/2 h-6 w-6 bg-accent-pink' }]} />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="display text-3xl leading-tight text-ink sm:text-4xl">From station record to binder grade</h2>
          <p className="mt-4 text-muted">Works in the browser on your office computer, a laptop on site, or your phone.</p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <BrowserPreview />
          <ol className="grid gap-3">
            {steps.map(([Icon, title, text], i) => (
              <li key={title} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary"><Icon size={19} /></span>
                <div>
                  <p className="display text-sm text-ink">{i + 1}. {title}</p>
                  <p className="mt-0.5 text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative mt-10 flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-primary px-6 py-8 text-on-primary sm:px-10">
          <h3 className="display max-w-xl text-2xl leading-snug sm:text-3xl">Start your first binder analysis right now</h3>
          <Link href="/analyse" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#1c1a35] transition hover:bg-white/90">
            Start analysis <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function BrowserPreview() {
  const max = Math.max(...EXAMPLE_BARS);
  const min = Math.min(...EXAMPLE_BARS) - 1;
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-float" aria-label="Preview of the results page (example numbers)">
      <div className="flex items-center gap-2 border-b border-line bg-raised px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate rounded-md bg-surface px-3 py-1 text-xs text-subtle">superpave-pg-selector.vercel.app/analyse</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.5fr] sm:p-5">
        <div className="rounded-xl bg-primary p-4 text-on-primary">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">Recommended binder</p>
          <p className="display mt-1 text-3xl">PG 70-10</p>
          <p className="mt-2 text-xs opacity-80">Climate PG 64-10 → +1 grade for traffic</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded-full bg-on-primary/15 px-2 py-0.5">98%</span>
            <span className="rounded-full bg-on-primary/15 px-2 py-0.5">Crude oil</span>
          </div>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold text-ink">Annual 7-day maximum (°C)</p>
          <div className="mt-3 flex h-28 items-end gap-1.5" aria-hidden="true">
            {EXAMPLE_BARS.map((v, i) => (
              <span key={i} className="flex-1 rounded-t bg-hi" style={{ height: `${((v - min) / (max - min)) * 100}%`, opacity: 0.55 + (i % 3) * 0.15 }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            {[['Mean', '34.2'], ['σ', '0.5'], ['T 20 mm', '57.7']].map(([k, v]) => (
              <span key={k} className="rounded-md bg-raised px-2 py-1 text-muted">{k} <b className="num text-ink">{v}</b></span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="px-5 pb-4 text-xs text-subtle">Example numbers for illustration.</figcaption>
    </figure>
  );
}

// ---- 5. Benefits grid -------------------------------------------------------------------------------------------

function Benefits() {
  const items = [
    [Upload, 'text-accent-yellow', 'Any file layout', 'Column names in many spellings, °F converted, decimal commas accepted.'],
    [Broom, 'text-accent-pink', 'Careful cleaning', 'Impossible values and Tmax below Tmin are removed; short gaps are filled.'],
    [Grid, 'text-accent-blue', 'Saved analyses', 'Every analysis is kept in your account and listed on your dashboard.'],
    [LinkIcon, 'text-accent-purple', 'Shareable links', 'Send a link; colleagues see the full result without changing it.'],
    [FileIcon, 'text-hi', 'PDF report', 'Charts, tables, both models and an appendix with every calculation step.'],
    [Table, 'text-ok', 'Excel workbook', 'All yearly values, heatmaps and the specification table in one file.'],
  ] as const;
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([Icon, color, title, text]) => (
          <div key={title} className="text-center">
            <span className={`mx-auto grid h-12 w-12 place-items-center rounded-xl bg-raised ${color}`}><Icon size={24} /></span>
            <h3 className="display mt-4 text-base text-ink">{title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- 6. From lab to road (photos) ------------------------------------------------------------------------------

function Field() {
  return (
    <section id="field" className="relative scroll-mt-20">
      <Squares items={[{ className: 'left-[44%] top-6 h-8 w-8 bg-accent-purple' }, { className: 'left-0 bottom-24 h-6 w-6 bg-accent-blue' }]} />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col justify-center">
          <h2 className="display text-3xl leading-tight text-ink sm:text-4xl">From the binder drum to the finished mat</h2>
          <p className="mt-4 max-w-lg text-muted">
            The grade on the drum has to match the hottest and coldest days the road will see. Too soft and the
            surface ruts in summer; too stiff and it cracks in the cold. Order the grade the climate needs: crude oil,
            high-quality crude oil, or a polymer-modified binder.
          </p>
          <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-7">
            <p className="display text-lg text-ink">Prepared by {SITE.author}</p>
            <p className="mt-1 text-sm text-muted">{SITE.authorRole}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted">Questions about the method, or want it for your project? Get in touch.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={mailto(SITE.fullName)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover">
                <Mail size={16} />Email me
              </a>
              {SITE.linkedin && (
                <a href={SITE.linkedin} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-primary">
                  <LinkedIn size={16} />LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <PhotoTile image={binderDrums} alt="Rows of steel bitumen drums in a warehouse" caption="Binder storage" className="col-span-2 aspect-[16/9]" />
          <PhotoTile image={drumsYard} alt="Sealed bitumen drums lined up in a refinery yard" caption="Ready for dispatch" className="row-span-2 min-h-64" />
          <PhotoTile image={openDrums} alt="Open drums filled with liquid bitumen" caption="Bitumen in drums" className="aspect-square" />
          <PhotoTile image={pellets} alt="Close-up of glossy solid bitumen pellets" caption="Solid bitumen" className="aspect-square" />
        </div>
      </div>
    </section>
  );
}

function PhotoTile({ image, alt, caption, className }: { image: StaticImageData; alt: string; caption: string; className: string }) {
  return (
    <figure className={`relative overflow-hidden rounded-3xl border border-line bg-raised ${className}`}>
      <Image src={image} alt={alt} placeholder="blur" fill sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-8 text-sm font-semibold text-white">
        {caption}
      </figcaption>
    </figure>
  );
}

// ---- 7. Closing banner ----------------------------------------------------------------------------------------

function ClosingBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-accent-yellow px-6 py-8 text-[#1c1a35] sm:px-10 sm:py-10">
        <h2 className="display max-w-xl text-2xl leading-snug sm:text-3xl">Choose the binder that suits your climate</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#1c1a35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2850]">
            Create free account <ArrowRight size={16} />
          </Link>
          <a href={mailto(SITE.fullName)} className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1c1a35] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#1c1a35]/10">
            <Mail size={16} />Contact
          </a>
        </div>
      </div>
    </section>
  );
}
