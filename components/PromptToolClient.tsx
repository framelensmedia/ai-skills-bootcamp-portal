"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type Props = {
  title: string;
  summary: string;
  promptText: string;
  imageUrl?: string | null;
  isLocked: boolean;
};

export default function PromptToolClient({
  title,
  summary,
  promptText,
  imageUrl,
  isLocked,
}: Props) {
  const [copied, setCopied] = useState(false);
  const fallbackOrb = "/orb-neon.gif";

  const handleCopy = async () => {
    if (isLocked) return;
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {summary && (
            <p className="mt-2 text-sm text-white/70">
              {summary}
            </p>
          )}
        </div>

        <Link
          href="/prompts"
          className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
        >
          Back to Prompts
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* TOOL */}
        <section className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">
              Prompt Tool
            </h2>

            {!isLocked && (
              <button
                onClick={handleCopy}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm"
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>
            )}
          </div>

          <div className="mt-4">
            {isLocked ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
                <div className="text-lg font-semibold">
                  Premium Prompt
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Upgrade to unlock the full prompt and
                  generator.
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-block rounded-xl bg-lime-400 px-5 py-3 text-sm font-semibold text-black"
                >
                  Upgrade to Premium
                </Link>
              </div>
            ) : (
              <textarea
                value={promptText}
                readOnly
                className="min-h-[220px] w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm"
              />
            )}
          </div>
        </section>

        {/* PREVIEW */}
        <section className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <h2 className="text-lg font-semibold">
            Preview
          </h2>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <div className="relative aspect-[16/10]">
              <Image
                src={imageUrl || fallbackOrb}
                alt={title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
