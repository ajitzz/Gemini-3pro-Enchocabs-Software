// components/hero/ExplorePremiumSection.tsx
"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * ExplorePremiumSection
 * - Reusable CTA section for the Hero
 * - Premium button with spotlight follow + ripple press effect
 * - Palette: #7a8fa6, white, black, gray only
 * - Framer Motion entrance (fade/scale)
 * - Accessible focus states + hardened event guards
 */

const easeOut: number[] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: easeOut as any } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.98 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.32, ease: easeOut as any } },
};

// ---- Pointer utilities (safe across pointer/mouse/touch) -------------------
type AnyEvt =
  | React.PointerEvent<HTMLAnchorElement>
  | React.MouseEvent<HTMLAnchorElement>
  | React.TouchEvent<HTMLAnchorElement>;

function isPointerEvent(e: AnyEvt): e is React.PointerEvent<HTMLAnchorElement> {
  return typeof e === "object" && e !== null && "pointerType" in (e as any);
}
function isTouchEvent(e: AnyEvt): e is React.TouchEvent<HTMLAnchorElement> {
  return typeof e === "object" && e !== null && "touches" in (e as any);
}
function getEl(e: AnyEvt): HTMLAnchorElement | null {
  const el = (e as any).currentTarget as HTMLAnchorElement | null | undefined;
  if (!el) return null;
  if (typeof (el as any).getBoundingClientRect !== "function") return null;
  return el;
}
function getRelativePoint(e: AnyEvt, el: HTMLAnchorElement) {
  const rect = el.getBoundingClientRect();
  let clientX = 0;
  let clientY = 0;

  if (isPointerEvent(e)) {
    clientX = e.clientX;
    clientY = e.clientY;
  } else if (isTouchEvent(e)) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    clientX = t?.clientX ?? 0;
    clientY = t?.clientY ?? 0;
  } else {
    const m = e as React.MouseEvent<HTMLAnchorElement>;
    clientX = m.clientX;
    clientY = m.clientY;
  }
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// ---- Premium CTA Button (internal) -----------------------------------------
function CTAButton({ href, children }: { href: string; children: React.ReactNode }) {
  const keyRef = useRef(0);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  const handleMove = (e: AnyEvt) => {
    const el = getEl(e);
    if (!el) return;
    const { x, y } = getRelativePoint(e, el);
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
  };

  const handleDown = (e: AnyEvt) => {
    const el = getEl(e);
    if (!el) return;
    const { x, y } = getRelativePoint(e, el);
    setRipple({ x, y, key: ++keyRef.current });
    setTimeout(() => setRipple(null), 650);
  };

  return (
    <motion.a
      initial="hidden"
      animate="show"
      variants={scaleIn}
      href={href}
      aria-label="Explore performance"
      onPointerMove={handleMove}
      onMouseMove={handleMove}
      onTouchMove={handleMove}
      onPointerDown={handleDown}
      onMouseDown={handleDown}
      onTouchStart={handleDown}
      className={[
        "group relative inline-flex select-none items-center justify-center",
        "rounded-2xl px-6 py-3 text-base font-semibold tracking-tight",
        "text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        "active:scale-[0.98] transition-transform",
      ].join(" ")}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Gradient ring */}
      <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#7a8fa6] via-gray-200 to-white p-[1px]" />

      {/* Spotlight that follows pointer/touch */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(600px 200px at var(--mx, 50%) var(--my, 50%), rgba(122,143,166,0.22), transparent 60%)",
        }}
      />

      {/* Button surface */}
      <span className="relative z-10 flex w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-b from-black to-gray-900 px-6 py-3 shadow-[0_10px_30px_rgba(122,143,166,0.35)]">
        <Sparkles className="h-4 w-4 shrink-0 animate-pulse" />
        <span className="bg-[linear-gradient(90deg,#7a8fa6,50%,#ffffff,85%,#9ca3af)] bg-clip-text text-transparent [background-size:200%_auto] group-hover:[animation:shine_2s_linear_infinite]">
          {children}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 translate-x-0 transition-transform duration-300 group-hover:translate-x-1" />
      </span>

      {/* Ambient halo */}
      <span className="pointer-events-none absolute inset-0 -z-10 rounded-3xl blur-2xl [background:radial-gradient(60%_80%_at_50%_10%,rgba(122,143,166,0.35),transparent_60%)]" />

      {/* Ripple */}
      {ripple && (
        <span
          key={ripple.key}
          data-testid="cta-ripple"
          aria-hidden
          className="pointer-events-none absolute aspect-square w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 opacity-0 [animation:ripple_650ms_ease-out]"
          style={{ left: ripple.x, top: ripple.y }}
        />
      )}

      <style>{`
        @keyframes shine { 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
        @keyframes ripple { from { transform: translate(-50%,-50%) scale(.2); opacity:.45 } to { transform: translate(-50%,-50%) scale(2.2); opacity:0 } }
        @media (prefers-reduced-motion: reduce) {
          .group:hover [style*="background-position"] { animation: none !important; }
        }
      `}</style>
    </motion.a>
  );
}

// ---- Public Component -------------------------------------------------------
export interface ExplorePremiumSectionProps {
  /** Primary button href (default: "/performance") */
  href?: string;
  /** Primary button label (default: "Explore Performance") */
  label?: string;
  /** Show secondary Learn more link */
  showSecondary?: boolean;
  /** Optional additional container classes */
  className?: string;
  /** Secondary link href (default: "#features") */
  secondaryHref?: string;
}

export default function ExplorePremiumSection({
  href = "/performance",
  label = "Our Drivers Performance", // default kept for existing tests
  showSecondary = true,
  className = "",
  secondaryHref = "#features",
}: ExplorePremiumSectionProps) {
  return (
    <motion.div
      variants={fadeUp}
      role="group"
      aria-label="Explore Premium CTA"
      className={["flex flex-col items-center justify-center gap-4 sm:flex-row", className].join(" ")}
    >
      <CTAButton href={href}>{label}</CTAButton>

      {showSecondary && (
        <a
          href={secondaryHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Learn more
        </a>
      )}
    </motion.div>
  );
}
