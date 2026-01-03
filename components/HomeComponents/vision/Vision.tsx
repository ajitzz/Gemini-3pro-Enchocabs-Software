import Image from "next/image";
import type { CSSProperties } from "react";

const VISION_BG = "#050505";
const VISION_IMAGE = "https://i.ibb.co/XfHN0qfB/Adobe-Express-file.png";
const sectionStyle = { "--vision-bg": VISION_BG } as CSSProperties;

export default function Vision() {  return (
  <section
      id="vision"
      className="relative overflow-hidden bg-[--vision-bg] py-20 text-neutral-100 sm:py-24"
      aria-label="Vision"
      style={sectionStyle}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-32 h-32 bg-gradient-to-b from-transparent via-neutral-950/40 to-[--vision-bg]" aria-hidden />

      <div className="container relative">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300/80">Vision</p>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              We’re Changing the Way the World Thinks About <span className="text-gray-400">DRIVING</span>
            </h2>
            <div className="space-y-5 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 via-white/0 to-white/5 p-6 text-sm leading-relaxed text-neutral-200 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.75)] sm:text-base">
              <p>
                I&apos;m a paragraph. Click here to add your own text and edit me. It&apos;s easy. Just click “Edit Text” or double
                click me to add your own content and make changes to the font.
              </p>
              <p>
                Use this space to describe your driver-first approach: accommodation, healthy meals, safety training, reliable
                vehicles, and transparent settlements so drivers can earn more with less stress.
              </p>
            </div>
          </div>
        

         <div className="relative flex justify-center lg:justify-end">
            <div className="relative inline-flex max-w-xl items-center justify-center  bg-[--vision-bg] p-4 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.85)]">
              <div className="overflow-hidden rounded-3xl  ">
                <Image
                  className="h-full w-full  object-cover"
                  src={VISION_IMAGE}
                  alt="Car render"
                  width={720}
                  height={480}
                  priority={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
