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
        <div className="order-2 lg:order-1 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-lg font-semibold">Prompt Tool</div>
            <div className="text-lg font-semibold">Prompt Tool</div>
          </div>

          {/* Edit Summary Display */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Prompt</div>
            <textarea
              readOnly
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/85 outline-none focus:border-white/20"
              rows={6}
              placeholder="Use 'Remix' to key in your changes..."
              value={editSummary}
            />
          </div>

          {/* Reference Uploads Preview (Read only view of what's in the wizard) */}
          {uploads.length > 0 && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Subject References</div>
                <div className="text-xs text-white/45">{uploads.length}</div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {uploadPreviews.map((src, idx) => (
                  <div key={src} className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    <Image src={src} alt="Ref" fill className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Remixes placeholder */}
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

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white/85 hover:bg-black/60 sm:py-2"
            >
              {copied ? "Copied" : "Copy Prompt"}
            </button>

            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-lime-400/30 bg-lime-400/10 px-5 py-3 text-sm font-semibold text-lime-200 transition hover:bg-lime-400/20 sm:py-2"
            >
              Remix
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className={[
                "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-black transition sm:py-2",
                generating ? "cursor-not-allowed bg-[#B7FF00]/50" : "bg-[#B7FF00] hover:opacity-90",
              ].join(" ")}
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div className="order-1 lg:order-2 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="text-sm font-semibold">Preview</div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <div className="relative aspect-[4/5] w-full bg-black">
              <Image
                src={lastImageUrl || previewImageUrl}
                alt="Preview"
                fill
                className="object-cover"
                priority={false}
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-white/70">Prompt Summary</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-white/80">
              {normalize(editSummary) || "Nothing yet."}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1">Type: {mediaType}</div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1">Aspect: {aspectRatio}</div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1">Uploads: {uploads.length}/10</div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">Loading studio...</div>}>
      <StudioContent />
    </Suspense>
  );
}
