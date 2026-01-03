"use client";

import * as React from "react";
import { testimonials } from "@/lib/data/testimonials";
import Image from "next/image";
/* ---------- Types ---------- */
export type Testimonial = {
  id: string;
  name: string;
  role: string;
  avatar: string; // URL
 weekly: string;

  date: string;
  text: string;
};

type Props = {
  items?: Testimonial[];
  className?: string;
  autoplay?: boolean;   // default true
  interval?: number;    // default 3500ms
};

/* ---------- Small inline icons ---------- */
const VerifiedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l2.09 2.09 2.96-.59-.59 2.96L19.91 9 17 10.09l.59 2.96-2.96-.59L12 15.91l-2.09-2.09-2.96.59.59-2.96L4.09 9 7 7.91l-.59-2.96 2.96.59L12 2zm-1 11.17l4.24-4.24-1.41-1.41L11 10.34 9.17 8.5 7.76 9.91 11 13.17z"/>
  </svg>
);

/* ---------- Component ---------- */
export default function TestimonialCarousel({
 items = testimonials,
  className = "",
  autoplay = true,
  interval = 3500,
}: Props) {
  const base = React.useMemo(() => {
    const seen = new Set<string>();
    return (items?.length ? items : testimonials).filter((item) => {
      const key = (item.id || item.name).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);
  const hasLoop = base.length > 1;

  // create clones for seamless loop: [last, ...base, first]
  const track = React.useMemo(() => {
    if (!hasLoop) return base;
    return [base[base.length - 1], ...base, base[0]];
  }, [base, hasLoop]);

  const rootRef = React.useRef<HTMLUListElement | null>(null);
  const [activeReal, setActiveReal] = React.useState(0); // 0..base.length-1
  const [internalIdx, setInternalIdx] = React.useState(hasLoop ? 1 : 0); // index in track
  const rafRef = React.useRef<number | null>(null);
  const debounceRef = React.useRef<number | null>(null);
 const [modalTestimonial, setModalTestimonial] = React.useState<Testimonial | null>(null);
  const lastTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const reduceMotion = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // eslint-disable-next-line no-undef
  const centerAt = React.useCallback((idx: number, behavior: ScrollBehavior = "smooth") => {
    const root = rootRef.current;
    if (!root) return;
    const el = root.children[idx] as HTMLElement | undefined;
    if (!el) return;
    const left = el.offsetLeft - (root.clientWidth - el.clientWidth) / 2;
    root.scrollTo({ left, behavior });
    setInternalIdx(idx);
  }, []);

  // init position (first real slide centered)
  React.useEffect(() => {
    if (!rootRef.current || track.length === 0) return;
    requestAnimationFrame(() => centerAt(hasLoop ? 1 : 0, "auto"));
  }, [track.length, hasLoop, centerAt]);

  // derive active index on scroll; auto-jump when a clone is reached
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nearest = () => {
      const center = root.scrollLeft + root.clientWidth / 2;
      let min = Infinity;
      let idx = 0;
      Array.from(root.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const c = el.offsetLeft + el.clientWidth / 2;
        const d = Math.abs(c - center);
        if (d < min) { min = d; idx = i; }
      });
      return idx;
    };

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const idx = nearest();
        setInternalIdx(idx);
        const n = base.length;
        const real = !hasLoop ? idx : idx === 0 ? n - 1 : idx === n + 1 ? 0 : idx - 1;
        setActiveReal(real);

        // debounce: if we land on a clone, jump to matching real without animation
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
          if (!hasLoop) return;
          if (idx === 0) centerAt(n, "auto");        // last real
          else if (idx === n + 1) centerAt(1, "auto"); // first real
        }, 60) as unknown as number;
      });
    };

    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [base.length, hasLoop, centerAt]);

  // controls: move one card per click/swipe
  const next = React.useCallback(() => {
    const n = base.length;
    if (!n) return;
    const target = internalIdx + 1;
    // allow going onto the trailing clone; scroll handler will snap back to the first real
    centerAt(hasLoop ? target : Math.min(target, n - 1), "smooth");
  }, [internalIdx, base.length, centerAt, hasLoop]);

  const prev = React.useCallback(() => {
    const n = base.length;
    if (!n) return;
    const target = internalIdx - 1;
    // allow going onto the leading clone; scroll handler will snap back to the last real
    centerAt(hasLoop ? target : Math.max(target, 0), "smooth");
  }, [internalIdx, base.length, centerAt, hasLoop]);
  const closeModal = React.useCallback(() => {
    setModalTestimonial(null);
  }, []);

  const openModal = React.useCallback(
    (testimonial: Testimonial, trigger: HTMLButtonElement) => {
      lastTriggerRef.current = trigger;
      setModalTestimonial(testimonial);
    },
    []
  );

  React.useEffect(() => {
    if (!modalTestimonial) {
      requestAnimationFrame(() => {
        lastTriggerRef.current?.focus();
      });
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modalTestimonial, closeModal]);

  // autoplay (pause on hover/focus/touch & when tab hidden)
  const nextRef = React.useRef<() => void>(() => {});
  React.useEffect(() => { nextRef.current = next; }, [next]);

  React.useEffect(() => {
    if (!autoplay || reduceMotion || base.length < 2) return;
    let id: number | undefined;

    const start = () => {
      stop(); // reset if any
      id = window.setInterval(() => nextRef.current(), interval) as unknown as number;
    };
    const stop = () => { if (id) window.clearInterval(id); id = undefined; };

    const root = rootRef.current;
    if (!root) return;

    const onEnter = () => stop();
    const onLeave = () => start();
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("focusin", onEnter);
    root.addEventListener("focusout", onLeave);
    root.addEventListener("touchstart", onEnter, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("focusin", onEnter);
      root.removeEventListener("focusout", onLeave);
      root.removeEventListener("touchstart", onEnter);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autoplay, interval, reduceMotion, base.length]);

  const goTo = (realIndex: number) => centerAt(hasLoop ? realIndex + 1 : realIndex, "smooth");

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Driver testimonials"
 className={`relative overflow-hidden bg-gradient-to-b from-white to-white/70 py-20 ${className}`}    >
      <h2 className="mx-auto mb-10 max-w-6xl px-6 text-center text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
        What our Drivers say
      </h2>

     <div className="relative mx-auto px-4 sm:px-6">
        <ul
          ref={rootRef}
         className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:gap-6"
          style={{ scrollBehavior: "smooth" }}
        >
          {track.map((t, i) => (
            <li
              key={`${t.name}-${i}`}
        className="snap-center snap-always shrink-0 basis-[85%] sm:basis-[65%] md:basis-[360px] lg:basis-[380px]"
              aria-hidden={hasLoop && (i === 0 || i === track.length - 1) ? true : undefined}
            >
              <article className="flex h-full flex-col justify-between rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
                <header className="mb-4 flex items-center gap-4">
                 
                 <Image src={t.avatar} alt="" className="h-12 w-12 rounded-full object-cover" width={96} height={96} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-gray-900">{t.name}</h3>
                      <span className="text-sky-500" aria-hidden>
                        <VerifiedIcon />
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{t.role}</p>
                  </div>
                </header>

                <div className="mb-3 flex items-center gap-1 text-amber-400" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <svg key={s} className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118L10.5 13.347a1 1 0 00-1.176 0L6.615 16.281c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>

                <p className="mb-1 font-semibold text-gray-900">
                  <span className="font-semibold">Best Week :</span>₹{t.weekly}</p>
                <p className="mb-3 text-gray-900">
                  <span className="font-semibold">Date:</span> {t.date}
                </p>
                <p className="line-clamp-3 text-gray-600">{t.text}</p>

                 <button
                  type="button"
                  onClick={(event) => openModal(t, event.currentTarget)}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-700"
                >
                  Read more
                <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M10.293 15.707a1 1 0 010-1.414L12.586 12H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                </button>
              </article>
            </li>
          ))}
        </ul>
        <div className="pointer-events-none absolute inset-y-4 left-0 right-0 flex justify-between bg-gradient-to-r from-white via-transparent to-white opacity-80 sm:hidden" aria-hidden>
          <span className="h-full w-8 bg-gradient-to-r from-white to-transparent" />
          <span className="h-full w-8 bg-gradient-to-l from-white to-transparent" />
        </div>

        {/* Prev / Next (looping; always enabled) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between md:flex">
          <button
            onClick={prev}
            className="pointer-events-auto ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/5 hover:bg-gray-50"
            aria-label="Previous slide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button
            onClick={next}
            className="pointer-events-auto mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/5 hover:bg-gray-50"
            aria-label="Next slide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        {/* Dots (map to real slides) */}
        <div className="mt-6 flex justify-center gap-2">
          {base.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={[
                "h-2 w-2 rounded-full transition",
                activeReal === i ? "bg-sky-600" : "bg-gray-300 hover:bg-gray-400",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      {modalTestimonial && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-10">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-hidden
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Testimonial from ${modalTestimonial.name}`}
            className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10"
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
              aria-label="Close testimonial"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <header className="mb-5 flex items-center gap-4">
              <Image
                src={modalTestimonial.avatar}
                alt={modalTestimonial.name}
                className="h-14 w-14 rounded-full object-cover"
                width={120}
                height={120}
              />
              <div>
                <p className="text-lg font-semibold text-gray-900">{modalTestimonial.name}</p>
                <p className="text-sm text-gray-500">{modalTestimonial.role}</p>
              </div>
            </header>

            <div className="mb-4 flex items-center gap-1 text-amber-400" aria-label="5 out of 5 stars">
              {Array.from({ length: 5 }).map((_, s) => (
                <svg key={s} className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118L10.5 13.347a1 1 0 00-1.176 0L6.615 16.281c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>

            <dl className="mb-4 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-gray-900">Top weekly earnings</dt>
                <dd>{modalTestimonial.weekly}</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">Date</dt>
                <dd>{modalTestimonial.date}</dd>
              </div>
            </dl>

            <p className="text-gray-700">{modalTestimonial.text}</p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Helper to jump to a real slide ---------- */
// function goTo(i: number) {
//   // Placeholder to satisfy TS when importing as-is; real navigation handled via goTo in component scope.
// }
