import React from 'react';

const Salary: React.FC = () => {
  const perks = ['Weekly settlements managed by admins', 'Transparent summaries in the driver portal', 'Support from the Encho Cabs team'];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-8 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Payouts</p>
              <h2 className="text-3xl font-bold text-slate-900">Clear earnings, consistent support</h2>
              <p className="text-slate-600">
                Drivers can review their information after Google authentication, while prospective partners can learn about the
                process here.
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg shadow-indigo-100 ring-1 ring-indigo-50">
              <p className="text-sm font-semibold text-indigo-700">How it works</p>
              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="font-semibold text-slate-900">1. Visit enchocabs.com</p>
                  <p>Publicly visible landing with service details.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">2. Head to /staff</p>
                  <p>Sign in with Google to access dashboards.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">3. Manage payouts</p>
                  <p>Admins track revenue while drivers view their portal securely.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Salary;
