import ExplorePremiumSection from "./ExplorePremiumSection";
import { Inter, Poppins } from "next/font/google";
import s from './Hero.module.css';
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-poppins" });

const HERO_IMAGE = "https://i.ibb.co/35gNhtCp/Chat-GPT-Image-Sep-15-2025-at-04-22-48-AM.png";

export default function Hero() {
  return (
    <section
      id="hero"
      className={`${inter.variable} ${poppins.variable} relative isolate flex min-h-[80vh] flex-col justify-between overflow-hidden bg-neutral-950 text-white`}
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