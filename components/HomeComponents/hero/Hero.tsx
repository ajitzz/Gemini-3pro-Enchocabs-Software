import { Clock3, ShieldCheck, TrendingUp } from "lucide-react";
import ExplorePremiumSection from "./ExplorePremiumSection";
import s from './Hero.module.css';

const HERO_IMAGE = "https://i.ibb.co/35gNhtCp/Chat-GPT-Image-Sep-15-2025-at-04-22-48-AM.png";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Driver-first policies",
    copy: "Safety gear, vetted vehicles, and quick support whenever you need it.",
  },
  {
    icon: Clock3,
    title: "Faster onboarding",
    copy: "Start earning in under 48 hours with guided setup and app training.",
  },
  {
    icon: TrendingUp,
    title: "Transparent earnings",
    copy: "Live dashboards and weekly summaries keep your take-home predictable.",
  },
];

export default function Hero() {
  return (
    <section
      id="hero"
      className={`relative isolate flex min-h-[80vh] flex-col justify-between overflow-hidden bg-neutral-950 text-white`}
      aria-label="ENCHO Hero"
    >
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(12,12,12,0.3), rgba(12,12,12,0.78)), url(${HERO_IMAGE})`,
        }}
        aria-hidden
      />

  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-950/95 via-neutral-950/60 to-transparent" aria-hidden />

      <div className="container relative flex w-full flex-1 flex-col items-center justify-center gap-10 py-20 text-center sm:py-24">
         <div className=" h-full releative  container">
  <div className={s.eyebrow}>Taxi Rental • Accommodation • Food • Vehicles</div>

<h1 className={s.h1}>THE FUTURE OF <span className={s.accent}>DRIVING</span> IS HERE</h1>
        <p className={s.lead}>Discover a safer, higher-earning taxi rental experience with ENCHO.</p>
        <div className="mt-10 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map(({ icon: Icon, title, copy }) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left backdrop-blur transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner shadow-black/30 ring-1 ring-white/10">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="text-xs text-white/70 sm:text-sm">{copy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="container relative flex justify-center pb-12 sm:pb-16">
        <ExplorePremiumSection label="Our Drivers Earnings" href="/performance" showSecondary={false} />
      </div>
    </section>


    
  );
}

// <section id="hero" className={`${inter.variable} ${poppins.variable} ${s.hero}`} aria-label="ENCHO Hero">
//       <div className=" h-full releative  container">
//       <div className='absolute bottom-1/2 left-0 right-0'>

       
       
 
//       </div>