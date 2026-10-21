/** Decorative coloured squares (the "pixel" accents of the design). Hidden from screen readers and on small screens. */
export function Squares({ items }: { items: { className: string }[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
      {items.map((item, i) => (
        <span key={i} className={`absolute ${item.className}`} />
      ))}
    </div>
  );
}
