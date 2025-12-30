"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type PromptRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  category: string | null;
  is_published: boolean | null;
  created_at: string | null;
};

export default function PromptPage() {
  const params = useParams();
  const router = useRouter();

  const rawSlug = (params?.slug ?? "") as string;

  const slug = useMemo(() => {
    return decodeURIComponent(String(rawSlug || "")).trim().toLowerCase();
  }, [rawSlug]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptRow | null>(null);

  const [remixInput, setRemixInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!slug) {
        setLoading(false);
        setErrorMsg("Missing slug in URL.");
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("prompts")
        .select(
          "id, title, slug, summary, content, image_url, category, is_published, created_at"
        )
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setPrompt(null);
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setPrompt(null);
        setErrorMsg("No prompt found for this slug.");
        setLoading(false);
        return;
      }

      setPrompt(data as PromptRow);
      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const fullPromptText = useMemo(() => {
    return (prompt?.content ?? "").toString();
  }, [prompt]);

  const imageSrc = useMemo(() => {
    const url = (prompt?.image_url ?? "").toString().trim();
    return url.length > 0 ? url : "/orb-neon.gif";
  }, [prompt]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullPromptText || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 text-white">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="text-lg font-semibold">Loading prompt…</div>
          <div className="mt-2 text-sm text-white/60">Slug: {slug || "(empty)"}</div>
        </div>
      </main>
    );
  }

  if (errorMsg || !prompt) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 text-white">
        <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-6">
          <div className="text-lg font-semibold text-red-200">Prompt load failed</div>
          <div className="mt-2 text-sm text-red-200/80">{errorMsg}</div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
              onClick={() => router.push("/prompts")}
            >
              Back to Prompts
            </button>
          </div>

          <div className="mt-4 text-xs text-white/60">URL slug: {slug || "(empty)"}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
      {/* Header */}
      <div className="mb-5 sm:mb-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
              {prompt.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70 sm:text-base">
              {prompt.summary && prompt.summary.trim().length > 0
                ? prompt.summary
                : "Open the full prompt, remix it, and generate output (image/video) right here."}
            </p>
          </div>

          <button
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50 sm:mt-0 sm:w-auto"
            onClick={() => router.push("/prompts")}
          >
            Back to Prompts
          </button>
        </div>
      </div>

      {/* Two-column layout
          Mobile: Preview first, Tool second
          Desktop: Tool left, Preview right
      */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* PREVIEW PANEL — TOP ON MOBILE, RIGHT ON DESKTOP */}
        <section className="order-1 lg:order-2 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
            <Image src={imageSrc} alt={prompt.title} fill className="object-cover" priority />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
              {(prompt.category ?? "general").toString().toUpperCase()}
            </span>

            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/50">
              SLUG: {prompt.slug}
            </span>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Preview</div>
            <p className="mt-2 text-sm text-white/65">
              This panel becomes your “example output” area. For now it shows the featured image (or orb fallback).
            </p>
          </div>
        </section>

        {/* TOOL PANEL — BELOW ON MOBILE, LEFT ON DESKTOP */}
        <section className="order-2 lg:order-1 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-lg font-semibold">Prompt Tool</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
                onClick={handleCopy}
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>

              <button
                className="inline-flex items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                onClick={() => alert("Next step: wire Nano Banana generation here.")}
              >
                Generate
              </button>
            </div>
          </div>

          {/* Full prompt dropdown */}
          <div className="mt-4">
            <details className="group rounded-2xl border border-white/10 bg-black/30 p-4">
              <summary className="cursor-pointer select-none list-none text-sm font-semibold text-white/85">
                View full prompt
                <span className="ml-2 text-xs text-white/50">(click to expand)</span>
              </summary>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
                <pre className="whitespace-pre-wrap break-words text-sm text-white/80">
                  {fullPromptText && fullPromptText.trim().length > 0
                    ? fullPromptText
                    : "No prompt content found yet. Add it to the content column in Supabase."}
                </pre>
              </div>
            </details>
          </div>

          {/* Remix (chat-style input) */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Remix</div>
            <p className="mt-2 text-sm text-white/60">
              Describe what you want to change. We’ll use this to auto-remix the prompt (next step).
            </p>

            <textarea
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
              rows={4}
              placeholder="Example: Make this 9:16 TikTok style, neon accent lighting, more urgency, include a CTA..."
              value={remixInput}
              onChange={(e) => setRemixInput(e.target.value)}
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-white/45">
                Coming next: Remix button generates a new prompt version.
              </div>

              <button
                className="rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm hover:bg-black/50"
                onClick={() => alert("Next step: call remix logic here.")}
              >
                Remix Prompt
              </button>
            </div>
          </div>

          {/* Generator options (restored) */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Generator Settings</div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectPill label="Image" />
              <SelectPill label="Video" disabled />
              <SelectPill label="9:16" />
              <SelectPill label="16:9" />
            </div>

            <div className="mt-3 text-xs text-white/45">
              Next step: Wire Nano Banana for Image generation, and keep Video disabled for V1.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SelectPill({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "rounded-xl border px-3 py-2 text-sm text-left",
        disabled
          ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
          : "border-white/15 bg-black/40 text-white/80 hover:bg-black/55 hover:border-white/25",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
