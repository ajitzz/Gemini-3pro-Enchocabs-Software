import React from 'react';

const PartTime: React.FC = () => {
  return (
    <section className="bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-indigo-800 px-8 py-10 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">Opportunities</p>
              <h3 className="mt-2 text-2xl font-bold">Join as a part-time driver</h3>
              <p className="mt-3 max-w-2xl text-slate-200">
                Start the conversation from this public page and complete onboarding securely once you receive a staff invitation.
              </p>
            </div>
            <a
              href="mailto:info@enchocabs.com"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/20 transition hover:bg-indigo-50"
            >
              Contact us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PartTime;
