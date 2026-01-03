// app/about/page.tsx

import React from "react";

export default function AboutPage() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-slate-50 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      {/* Soft gradient blobs in the background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -right-16 top-40 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-100/50 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:gap-12">
        {/* Top section: title + intro */}
        <section className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-800 shadow-sm backdrop-blur">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Built for drivers, every week.
            </div>

            <div className="space-y-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                About <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">Encho Weekly</span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Encho Weekly is a simple, mobile-first dashboard that helps drivers
                understand their earnings, build better habits, and feel in control
                of every trip they complete.
              </p>
            </div>

            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Weekly focus
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">At a glance</p>
                <p className="mt-1 text-xs text-slate-500">
                  See your best weeks, trends, and consistency in seconds.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Driver-first
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">Clear & simple</p>
                <p className="mt-1 text-xs text-slate-500">
                  Clean visuals, no clutter — built to work beautifully on phones.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Real performance
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">Honest data</p>
                <p className="mt-1 text-xs text-slate-500">
                  Focused on weekly earnings, trips, and sustainable improvement.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <a
                href="/performance"
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-lg active:translate-y-0"
              >
                View performance dashboard
              </a>
              <p className="text-xs text-slate-500">
                Designed to feel smooth and familiar from the very first tap.
              </p>
            </div>
          </div>

          {/* Right side: floating card stack */}
          <div className="relative flex items-center justify-center">
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
                    <p className="mt-1 text-[10px] opacity-80">10 trips</p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-slate-900">
                    <p className="text-[11px] text-emerald-700">Best week</p>
                    <p className="mt-1 text-lg font-semibold">₹32,800</p>
                    <p className="mt-1 text-[10px] text-slate-500">High streak</p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-3 py-3 text-slate-900">
                    <p className="text-[11px] text-slate-500">Consistency</p>
                    <p className="mt-1 text-lg font-semibold">4.7★</p>
                    <p className="mt-1 text-[10px] text-slate-500">Last month</p>
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
        </section>

        {/* Our story / philosophy */}
        <section className="grid gap-6 rounded-3xl border border-slate-100 bg-white/70 p-5 shadow-sm shadow-slate-100 backdrop-blur-md sm:p-6 lg:grid-cols-2 lg:gap-10 lg:p-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              A calmer way to track performance
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Many dashboards are built for managers, not drivers. Encho Weekly
              flips that idea. We prioritise clarity, focus, and a layout that
              feels natural on the small screen you already use every day.
            </p>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Every design choice — from colours to animations — is tuned to
              keep you informed without overwhelming you. You see the weeks that
              matter, the progress you&apos;re making, and the habits that help you
              perform at your best.
            </p>

            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 sm:text-sm">
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/80 p-3">
                <div className="mt-1 h-7 w-7 flex-none rounded-full bg-emerald-600 text-center text-sm font-semibold leading-7 text-white">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    Mobile-first design
                  </p>
                  <p className="mt-1 text-slate-600">
                    Everything is tuned for thumbs, not mice — so it feels great
                    in the hand.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                <div className="mt-1 h-7 w-7 flex-none rounded-full bg-slate-900 text-center text-sm font-semibold leading-7 text-white">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    Gentle motion
                  </p>
                  <p className="mt-1 text-slate-600">
                    Subtle transitions guide your eyes, instead of distracting
                    from the numbers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              How we think about experience
            </h3>
            <ol className="space-y-3 text-sm">
              <li className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-emerald-50/50 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-sky-400" />
                <div className="pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    01 — Clarity first
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    Information that fits into your day
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    You shouldn&apos;t need a manual to understand your own
                    performance. We keep layouts simple and language human.
                  </p>
                </div>
              </li>

              <li className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-sky-50/60 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-500 to-emerald-400" />
                <div className="pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                    02 — Smooth motion
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    Helpful transitions, not gimmicks
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Cards, modals, and stats animate just enough to feel alive
                    without slowing you down.
                  </p>
                </div>
              </li>

              <li className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-amber-50/60 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-emerald-400" />
                <div className="pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    03 — Real-world fit
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    Built around weekly rhythms
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    We think in weeks, streaks, and habits — just like drivers do
                    in real life, not in spreadsheets.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* Closing section */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-600 to-sky-600 px-5 py-6 text-white shadow-md sm:flex-row sm:items-center sm:px-7 sm:py-7 lg:px-10">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">
              Next step
            </p>
            <p className="text-balance text-lg font-semibold sm:text-xl">
              See how Encho Weekly feels with your own performance data.
            </p>
            <p className="max-w-xl text-xs text-emerald-50 sm:text-sm">
              Jump into the performance page, explore your weekly history, and
              notice how the design stays out of your way while you focus on what
              matters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <a
              href="/performance"
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-md shadow-emerald-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-lg active:translate-y-0"
            >
              Go to performance
            </a>
            <span className="text-emerald-100">
              No extra steps — just a calmer way to see how you&apos;re doing.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
