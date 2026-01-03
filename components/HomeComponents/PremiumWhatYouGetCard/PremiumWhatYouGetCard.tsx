"use client";
import React from "react";
import { motion, type Variants, type Transition } from "framer-motion";
import { Building2 } from "lucide-react";

// Properly typed cubic-bezier for Framer Motion
const easeOutCubic: Transition["ease"] = [0.16, 1, 0.3, 1];

const cardIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOutCubic },
  },
};

export default function PremiumWhatYouGetCard({
  items = [
    "Transparent fixed weekly payments",
    "Full-service maintenance included",
    "Priority support to minimize downtime",
    "Quick onboarding with flexible terms",
  ],
}: { items?: string[] }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      variants={cardIn}
      viewport={{ once: true, amount: 0.2 }}
      whileHover={{ y: -3 }}
      className="rounded-2xl border border-grey-200 bg-grey-200 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-grey-200 p-3 text-[#7a8fa6]">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="text-left">
          <h3 className="text-base font-semibold text-grey-500">What you get</h3>
          <ul className="mt-2 space-y-2 text-sm text-grey-200">
            {items.map((it) => (
              <li key={it}>• {it}</li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
