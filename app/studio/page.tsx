"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import RemixChatWizard, { RemixAnswers, TemplateConfig } from "@/components/RemixChatWizard";
import GenerationLightbox from "@/components/GenerationLightbox";
import ImageUploader from "@/components/ImageUploader";

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
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | undefined>(undefined);

  // Fetch Template Config if promptId is present
  useEffect(() => {
    if (prePromptId) {
      supabase.from("prompts")
        .select("template_config_json, subject_mode, featured_image_url, aspect_ratios")
        .eq("id", prePromptId)
        .maybeSingle()
        .then(({ data }: { data: any }) => {
          if (data) {
            if (data.featured_image_url) setPreviewImageUrl(data.featured_image_url);

            // Set Aspect Ratio from template if available
            if (data.aspect_ratios && Array.isArray(data.aspect_ratios) && data.aspect_ratios.length > 0) {
              const validRatios = ["9:16", "16:9", "1:1", "4:5"];
              if (validRatios.includes(data.aspect_ratios[0])) {
                setAspectRatio(data.aspect_ratios[0]);
              }
            }

            const config = data.template_config_json || {};
            setTemplateConfig({
              editable_fields: config.editable_fields || [],
              editable_groups: config.editable_groups || [],
              subject_mode: data.subject_mode || config.subject_mode || "non_human"
            });
          } else {
            console.warn("Template not found or access denied:", prePromptId);
            setTemplateConfig({ editable_fields: [], subject_mode: "non_human" });
          }
        });
    } else {
      // Scratch mode / No template loaded
      setTemplateConfig({
        editable_fields: [],
        subject_mode: "non_human"
      });
    }
  }, [prePromptId, supabase]);

  // Kept for fallback copy? Or should I just use editSummary?
  // "The prompt field... edit-instruction summary". So editSummary is the source of truth.

  // Interaction State
  const [manualMode, setManualMode] = useState(true);

  // ✅ Uploads (up to 10)
  const [uploads, setUploads] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);

  // Output
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [lastFullQualityUrl, setLastFullQualityUrl] = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // “View full prompt” expand
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  // ✅ Auth State
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: any } }) => setUser(data.user));
  }, [supabase]);

  function handleAuthGate(e?: any) {
    if (!user) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        // If it's a focus event (textarea), blur it
        if (e.target && e.target.blur) e.target.blur();
      }
      router.push("/login");
      return false;
    }
    return true;
  }

  useEffect(() => {
    // apply prefill once on mount
    if (preImg) {
      setPreviewImageUrl(preImg);
    }

    // If we have a remix param or img param, we assume the user wants to start the Remix Wizard
    // The feed passes 'remix' param with the prompt text usually.
    if (preImg || sp?.get("remix")) {
      setWizardOpen(true);
    }
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
    if (!handleAuthGate()) return;

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
    if (!handleAuthGate()) return;

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
      // User is guaranteed by handleAuthGate
      if (!user?.id) {
        setGenError("Please log in.");
        setGenerating(false);
        return;
      }

      const form = new FormData();

      form.append("prompt", normalize(editSummary));
      form.append("userId", normalize(user.id));
      form.append("aspectRatio", normalize(aspectRatio));

      // ✅ Standardized prompt columns
      form.append("combined_prompt_text", normalize(editSummary));
      form.append("edit_instructions", normalize(editSummary));
      form.append("template_reference_image", normalize(previewImageUrl));

      // ✅ Upload up to 10 images
      uploads.slice(0, 10).forEach((file) => {
        form.append("images", file, file.name || "upload");
      });

      if (prePromptId) form.append("promptId", normalize(prePromptId));
      if (prePromptSlug) form.append("promptSlug", normalize(prePromptSlug));

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
      const fullQualityUrl = normalize(json?.fullQualityUrl);

      if (!imageUrl) {
        setGenError("No imageUrl returned.");
        setGenerating(false);
        return;
      }

      setLastImageUrl(imageUrl);
      setLastFullQualityUrl(fullQualityUrl);
      setLightboxOpen(true);
    } catch (e: any) {
      console.error("Generation error:", e);
      const msg = e?.message || "";
      if (msg.includes("did not match the expected pattern") || msg.includes("InvalidCharacterError")) {
        setGenError("BROWSER_SECURITY"); // Special flag for UI
      } else {
        setGenError(msg || "Failed to generate.");
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleRemixFromLightbox() {
    if (!handleAuthGate()) return;
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
        templateConfig={templateConfig}
      />
      <GenerationLightbox
        open={lightboxOpen}
        url={lastImageUrl}
        onClose={closeLightbox}
        // Legacy props might be empty now, using editSummary
        combinedPromptText={editSummary}
        onShare={handleShare}
        onRemix={handleRemixFromLightbox}
        fullQualityUrl={lastFullQualityUrl}
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
              <div className="text-sm font-bold text-white/90">Prompt Instructions</div>
            </div>



            <div className="relative transition-all duration-500">
              <textarea
                onClick={handleAuthGate}
                onFocus={handleAuthGate}
                onChange={(e) => setEditSummary(e.target.value)}
                className="w-full rounded-2xl rounded-tl-none border-0 bg-[#2A2A2A] p-5 text-sm text-white outline-none transition-all placeholder:text-white/30 leading-relaxed font-medium resize-none shadow-inner focus:ring-2 focus:ring-lime-400/30 ring-1 ring-white/5"
                rows={6}
                placeholder="Describe your image..."
                value={editSummary}
              />

              <div className="mt-4">
                <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">Reference Images</div>
                <ImageUploader files={uploads} onChange={setUploads} />
              </div>
            </div>
          </div>



          {/* Generator Settings */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
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

          {genError === "BROWSER_SECURITY" ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200 shadow-lg flex flex-col gap-3">
              <div>Browser security prevented processing. Please turn off Private/Incognito Mode or try resetting your session.</div>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                className="self-start rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-100 hover:bg-red-500/30 transition"
              >
                Reset Session
              </button>
            </div>
          ) : genError ? (
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
              onClick={() => { if (handleAuthGate()) setWizardOpen(true); }}
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
