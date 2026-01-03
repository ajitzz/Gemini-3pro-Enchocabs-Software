import React from 'react';

const stats = [
  { label: 'Cities served', value: '25+' },
  { label: 'Drivers supported', value: '400+' },
  { label: 'Avg. response time', value: '6 min' },
  { label: 'On-time rides', value: '98%' },
];

const Numbers: React.FC = () => {
  return (
    <section className="bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Numbers</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Our network at a glance</h2>
          <p className="mt-3 text-slate-600">A reliable fleet powered by secure staff operations.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white p-6 text-center shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
              <p className="text-3xl font-extrabold text-indigo-600">{stat.value}</p>
              <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Numbers;
