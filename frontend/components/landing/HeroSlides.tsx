'use client';
import Image, { type StaticImageData } from 'next/image';
import { useEffect, useState } from 'react';

export interface Slide {
  image: StaticImageData;
  alt: string;
  caption: string;
}

const SECONDS_PER_SLIDE = 5;

/**
 * Hero photos that cross-fade every few seconds. The dots pick a photo by hand. Visitors who ask their
 * system for reduced motion get no automatic change.
 */
export function HeroSlides({ slides }: { slides: Slide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setCurrent((i) => (i + 1) % slides.length), SECONDS_PER_SLIDE * 1000);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border-4 border-primary/70 bg-raised shadow-float"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel" aria-label="Road construction photos">
      {slides.map((slide, i) => (
        <Image key={slide.caption} src={slide.image} alt={slide.alt} placeholder="blur" priority={i === 0}
          sizes="(min-width: 1024px) 600px, 100vw" aria-hidden={i !== current}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/60 to-transparent px-5 pb-12 pt-10 sm:pb-14">
        <p className="text-sm font-semibold text-white" aria-live="polite">{slides[current].caption}</p>
        <div className="flex gap-1.5">
          {slides.map((slide, i) => (
            <button key={slide.caption} type="button" onClick={() => setCurrent(i)} aria-label={`Show photo ${i + 1}: ${slide.caption}`}
              aria-current={i === current}
              className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
