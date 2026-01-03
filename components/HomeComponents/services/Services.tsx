import React from 'react';

const services = [
  {
    name: 'City pickups',
    detail: 'Reliable airport and city transfers with courteous drivers.',
  },
  {
    name: 'Fleet management',
    detail: 'Track performance, payouts, and compliance from one dashboard.',
  },
  {
    name: 'Driver support',
    detail: 'Guides and resources to keep every ride smooth and safe.',
  },
];

const Services: React.FC = () => {
  return (
    <section className="bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Services</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Built for riders and teams alike</h2>
          <p className="mt-3 text-slate-600">Modern tools for customers on the surface and secure operations behind the scenes.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <div key={service.name} className="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/70 ring-1 ring-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">{service.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{service.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
