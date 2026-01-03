"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";

// Simple scroll/entrance animations without external libraries.
// Uses IntersectionObserver on the client to fade & slide sections in
// when they enter the viewport.

function useInViewOnce(threshold: number = 0.15) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // This effect only runs on the client in React/Next.js
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      // If we're in a non-browser environment or IntersectionObserver
      // is not supported, just show the content without animation.
      setIsInView(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new window.IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Animate only once
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return { ref, isInView };
}

interface FadeInSectionProps {
  children: ReactNode;
  className?: string;
}

function FadeInSection({ children, className = "" }: FadeInSectionProps) {
  const { ref, isInView } = useInViewOnce();

  const baseClasses =
    "transition-all duration-700 ease-out transform opacity-0 translate-y-6";
  const visibleClasses = "opacity-100 translate-y-0";

  return (
    <div
      ref={ref}
      className={`${baseClasses} ${isInView ? visibleClasses : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="relative w-full h-[70vh] overflow-hidden">
        <Image
          src="https://i.ibb.co/Wpz0kZD3/father-throwing-up-son.jpg"
          alt="Encho Cabs driver feeling at home"
          fill
          priority
          className="object-cover scale-105 md:scale-100 transition-transform duration-700 ease-out"
        />

        {/* Simple dark overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(15,23,42,0.8)" }}
        />

        {/* Hero Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <FadeInSection className="space-y-6">
            <p className="inline-block rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-slate-100">
              Encho Cabs
            </p>

            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-tight text-white drop-shadow-lg">
              Drive. Earn. Live Better.
            </h1>

            <p className="max-w-2xl mx-auto text-base md:text-lg lg:text-xl text-slate-100/90">
              A taxi platform where drivers get vehicles, stay, food, and full support — so you can focus on the road
              while we take care of the rest.
            </p>
          </FadeInSection>

          <FadeInSection className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <a
              href="#vision"
              className="rounded-full bg-white text-slate-900 px-8 py-3 text-sm font-semibold shadow-lg shadow-slate-900/20 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              Discover Encho Cabs
            </a>
            <span className="text-xs sm:text-sm text-slate-100/80">
              Earn up to ₹40,000 – ₹75,000 with full transparency
            </span>
          </FadeInSection>
        </div>
      </section>

      {/* Main Content Section */}
      <section
        id="vision"
        className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20"
      >
        <div className="grid gap-12 lg:grid-cols-[1fr,1.1fr] items-start">
          {/* Our Promise to Drivers */}
          <FadeInSection className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-800">
              Our Promise to Drivers
            </h2>

            <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">
              Not just a platform — a home for drivers
            </p>

            <div className="space-y-5 text-base leading-relaxed text-slate-600">
              <p>
                Encho Cabs is built around one simple belief: when drivers are cared for, everything else falls into
                place. That&apos;s why we go beyond just giving you a taxi platform — we give you a complete ecosystem to
                live, drive, and grow with confidence.
              </p>
              <p>
                From vehicles on road to fully furnished rooms, we make sure you have everything you need. Your
                accommodation comes with a comfortable bed, storage, and a proper kitchen setup, so even after a long
                shift, you come back to a place that feels like home.
              </p>
              <p>
                We provide daily food support, 24/7 assistance from our coordination team, and real road support from
                senior drivers who&apos;ve already walked the path. Whether it&apos;s a tough route, a new city, or a tricky
                situation, you&apos;re never alone on the road.
              </p>
              <p>
                With Encho Cabs, your earnings are always clear. Drivers can earn between <strong>₹40,000 and
                ₹75,000</strong>, and every payment, settlement, and trip earning is completely transparent in the
                earnings section of this website — so you always know where your money is coming from.
              </p>
            </div>
          </FadeInSection>

          {/* Highlight Cards */}
          <FadeInSection className="grid gap-5 sm:grid-cols-2">
            <div className="col-span-1 sm:col-span-2 rounded-2xl border border-slate-100 bg-white/80 p-5 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Everything a driver needs</h3>
              <p className="text-sm text-slate-600">
                Vehicles, accommodation, food, a fully furnished room, and kitchen access — all arranged so you can
                focus only on driving and earning.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500 mb-2">
                01 • Transparency
              </p>
              <h4 className="text-base font-semibold text-slate-800 mb-1">Clear Payments &amp; Settlements</h4>
              <p className="text-sm text-slate-600">
                Every settlement is transparent. You can see all your trips, payouts, and adjustments clearly inside the
                earnings section of this website.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-500 mb-2">
                02 • Support
              </p>
              <h4 className="text-base font-semibold text-slate-800 mb-1">24/7 Team &amp; Senior Drivers</h4>
              <p className="text-sm text-slate-600">
                Round-the-clock support from our ops team plus guidance from senior drivers for routes, safety, and
                better earnings.
              </p>
            </div>

             <div className="col-span-1 sm:col-span-2 rounded-2xl border border-slate-100 bg-white/80 p-5 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="relative h-64 w-full max-w-sm">
              {/* Back card */}
              <div className="absolute inset-x-6 top-6 rounded-3xl border border-emerald-100/70 bg-gradient-to-br from-emerald-50 to-sky-50 shadow-md shadow-emerald-100/60 transition-transform duration-700 ease-out hover:-translate-y-1" />
              {/* Middle card */}
              <div className="absolute inset-x-3 top-3 rounded-3xl border border-white/60 bg-white/80 shadow-lg shadow-emerald-200/70 backdrop-blur-md" />
              {/* Foreground card content */}
              <div className="relative flex h-full flex-col justify-between rounded-3xl border border-emerald-100 bg-white/95 p-5 shadow-xl shadow-emerald-200/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                      Weekly snapshot
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      Driver performance
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-2xl bg-emerald-600 px-3 py-3 text-white shadow-sm">
                    <p className="text-[11px] opacity-80">This week</p>
                    <p className="mt-1 text-lg font-semibold">₹24,300</p>
                    <p className="mt-1 text-[10px] opacity-80">70 trips</p>
                  </div>
                   <div className="rounded-2xl bg-slate-50 px-3 py-3 text-slate-900">
                    <p className="text-[11px] text-slate-500">Total Earnigs</p>
                    <p className="mt-1 text-lg font-semibold">₹50,000★</p>
                    <p className="mt-1 text-[10px] text-slate-500">Last month</p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-slate-900">
                    <p className="text-[11px] text-emerald-700">Best week</p>
                    <p className="mt-1 text-lg font-semibold">₹32,800</p>
                    <p className="mt-1 text-[10px] text-slate-500">High streak</p>
                  </div>

                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                  <p>
                    Simple visuals, smooth transitions, and an experience that works
                    great on the move.
                  </p>
                  <div className="flex -space-x-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-900 shadow-sm">
                      D1
                    </span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-900 shadow-sm">
                      D2
                    </span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-emerald-900 shadow-sm">
                      +
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </FadeInSection>
        </div>

        {/* Journey Section */}
        <FadeInSection className="mt-16 space-y-8">
          <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-800">
            Your journey with Encho Cabs
          </h3>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              {
                title: "Join",
                desc: "Get onboarded to Encho Cabs with a simple, guided process and clear documentation.",
              },
              {
                title: "Settle",
                desc: "Move into your fully furnished room with kitchen access, food support, and all basic needs covered.",
              },
              {
                title: "Drive",
                desc: "Start driving with our vehicles, backed by 24/7 team support and senior driver mentorship.",
              },
              {
                title: "Grow",
                desc: "Track your earnings online, optimise your routes, and steadily move towards higher income.",
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <span className="absolute -top-3 left-4 rounded-full bg-slate-900 text-xs text-white px-3 py-1 shadow-md">
                  0{index + 1}
                </span>
                <h4 className="mt-2 text-base font-semibold text-slate-800">{step.title}</h4>
                <p className="mt-2 text-sm text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </FadeInSection>
      </section>
    </main>
  );
}
