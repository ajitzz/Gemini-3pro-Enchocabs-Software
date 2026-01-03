import React from 'react';
import { Link } from 'react-router-dom';

const Hero: React.FC = () => {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_left,#4f46e5,transparent_40%),radial-gradient(circle_at_bottom_right,#0ea5e9,transparent_35%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100 ring-1 ring-white/15">
              Encho Cabs
            </p>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Seamless rides. Secure portals. Built for your team.
            </h1>
            <p className="max-w-2xl text-lg text-slate-200">
              Give passengers a premium welcome page while keeping driver and admin tools safely behind Google authentication.
              Access the staff console from the /staff area whenever you are ready to sign in.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/staff/login"
                className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
              >
                Staff sign in
              </Link>
              <Link
                to="/staff/portal"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-indigo-300 hover:text-indigo-100"
              >
                Driver portal
              </Link>
            </div>
          </div>
          <div className="flex-1">
            <div className="relative mx-auto max-w-xl overflow-hidden rounded-3xl bg-white/5 p-8 shadow-2xl shadow-indigo-900/40 ring-1 ring-white/10">
              <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-3xl" />
              <div className="absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-sky-400/30 blur-3xl" />
              <div className="relative space-y-4 text-sm text-slate-200">
                <p className="text-indigo-100">Public landing</p>
                <div className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-white/5">
                  <p className="text-lg font-semibold text-white">www.enchocabs.com</p>
                  <p className="text-slate-300">Open to everyone without sign-in.</p>
                </div>
                <p className="text-indigo-100">Secure staff area</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-white/5">
                    <p className="text-sm font-semibold text-white">/staff/dashboard</p>
                    <p className="text-slate-300">Admin analytics and controls.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-white/5">
                    <p className="text-sm font-semibold text-white">/staff/portal</p>
                    <p className="text-slate-300">Driver self-service view.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
