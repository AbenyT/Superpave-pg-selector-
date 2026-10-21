import Link from 'next/link';
import { mailto, SITE } from '@/lib/site';
import { LinkedIn, Mail } from './icons';
import { LogoMark } from './SiteHeader';
import { Squares } from './Squares';

/** Footer with the author's contact details. */
export function SiteFooter() {
  return (
    <footer id="contact" className="print-hidden relative mt-20 overflow-hidden bg-band">
      <Squares items={[
        { className: 'right-6 bottom-5 h-6 w-6 bg-accent-yellow' },
        { className: 'right-16 bottom-11 h-4 w-4 bg-accent-pink' },
        { className: 'right-28 bottom-4 h-3 w-3 bg-accent-blue' },
      ]} />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <p className="flex items-center gap-2.5"><LogoMark size={32} /><span className="display text-ink">{SITE.name}</span></p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Superpave performance grade binder selection from daily temperature records.
          </p>
          <p className="mt-4 text-sm text-ink">
            Prepared by <span className="font-semibold">{SITE.author}</span>
            <span className="block text-muted">{SITE.authorRole}</span>
          </p>
        </div>
        <FooterColumn title="App">
          <li><Link href="/analyse" className="text-muted transition hover:text-ink">New analysis</Link></li>
          <li><Link href="/dashboard" className="text-muted transition hover:text-ink">My analyses</Link></li>
          <li><Link href="/register" className="text-muted transition hover:text-ink">Create free account</Link></li>
          <li><Link href="/login" className="text-muted transition hover:text-ink">Log in</Link></li>
        </FooterColumn>
        <FooterColumn title="Methods">
          <li className="text-muted">AASHTO M320 · M323</li>
          <li className="text-muted">SHRP high-temperature model</li>
          <li className="text-muted">LTPP low-temperature model</li>
          <li className="text-muted">98% reliability</li>
        </FooterColumn>
        <FooterColumn title="Contact">
          <li>
            <a href={mailto(`${SITE.fullName}`)} className="inline-flex items-center gap-2 break-all text-muted transition hover:text-ink">
              <Mail size={16} className="shrink-0" />{SITE.email}
            </a>
          </li>
          {SITE.linkedin && (
            <li>
              <a href={SITE.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted transition hover:text-ink">
                <LinkedIn size={16} className="shrink-0" />LinkedIn
              </a>
            </li>
          )}
        </FooterColumn>
      </div>
      <div className="relative border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-subtle sm:px-6">
          © {SITE.copyrightYear} {SITE.author}. Results are for design support; check them against the governing specification before use.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="display text-sm text-ink">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}
