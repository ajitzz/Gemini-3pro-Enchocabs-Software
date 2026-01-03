import React from 'react';

const Rental: React.FC = () => {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Rental support</p>
          <h2 className="text-3xl font-bold text-slate-900">Flexible packages for every route</h2>
          <p className="text-slate-600">
            We help teams coordinate vehicles, payouts, and driver requests in one place. Share this page with potential drivers
            while your staff authenticate to manage the details.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Transparent pricing and clear communication</li>
            <li>Performance tracking for admins inside /staff</li>
            <li>Helpful resources for drivers before they sign in</li>
          </ul>
        </div>
        <div className="flex-1">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 p-[2px] shadow-xl">
            <div className="h-full rounded-[28px] bg-white p-8 text-slate-800">
              <h3 className="text-xl font-semibold text-slate-900">Admin access</h3>
              <p className="mt-2 text-sm text-slate-600">Requires Google sign-in</p>
              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="font-semibold text-slate-900">Driver payouts</p>
                  <p className="text-slate-600">Handle weekly wallets and settlements in the protected console.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="font-semibold text-slate-900">Import &amp; audit</p>
                  <p className="text-slate-600">Upload data securely from the /staff area with minimal friction.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Rental;
