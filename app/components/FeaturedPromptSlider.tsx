"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FeaturedPrompt = {
  title: string;
  category: string;
  access: "FREE" | "PRO";
  href: string;
  summary?: string;
};

export default function FeaturedPromptSlider({
  items,
  intervalMs = 4500,
}: {
  items: FeaturedPrompt[];
  intervalMs?: number;
}) {
  const safeItems = useMemo(() => (items || []).filter(Boolean), [items]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (safeItems.length <= 1) return;

    const t = setInterval(() => {
      setIdx((v) => (v + 1) % safeItems.length);
    }, intervalMs);

    return () => clearInterval(t);
  }, [safeItems.length, intervalMs]);

  if (!safeItems.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-muted to-black/50" />
        <div className="mt-4 rounded-xl border border-border bg-popover p-3">
          <p className="text-xs text-muted-foreground">Featured prompts</p>
          <p className="mt-1 text-sm font-semibold text-foreground">Coming soon</p>
        </div>
      </div>
    );
  }

  const item = safeItems[idx];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {/* Top “image” area */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br from-muted to-black/50">
        {/* subtle overlay label */}
        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/80">
          Featured Prompt
        </div>

        {/* dots */}
        {safeItems.length > 1 ? (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            {safeItems.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Go to featured prompt ${i + 1}`}
                className={[
                  "h-1.5 w-6 rounded-full border border-border transition",
                  i === idx ? "bg-primary/70" : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                ].join(" ")}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="mt-4 rounded-xl border border-border bg-popover p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-primary">{item.category}</p>

          <span
            className={[
              "rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide",
              item.access === "PRO"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground",
            ].join(" ")}
          >
            {item.access}
          </span>
        </div>

        <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>

        {item.summary ? (
          <p className="mt-2 text-xs text-muted-foreground">{item.summary}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Rotate: Auto</span>

          <Link
            href={item.href}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Open →
          </Link>
        </div>

        {/* Controls */}
        {safeItems.length > 1 ? (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIdx((v) => (v - 1 + safeItems.length) % safeItems.length)}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Prev
            </button>

            <button
              type="button"
              onClick={() => setIdx((v) => (v + 1) % safeItems.length)}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
