// Site-wide details shown in the header, footer and landing page. Edit them here only.

export const SITE = {
  name: 'PG Binder Selector',
  fullName: 'Superpave PG Binder Selector',
  author: 'Abenezer Tilahun',
  authorRole: 'Senior Pavement & Materials Engineer',
  email: 'abenytilahunccecc@gmail.com',
  /** Full profile URL, e.g. "https://www.linkedin.com/in/your-name". The LinkedIn links are hidden while it is empty. */
  linkedin: 'https://www.linkedin.com/in/abenezer-tilahun-042a34151/',
  /** Fixed rather than computed: Next.js prerendering does not allow `new Date()` here. */
  copyrightYear: 2026,
} as const;

export const mailto = (subject?: string) =>
  `mailto:${SITE.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
