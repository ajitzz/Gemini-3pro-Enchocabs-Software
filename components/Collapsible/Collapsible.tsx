"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";


export interface CollapsibleProps {
  defaultContent: string;
  className?: string;
  previewSentences?: number;

}

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return parts ? parts.map((t) => t.trim()) : [text];
}

function CollapsibleCopy({
  text,
  previewSentences = 7,
}: {
  text: string;
  previewSentences?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const sentences = splitSentences(text);
  const preview = sentences.slice(0, previewSentences).join(" ");
  const rest = sentences.slice(previewSentences).join(" ");

  return (
    <div className="flex min-h-[220px] flex-col">
      <motion.div layout className="relative text-left">
        <AnimatePresence initial={false} mode="wait">
          {!expanded ? (
            <motion.p
              key="preview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-black/80"
            >
              {preview}
            </motion.p>
          ) : (
            <motion.p
              key="full"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-black/90"
            >
              {text}
            </motion.p>
          )}
        </AnimatePresence>


        {!expanded && rest && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
        )}
      </motion.div>

      {/* Bottom action */}
      {rest && (
        <div className="mt-6">
          <button
            onClick={() => setExpanded((s) => !s)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/5 px-5 py-2.5 text-sm font-medium text-black/90 backdrop-blur transition hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        </div>
      )}
    </div>
  );
}



export default function Collapsible({
  defaultContent,
  className,
  previewSentences,
}: CollapsibleProps) {

  return (
   <div className={`flex flex-col gap-6 ${className}`}>
      <CollapsibleCopy text={defaultContent} previewSentences={previewSentences} />
    </div>
  );
}
