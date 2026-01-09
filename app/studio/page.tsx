"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import RemixChatWizard, { RemixAnswers } from "@/components/RemixChatWizard";
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

function StudioContent() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const sp = useSearchParams();

  // Prefill from Remix flow
  const preImg = normalize(sp?.get("img"));
  // Legacy params kept for compatibility, but mainly we use the wizard now

  // Optional context
  const prePromptId = normalize(sp?.get("promptId"));
  const prePromptSlug = normalize(sp?.get("promptSlug"));

  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  const [previewImageUrl, setPreviewImageUrl] = useState<string>("/orb-neon.gif");

  // ✅ New flow state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [remixAnswers, setRemixAnswers] = useState<RemixAnswers | null>(null);
  const [editSummary, setEditSummary] = useState<string>("");

  // Kept for fallback copy? Or should I just use editSummary?
  // "The prompt field... edit-instruction summary". So editSummary is the source of truth.

  // Interaction State
  const [manualMode, setManualMode] = useState(false);

  // ✅ Uploads (up to 10)
  const [uploads, setUploads] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);

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
    // apply prefill once on mount
    if (preImg) setPreviewImageUrl(preImg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Manage preview URLs for uploads
  useEffect(() => {
    // cleanup old
    uploadPreviews.forEach((u) => URL.revokeObjectURL(u));

    const next = uploads.map((f) => URL.createObjectURL(f));
    setUploadPreviews(next);

    return () => {
      next.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads]);

  function closeLightbox() {
    setLightboxOpen(false);
  }

  function handleShare(url: string) {
    console.log("Share clicked (placeholder):", url);
  }

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
    await copyToClipboard(editSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function handleWizardComplete(summary: string, ans: RemixAnswers) {
    setEditSummary(summary);
    setRemixAnswers(ans);
    setWizardOpen(false);
    if (summary) setManualMode(true);
  }

  async function handleGenerate() {
    setGenError(null);

    if (mediaType === "video") {
      setGenError("Video generation is not wired yet. Switch to Image for now.");
      return;
    }

    if (!editSummary) {
      setGenError("Please use Remix to create your edit instructions first.");
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

      form.append("prompt", editSummary); // Using edit summary as the main prompt
      form.append("userId", user.id);
      form.append("aspectRatio", aspectRatio);

      // ✅ Standardized prompt columns
      form.append("combined_prompt_text", editSummary);
      form.append("edit_instructions", editSummary);
      form.append("template_reference_image", previewImageUrl);

      // ✅ Upload up to 10 images
      uploads.slice(0, 10).forEach((file) => {
        form.append("images", file, file.name);
      });

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
      // We don't open lightbox automatically anymore? "Post-generation buttons... after generation completes, show two buttons: Edit Remix... New Remix".
      // But usually we show the result.
      // I'll leave lightbox logic, but maybe update content?
      // Actually the lightbox is the "Preview" in the requirement?
      // No, requirement says "After a generation completes, show two buttons...".
      // Lightbox currently shows buttons. I can add "Edit Remix" button TO the Lightbox?
      // Or simply show the new image in the 'Preview' panel on the right.
      // For now, I'll keep lightbox open behavior as it's good UX.
      setLightboxOpen(true);
    } catch (e: any) {
      setGenError(e?.message || "Failed to generate.");
    } finally {
      setGenerating(false);
    }
  }

  function handleRemixFromLightbox() {
    // lightbox "Remix" button now triggers "Edit Remix" flow?
    // Or "New Remix".
    // Requirement: "Edit Remix" opens new chat with previous values.
    setWizardOpen(true);
    setLightboxOpen(false);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
      <RemixChatWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
        templatePreviewUrl={previewImageUrl}
        initialValues={remixAnswers}
        uploads={uploads}
        onUploadsChange={setUploads}
        logo={null}
        onLogoChange={() => { }}
        businessName=""
        onBusinessNameChange={() => { }}
      />
      <GenerationLightbox
        open={lightboxOpen}
        url={lastImageUrl}
        onClose={closeLightbox}
        // Legacy props might be empty now, using editSummary
        combinedPromptText={editSummary}
        onShare={handleShare}
        onRemix={handleRemixFromLightbox}
      />

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prompt Studio</h1>
        <p className="mt-2 text-sm text-white/70 sm:text-base">
          Remix an existing prompt or build from scratch. Generate, save, and reuse winners.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: Prompt Tool */}
        <div className="order-2 lg:order-1 p-0 sm:p-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="text-xl font-bold tracking-tight text-white">Prompt Tool</div>
            <div className="text-xs font-semibold text-lime-400 uppercase tracking-widest">AI Studio</div>
          </div>

          {/* Edit Summary Display */}
          {/* Edit Summary Display */}
          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">1</span>
              <div className="text-sm font-bold text-white/90">Prompt Instructions</div>
            </div>

            {/* Overlay for Initial Interaction (Guided vs Freestyle) */}
            {!manualMode && !generating && (
              <div className="absolute inset-0 z-20 flex flex-row items-center justify-center gap-3 bg-black/60 backdrop-blur-md transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="group flex w-36 items-center justify-center gap-2 rounded-full bg-lime-400 py-2.5 text-xs font-bold uppercase tracking-wide text-black shadow-[0_0_15px_-5px_#B7FF00] transition-all hover:scale-105 hover:bg-lime-300 hover:shadow-[0_0_20px_-5px_#B7FF00]"
                >
                  <span>Remix</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-black">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="group flex w-36 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/40 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/10 hover:border-white/30 transition-all hover:scale-105"
                >
                  <span>Freestyle</span>
                  <span className="text-xs opacity-50 group-hover:opacity-100">✎</span>
                </button>
              </div>
            )}

            <div className={`relative transition-all duration-500 ${!manualMode ? 'blur-sm opacity-40 scale-[0.98]' : ''}`}>
              <textarea
                readOnly={!manualMode}
                onChange={(e) => setEditSummary(e.target.value)}
                className="w-full rounded-2xl rounded-tl-none border-0 bg-[#2A2A2A] p-5 text-sm text-white outline-none transition-all placeholder:text-white/30 leading-relaxed font-medium resize-none shadow-inner focus:ring-2 focus:ring-lime-400/30 ring-1 ring-white/5"
                rows={6}
                placeholder="Use 'Remix' to key in your changes..."
                value={editSummary}
              />
            </div>
          </div>

          {/* Reference Uploads */}
          {uploads.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">2</span>
                  <div className="text-sm font-bold text-white/90">References</div>
                </div>
                <div className="text-xs font-mono text-white/40">{uploads.length} FILES</div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {uploadPreviews.map((src, idx) => (
                  <div key={src} className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-inner">
                    <Image src={src} alt="Ref" fill className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generator Settings */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">3</span>
                <div className="text-sm font-bold text-white/90">Settings</div>
              </div>
              <div className="text-xs font-mono text-lime-400/80">
                {mediaType.toUpperCase()} / {aspectRatio}
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

          {/* Remixes placeholder */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white/90">Remixes</div>
              <div className="text-xs font-mono text-white/40">0</div>
            </div>
            <p className="mt-2 text-sm text-white/40">No remixes yet. Generate one to start building your library.</p>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white/80 hover:bg-black/60 transition-all hover:scale-[1.01]"
              onClick={() => router.push("/library")}
            >
              View all remixes
            </button>
          </div>

          {genError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200 shadow-lg">
              {genError}
            </div>
          ) : null}

          {/* ACTION BUTTONS */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end pt-2">
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="flex-1 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold tracking-tight text-white hover:bg-white/10 transition-all transform hover:scale-[1.02] backdrop-blur-md"
            >
              {copied ? "Copied" : "Copy Prompt Only"}
            </button>

            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="flex-1 inline-flex items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10 px-6 py-4 text-sm font-bold tracking-tight text-lime-200 hover:bg-lime-400/20 transition-all transform hover:scale-[1.02]"
            >
              Start Remix
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className={[
                "flex-[2] inline-flex items-center justify-center rounded-2xl px-8 py-4 text-sm font-bold tracking-tight text-black transition-all transform hover:scale-[1.02] shadow-[0_0_20px_-5px_#B7FF00]",
                generating ? "cursor-not-allowed bg-lime-400/60" : "bg-[#B7FF00] hover:bg-lime-300",
              ].join(" ")}
            >
              {generating ? "Generating..." : "Generate Artwork"}
            </button>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div className="order-1 lg:order-2 space-y-4">
          <div className="group relative w-full overflow-hidden rounded-none bg-black/50 shadow-2xl transition-all duration-500 hover:shadow-[0_0_30px_-5px_rgba(183,255,0,0.1)]">
            <div className="relative aspect-[9/16] w-full">
              <Image
                src={lastImageUrl || previewImageUrl}
                alt="Preview"
                fill
                className="object-contain"
                priority={false}
                unoptimized
              />
            </div>
            {/* Expand Icon Overlay - Subtle */}
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/50 backdrop-blur-sm transition-all group-hover:scale-110 group-hover:bg-black/60 group-hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>

          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/50 backdrop-blur-md">
              {mediaType.toUpperCase()}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/50 backdrop-blur-md">
              {aspectRatio}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/50 backdrop-blur-md">
              {uploads.length} REFS
            </span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-xl">
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Prompt Summary</div>
            <div className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed font-mono opacity-80">
              {normalize(editSummary) || "// No prompt instructions set."}
            </div>
          </div>
        </div>
      </section>
    </main >
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">Loading studio...</div>}>
      <StudioContent />
    </Suspense>
  );
}
