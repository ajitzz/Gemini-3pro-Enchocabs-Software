import { Car, Headset, HeartHandshake, Route } from "lucide-react";

const serviceHighlights = [
  {
    icon: Car,
    title: "Modern fleet, zero surprises",
    copy: "Clean, fully-serviced cars with transparent rental terms and insurance built in.",
  },
  {
    icon: Headset,
    title: "Human help—fast",
    copy: "A support specialist is one tap away for payouts, maintenance, or rider issues.",
  },
  {
    icon: Route,
    title: "Routes that earn more",
    copy: "Guided onboarding plus weekly tips on high-demand zones tailored to your schedule.",
  },
  {
    icon: HeartHandshake,
    title: "Wellbeing baked in",
    copy: "Rest stops, nutritious meals, and safety refreshers so long shifts stay healthy.",
  },
];

export default function Services() {
  return (
    <section
      id="services"
      className="flex flex-col items-center justify-center bg-white py-20 text-neutral-900 sm:py-24"
      aria-label="Services"
    >
      <div className="container space-y-10">
        <div className="mx-auto max-w-3xl space-y-4 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-500">Services</p>
          <h3 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
            Environment where Driving feel valued and supported
          </h3>
          <p className="text-base text-neutral-600 sm:text-lg">
            Flexible vehicle plans, predictable pricing, and a dedicated support team keep drivers focused on earning more with
            less stress. Every touchpoint is optimised for clarity and comfort.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {serviceHighlights.map(({ icon: Icon, title, copy }) => (
            <article
              key={title}
              className="h-full rounded-2xl border border-neutral-200 bg-neutral-50/70 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <Icon className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-semibold text-neutral-900">{title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
