const PARALLAX_IMAGE = "https://i.ibb.co/Wpz0kZD3/father-throwing-up-son.jpg";


export default function Parallax() {
  return (
 <section
      id="parallax"
      className="relative isolate overflow-hidden bg-neutral-900 py-20 text-neutral-100 sm:py-28"
      aria-label="Family Support Parallax"
    >
      <div
        className="absolute inset-0 -z-10 bg-fixed bg-cover bg-center opacity-80 sm:opacity-100"
        style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.6), rgba(10,10,10,0.8)), url(${PARALLAX_IMAGE})` }}
        aria-hidden
      />

      <div className="container relative">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center">
          <div className="rounded-3xl border border-white/10 bg-black/50 p-8 backdrop-blur-md transition hover:border-white/20">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-Gray-300/90">Support</p>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              We build a stable life while you drive
            </h2>
            <p className="mt-5 text-base leading-relaxed text-neutral-200 sm:text-lg">
              Accommodation, meals, and safe vehicles — all in one plan. Our driver-first programs help you focus on earning while
              we support your family’s comfort.
            </p>
            <a
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              href="#apply"
            >
              Contact us <i className="fa-solid fa-arrow-right" />
            </a>
          </div>
        </div>
       
      </div>
    </section>
  );
}
