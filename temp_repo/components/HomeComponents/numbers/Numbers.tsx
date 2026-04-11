"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { numbers as data } from "@/lib/data/numbers"; // <-- uses your provided values
// -------------------------------- Types --------------------------------
type NumbersData = {
  drivers: number;
  coreTeams: number;
  earnings: number | string; // supports number or range string
  locationsTitle: string;
  locations: string[];
  image?: string;
};

// -------------------- Count last-10 once when in view (discrete steps) --------------------
function useStepCount(
  target: number,
  start: boolean,
  opts?: { duration?: number; delay?: number; steps?: number; from?: number }
) {
  const reduce = useReducedMotion();
  const { duration = 3, delay = 0, steps = 10, from } = opts || {};
  const startVal = Math.max(0, from ?? target - steps);
  const [display, setDisplay] = useState<number>(reduce ? target : startVal);

  useEffect(() => {
    if (!start) return;
    if (reduce) {
      setDisplay(target);
      return;
    }
    let i = 0;
    const stepTime = (duration * 1000) / steps;
    let timer: number | undefined;

    const tick = () => {
      i += 1;
      const current = Math.round(startVal + ((target - startVal) * i) / steps);
      if (i >= steps) {
        setDisplay(target);
        return;
      }
      setDisplay(current);
      timer = window.setTimeout(tick, stepTime) as unknown as number;
    };

    timer = window.setTimeout(tick, delay * 1000) as unknown as number;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [start, target, duration, delay, steps, startVal, reduce]);

  return display;
}

// -------------------- Ripple-carry digits: only changed digits animate --------------------
function NumberRippleCarry({ text, baseDelay = 0.06 }: { text: string; baseDelay?: number }) {
  const prevRef = useRef<string | null>(null);
  const prev = prevRef.current;
  const currChars = Array.from(text);
  const prevChars = Array.from(prev ?? text);
  const changed = currChars.map((ch, i) => prevChars[i] !== ch); // which indices changed

  useEffect(() => {
    prevRef.current = text;
  }, [text]);

  return (
    <span className="inline-flex items-end">
      {currChars.map((ch, i) => {
        const isDigit = /[0-9]/.test(ch);
        const delay = changed[i] && isDigit ? baseDelay * (currChars.length - 1 - i) : 0;
        return (
          <span key={`slot-${i}`} className="relative inline-block text-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`${i}-${ch}`}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut", delay }}
                className="inline-block"
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

// -------------------- One metric (value + line + label) --------------------
function Metric({
  value,
  label,
  isCurrency = false,
  delay = 0,
}: {
  value: number;
  label: string;
  isCurrency?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  // Responsive timing: always 10 steps, snappy durations
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
  const duration = isMobile ? 1.0 : 1.4;
  const steps = 10;

  // Final & step display strings
  const finalText = isCurrency
    ? "₹" + new Intl.NumberFormat("en-IN").format(value)
    : new Intl.NumberFormat("en-US").format(value);

  const reduceMotion = useReducedMotion();
  const count = useStepCount(value, Boolean(inView), {
    duration,
    delay,
    steps,
    from: Math.max(0, value - 10),
  });
  const displayText = isCurrency
    ? "₹" + new Intl.NumberFormat("en-IN").format(count)
    : new Intl.NumberFormat("en-US").format(count);

  return (
    <div ref={ref} className="flex flex-col justify-end" data-testid={`metric-${label.replace(/\s+/g, "-").toLowerCase()}`}>
      <div aria-live="off">
       
        <motion.span
          aria-hidden
          initial={{ opacity: 0, y: 4 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="min-h-[43px] font-sans font-normal text-[24px] leading-[43px] text-black tabular-nums"
        >
          {reduceMotion ? finalText : <NumberRippleCarry text={displayText} />}
        </motion.span>
        <span className="sr-only">{finalText}</span>
      </div>

      <motion.div
        className="mt-1 h-[1px] w-40 origin-left bg-gray-300/80"
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6, ease: "easeOut", delay }}
      />

      <motion.div
        className="mt-2 uppercase text-[11px] tracking-[0.16em] text-gray-500"
        initial={{ opacity: 0, y: 4 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.24, ease: "easeOut", delay: (delay ?? 0) + 0.05 }}
      >
        {label}
      </motion.div>
    </div>
  );
}

// -------------------- Section --------------------
export default function EnchoNumbers() {
  const numbers = data as NumbersData;

  const hasNumericEarnings = typeof numbers.earnings === "number";
  const earningsLabel = "Drivers Earnings";

  return (
    <section id="numbers" aria-label="Encho in Numbers" className="relative bg-white text-gray-900">
      {/* top seam gradient: black -> white */}


      <div className="mx-auto grid w-full  grid-cols-1 items-center md:gap-10 px-6 py-16 md:grid-cols-12 md:gap-20 md:py-20">
        {/* Left visual */}
        <figure className="relative md:col-span-7">
          {numbers.image ? (
            <img
              src={numbers.image}
              alt="Mechanical arm render"
              className="w-full rounded-2xl object-cover"
              width={800}
              height={600}
              loading="lazy"
            />
          ) : (
            <div className="aspect-[3/2] w-full rounded-2xl bg-gradient-to-br from-gray-50 to-gray-200" aria-hidden />
          )}
        </figure>

        {/* Right metrics */}
        <div className="md:col-span-5">
          <h3 className="font-sans font-normal text-[24px] leading-[43px] text-gray-900">Encho In Numbers</h3>

          <div className="mt-10 grid grid-cols-1 items-end gap-6 sm:grid-cols-2 md:gap-8">
            <Metric value={numbers.drivers} label="Drivers" delay={0.05} />
            <Metric value={numbers.coreTeams} label="Core Teams" delay={0.2} />

            {/* Earnings: animate if numeric, otherwise show the provided range cleanly */}
            {hasNumericEarnings ? (
              <Metric value={numbers.earnings as number} label={earningsLabel} isCurrency delay={0.35} />
            ) : (
              <div className="flex flex-col justify-end" data-testid="metric-earnings-range">
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.24, ease: "easeOut", delay: 0.35 }}
                  className="min-h-[43px] font-sans font-normal text-[24px] leading-[43px] text-black tabular-nums"
                >
                  {numbers.earnings as string}
                </motion.div>
                <motion.div
                  className="mt-1 h-[1px] w-40 origin-left bg-gray-300/80"
                  initial={{ scaleX: 0, opacity: 0 }}
                  whileInView={{ scaleX: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.35 }}
                />
                <motion.div
                  className="mt-2 uppercase text-[11px] tracking-[0.16em] text-gray-500"
                  initial={{ opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.24, ease: "easeOut", delay: 0.4 }}
                >
                  {earningsLabel}
                </motion.div>
              </div>
            )}

            {/* Locations list */}
            <div className="flex flex-col justify-end" data-testid="metric-locations">
              <div className="font-sans font-normal text-[20px] leading-[43px] text-black text-left">
                {numbers.locations.map((l, i) => (
                  <span key={l}>
                    {l}
                    {i !== numbers.locations.length - 1 ? <br /> : null}
                  </span>
                ))}
              </div>
              <div className="mt-1 h-[1px] w-40 bg-gray-300/80" />
              <div className="mt-2 uppercase text-[11px] tracking-[0.16em] text-gray-500">
                {numbers.locationsTitle}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Notes -----------------------------------
- Drivers & Core Teams animate from the last 10 values with a ripple-carry effect.
- Earnings:
  - If a number: animates as currency (₹, en-IN).
  - If a string range ("₹35,000 - ₹75,000"): shows statically with subtle fade.
- Respects prefers-reduced-motion; animated numbers appear as final values.
- Uses tabular-nums + min-h to avoid digit width/height jitter.
----------------------------------------------------------------------------- */
