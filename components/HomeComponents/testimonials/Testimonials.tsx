import React from 'react';

type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

interface TestimonialsProps {
  items?: Testimonial[];
  autoplay?: boolean;
  interval?: number;
}

const defaultTestimonials: Testimonial[] = [
  {
    quote: 'The new homepage lets prospects learn about us quickly while keeping our dashboards secure.',
    name: 'Priya',
    role: 'Operations',
  },
  {
    quote: 'Routing drivers to /staff/portal keeps things organized and easy to explain.',
    name: 'Karan',
    role: 'Fleet supervisor',
  },
];

const Testimonials: React.FC<TestimonialsProps> = ({ items }) => {
  const testimonials = items && items.length > 0 ? items : defaultTestimonials;

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Testimonials</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">What our team says</h2>
          <p className="mt-3 text-slate-600">Thoughtful separation between public and staff spaces keeps everyone happy.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
              <p className="text-slate-800">“{testimonial.quote}”</p>
              <div className="mt-4 text-sm font-semibold text-slate-900">{testimonial.name}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{testimonial.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
