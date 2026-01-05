"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import GenerationLightbox from "@/components/GenerationLightbox";

type MediaType = "image" | "video";

const ASPECTS = ["9:16", "16:9", "1:1", "4:5", "3:4"] as const;
type AspectRatio = (typeof ASPECTS)[number];

function normalize(v: any) {
  return String(v ?? "").trim();
}

function pill(selected: boolean) {
  const base = "rounded-xl border px-4 py-2 text-sm font-semibold transition";
  const idle = "border-white/15 bg-black/40 text-white/70 hover:bg-black/55 hover:border-white/25";
  const on = "border-[#B7FF00]/50 bg-[#B7FF00]/15 text-white hover:bg-[#B7FF00]/20";
  return [base, selected ? on : idle].join(" ");
}

async function copyToClipboard(text: string) {
  const t = normalize(text);
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    // no-op
  }
}

export default function StudioPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const sp = useSearchParams();

  // Prefill from Remix flow
  const preImg = normalize(sp?.get("img"));
  const preOriginal = normalize(sp?.get("original"));
  const preRemix = normalize(sp?.get("remix"));
  const legacyPrefill = normalize(sp?.get("prefill"));

  // Optional context
  const prePromptId = normalize(sp?.get("promptId"));
  const prePromptSlug = normalize(sp?.get("promptSlug"));

  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  const [previewImageUrl, setPreviewImageUrl] = useState<string>("/orb-neon.gif");

  // Studio prompt model
  const [originalPrompt, setOriginalPrompt] = useState<string>("");
  const [remixAdditions, setRemixAdditions] = useState<string>("");

  const combinedPrompt = useMemo(() => {
    const a = normalize(originalPrompt);
    const b = normalize(remixAdditions);
    return [a, b].filter(Boolean).join("\n\n");
  }, [originalPrompt, remixAdditions]);

  // Output
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // “View full prompt” expand
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (preImg) setPreviewImageUrl(preImg);

    if (preOriginal || preRemix) {
      setOriginalPrompt(preOriginal);
      setRemixAdditions(preRemix);
      return;
    }

    if (legacyPrefill) {
      setOriginalPrompt(legacyPrefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeLightbox() {
    setLightboxOpen(false);
  }

  function handleShare(url: string) {
    console.log("Share clicked (placeholder):", url);
  }

  // ✅ Updated to match GenerationLightbox new onRemix payload
  function handleRemix(payload: {
    imgUrl: string;
    originalPromptText: string;
    remixPromptText: string;
    combinedPromptText: string;
  }) {
    const href =
      `/studio?img=${encodeURIComponent(payload.imgUrl)}` +
      `&original=${encodeURIComponent(payload.originalPromptText || "")}` +
      `&remix=${encodeURIComponent(payload.remixPromptText || "")}`;

    router.push(href);
    setLightboxOpen(false);
  }

  async function handleCopyPrompt() {
    await copyToClipboard(combinedPrompt || originalPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function handleGenerate() {
    setGenError(null);

    if (mediaType === "video") {
      setGenError("Video generation is not wired yet. Switch to Image for now.");
      return;
    }

    const finalPrompt = normalize(combinedPrompt || originalPrompt);
    if (!finalPrompt) {
      setGenError("Add an original prompt and optionally remix additions first.");
      return;
    }

    setGenerating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setGenError("Please log in to generate.");
        setGenerating(false);
        return;
      }

      const form = new FormData();

      // What Vertex uses
      form.append("prompt", finalPrompt);
      form.append("userId", user.id);
      form.append("aspectRatio", aspectRatio);

      // ✅ Persist standardized fields for DB insert in /api/generate
      form.append("originalPrompt", normalize(originalPrompt));
      form.append("remixAdditions", normalize(remixAdditions));
      form.append("combinedPromptText", finalPrompt);

      if (prePromptId) form.append("promptId", prePromptId);
      if (prePromptSlug) form.append("promptSlug", prePromptSlug);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (!res.ok) {
        setGenError(json?.message || json?.error || "Failed to generate.");
        setGenerating(false);
        return;
      }

      const imageUrl = normalize(json?.imageUrl);
      if (!imageUrl) {
        setGenError("No imageUrl returned.");
        setGenerating(false);
        return;
      }

      setLastImageUrl(imageUrl);
      setLightboxOpen(true);
    } catch (e: any) {
      setGenError(e?.message || "Failed to generate.");
    } finally {
      setGenerating(false);
    }
  }

  const combinedForUI = normalize(combinedPrompt || originalPrompt);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
      <GenerationLightbox
        open={lightboxOpen}
        url={lastImageUrl}
        onClose={closeLightbox}
        originalPromptText={normalize(originalPrompt)}
        remixPromptText={normalize(remixAdditions)}
        combinedPromptText={combinedForUI}
        onShare={handleShare}
        onRemix={handleRemix}
      />

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prompt Studio</h1>
        <p className="mt-2 text-sm text-white/70 sm:text-base">
          Remix an existing prompt or build from scratch. Generate, save, and reuse winners.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: Prompt Tool (match Prompt Remix layout) */}
        <div className="rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold">Prompt Tool</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-black/60"
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className={[
                  "rounded-xl px-5 py-2 text-sm font-semibold text-black transition",
                  generating ? "cursor-not-allowed bg-[#B7FF00]/50" : "bg-[#B7FF00] hover:opacity-90",
                ].join(" ")}
              >
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>

          {/* View full prompt (click to expand) */}
          <button
            type="button"
            onClick={() => setShowFullPrompt((v) => !v)}
            className="mt-5 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-left hover:border-white/20"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/80">
                View full prompt <span className="ml-2 text-xs font-normal text-white/40">(click to expand)</span>
              </div>
              <div className="text-xs text-white/50">{showFullPrompt ? "Hide" : "Show"}</div>
            </div>

            {showFullPrompt ? (
              <div className="mt-3 whitespace-pre-wrap text-sm text-white/75">
                {combinedForUI || "Nothing yet."}
              </div>
            ) : null}
          </button>

          {/* Remix */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Remix</div>
            <p className="mt-2 text-sm text-white/55">
              Describe what you want to change. We’ll use this to auto-remix the prompt.
            </p>

            <textarea
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/85 outline-none placeholder:text-white/35 focus:border-white/25"
              rows={6}
              placeholder="Example: Make this 9:16 TikTok style, neon accent lighting, more urgency, include a CTA..."
              value={remixAdditions}
              onChange={(e) => setRemixAdditions(e.target.value)}
            />
          </div>

          {/* Generator Settings */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Generator Settings</div>
              <div className="text-xs text-white/45">
                Selected: {mediaType.toUpperCase()} · {aspectRatio}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={pill(mediaType === "image")} onClick={() => setMediaType("image")}>
                Image
              </button>
              <button type="button" className={pill(mediaType === "video")} onClick={() => setMediaType("video")}>
                Video
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ASPECTS.map((a) => (
                <button key={a} type="button" className={pill(aspectRatio === a)} onClick={() => setAspectRatio(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Remixes (placeholder like Prompt Remix UI) */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Remixes</div>
              <div className="text-xs text-white/45">0</div>
            </div>
            <p className="mt-2 text-sm text-white/55">No remixes yet. Generate one to start building your library.</p>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/20 hover:bg-black/55"
              onClick={() => router.push("/library")}
            >
              View all remixes
            </button>
          </div>

          {genError ? (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
              {genError}
            </div>
          ) : null}

          {/* Original prompt (kept, but not the main UI) */}
          <div className="mt-6">
            <div className="text-xs font-semibold text-white/55">Original prompt</div>
            <textarea
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/85 outline-none placeholder:text-white/35 focus:border-white/25"
              rows={5}
              placeholder="Paste the original prompt here..."
              value={originalPrompt}
              onChange={(e) => setOriginalPrompt(e.target.value)}
            />
          </div>
        </div>

        {/* RIGHT: Preview panel */}
        <div className="rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="text-sm font-semibold">Preview</div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <div className="relative aspect-[4/5] w-full bg-black">
              <Image src={lastImageUrl || previewImageUrl} alt="Preview" fill className="object-cover" priority={false} />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-white/70">Combined prompt</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-white/80">
              {combinedForUI || "Nothing yet."}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1">Type: {mediaType}</div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1">Aspect: {aspectRatio}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
