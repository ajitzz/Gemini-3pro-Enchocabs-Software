import React from 'react';

const highlights = [
  {
    title: 'Always available',
    description: 'Passengers can browse the landing page without an account while your staff tools stay protected.',
  },
  {
    title: 'Secure sign-in',
    description: 'Admins and drivers authenticate with Google from the /staff area, keeping access under control.',
  },
  {
    title: 'Clear separation',
    description: 'Public content lives at the root domain and operational dashboards are tucked behind /staff routes.',
  },
];

const Vision: React.FC = () => {
  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-10 space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Our vision</p>
          <h2 className="text-3xl font-bold sm:text-4xl">Welcome everyone, protect what matters</h2>
          <p className="text-slate-600">Simple routing makes it easy for the public to learn about Encho Cabs while staff sign in securely.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-indigo-700">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-700">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Vision;
