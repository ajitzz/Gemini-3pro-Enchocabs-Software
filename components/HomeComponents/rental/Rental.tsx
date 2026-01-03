import Collapsible from "@/components/Collapsible/Collapsible";
import PremiumWhatYouGetCard from "@/components/PremiumWhatYouGetCard/PremiumWhatYouGetCard";
export default function Rental() {
  const defaultContent = `Our Rental Plan is engineered for drivers who want reliability and simplicity. Pay a fixed, predictable weekly fee that covers the vehicle, scheduled maintenance, and essential support. No hidden fees. No surprises. Whether you’re scaling your hours or optimizing routes, the Rental Plan helps you stay focused on driving and earning—while we handle the rest. Enjoy flexible terms designed to maximize uptime. Get responsive assistance when you need it most. Experience a premium vehicle setup that elevates every ride. Benefit from clear terms, quick onboarding, and continuous support that keeps you moving.`;
  return (
 <section id="rental" className="bg-white py-20 text-neutral-900 sm:py-24" aria-label="Rental Plan">
      <div className="container space-y-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-500">Rental Plan</p>
            <h2 className="text-3xl font-semibold text-neutral-900 sm:text-4xl">Predictable driving, premium support</h2>
              <Collapsible
  defaultContent={defaultContent}
  className="text-base text-neutral-700"
  previewSentences={5}
/>

          </div>
 <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-lg transition-transform duration-500 ease-out hover:-translate-y-1">
              <iframe
                src="https://www.youtube.com/embed/4BiAYfkFkyI"
                title="Rental Plan Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="aspect-[9/16] w-full"
              />
            </div>
</div>
      

        </div>

 <div className="rounded-3xl border border-neutral-200 bg-neutral-50/60 p-6 shadow-sm transition hover:shadow-lg sm:p-10">
          <PremiumWhatYouGetCard />
        </div>
         </div>
    </section>
  );
}
