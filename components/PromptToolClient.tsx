"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  title: string;
  summary: string;
  promptText: string;
  imageUrl?: string | null;
};

export default function PromptToolClient({
  title,
  summary,
  promptText,
  imageUrl,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(promptText || "");
  const [showFull, setShowFull] = useState(false);

  const fallbackOrb = "/orb-neon.gif";

  const imageSrc = useMemo(() => {
    const src = (imageUrl ?? "").trim();
    return src.length > 0 ? src : fallbackOrb;
  }, [imageUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localPrompt || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {summary ? (
            <p className="mt-2 text-sm text-white/70 sm:text-base">{summary}</p>
          ) : null}
        </div>

        <Link
          href="/prompts"
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/80 hover:bg-black/50"
        >
          Back to Prompts
        </Link>
      </div>

      {/* Mobile-first stack, becomes 2 columns on lg */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: Tool panel */}
        <section className="rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Prompt Tool</h2>

            <button
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
              onClick={handleCopy}
              type="button"
            >
              {copied ? "Copied" : "Copy Prompt"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 text-xs text-white/60">
              Remix (coming next): We’ll add chat-style options like aspect ratio and model here.
            </div>

            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              className="min-h-[180px] w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="Prompt will appear here…"
            />
          </div>

          <div className="mt-4">
            <button
              className="w-full rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300"
              type="button"
              onClick={() => alert("Generator UI comes next.")}
            >
              Generate (coming next)
            </button>
          </div>

          {/* View Full Prompt dropdown */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <button
              type="button"
              onClick={() => setShowFull((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/80 hover:bg-black/50"
            >
              <span>View Full Prompt</span>
              <span className="text-white/60">{showFull ? "▲" : "▼"}</span>
            </button>

            {showFull ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
                <pre className="whitespace-pre-wrap break-words text-sm text-white/80">
                  {localPrompt || "No prompt text found yet."}
                </pre>
              </div>
            ) : null}
          </div>
        </section>

        {/* RIGHT: Preview panel */}
        <section className="rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Preview</h2>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={imageSrc}
                alt={title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold text-white/90">Summary</div>
            <div className="mt-2 text-sm text-white/70">
              {summary && summary.trim().length > 0
                ? summary
                : "No summary yet. Add one in the CMS later."}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
