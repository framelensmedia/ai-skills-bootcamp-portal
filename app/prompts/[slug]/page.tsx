"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type PromptRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  is_published: boolean | null;
};

export default function PromptPage() {
  const params = useParams();
  const rawSlug = (params?.slug ?? "") as string;

  const slug = useMemo(() => {
    return decodeURIComponent(String(rawSlug || "")).trim().toLowerCase();
  }, [rawSlug]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptRow | null>(null);

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
        .select("id, title, slug, summary, content, image_url, is_published")
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

  const imageSrc =
    prompt?.image_url && prompt.image_url.trim().length > 0
      ? prompt.image_url
      : "/orb-neon.gif";

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-white">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <div className="text-lg font-semibold">Loading prompt…</div>
          <div className="mt-2 text-sm text-white/60">Slug: {slug || "(empty)"}</div>
        </div>
      </main>
    );
  }

  if (errorMsg || !prompt) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
          <div className="text-lg font-semibold text-red-200">Prompt load failed</div>
          <div className="mt-2 text-sm text-red-200/80">{errorMsg}</div>
          <div className="mt-4 text-xs text-white/60">
            URL slug: {slug || "(empty)"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 text-white">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Visual */}
        <div className="rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
            <Image
              src={imageSrc}
              alt={prompt.title || "Prompt image"}
              fill
              className="object-cover"
              priority
            />
          </div>

          <div className="mt-5">
            <h1 className="text-2xl sm:text-3xl font-bold">{prompt.title}</h1>
            {prompt.summary ? (
              <p className="mt-2 text-white/70">{prompt.summary}</p>
            ) : null}
            <div className="mt-3 text-xs text-white/50">slug: {prompt.slug}</div>
          </div>
        </div>

        {/* Right: Tool UI feel */}
        <div className="rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Prompt</h2>

            <details className="group">
              <summary className="cursor-pointer select-none rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/80 hover:bg-black/50">
                View Full Prompt
              </summary>
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <pre className="whitespace-pre-wrap break-words text-sm text-white/80">
                  {prompt.content && prompt.content.trim().length > 0
                    ? prompt.content
                    : "No prompt content found yet."}
                </pre>
              </div>
            </details>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="w-full sm:w-auto rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
              onClick={async () => {
                await navigator.clipboard.writeText(prompt.content || "");
              }}
            >
              Copy Prompt
            </button>

            <a
              className="w-full sm:w-auto text-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
              href="/premium"
            >
              Generate (coming next)
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
