"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { compressImage } from "@/lib/compressImage";
import RemixChatWizard, { RemixAnswers, TemplateConfig, DEFAULT_CONFIG } from "@/components/RemixChatWizard";
import EditModeModal, { QueueItem } from "@/components/EditModeModal";
import GenerationLightbox from "@/components/GenerationLightbox";
import ImageUploader from "@/components/ImageUploader";
import { Smartphone, Monitor, Square, RectangleVertical, Clapperboard, Download } from "lucide-react";
import SelectPill from "@/components/SelectPill";
import LoadingHourglass from "@/components/LoadingHourglass";
import LoadingOrb from "@/components/LoadingOrb";
import VideoGeneratorModal from "@/components/VideoGeneratorModal";
import LibraryImagePickerModal from "@/components/LibraryImagePickerModal";
import { Library } from "lucide-react";

import { GenerationFailureNotification } from "@/components/GenerationFailureNotification";

type MediaType = "image" | "video";

const ASPECTS = ["9:16", "16:9", "1:1", "4:5", "3:4"] as const;
type AspectRatio = (typeof ASPECTS)[number];

function normalize(v: any) {
  return String(v ?? "").trim();
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
  const preIntent = normalize(sp?.get("intent")); // "video" or undefined

  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [videoSubMode, setVideoSubMode] = useState<"image_to_video" | "text_to_video">("image_to_video");
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const previewRef = useRef<HTMLElement>(null);

  const [previewImageUrl, setPreviewImageUrl] = useState<string>("/orb-neon.gif");

  // ✅ New flow state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [remixAnswers, setRemixAnswers] = useState<RemixAnswers | null>(null);
  const [editSummary, setEditSummary] = useState<string>("");
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | undefined>(undefined);

  // Remix Extra State
  const [logo, setLogo] = useState<File | null>(null);
  const [businessName, setBusinessName] = useState<string>("");

  // Edit Mode State
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Video Generator Modal State
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Fetch Template Config if promptId is present
  useEffect(() => {
    if (prePromptId) {
      supabase.from("prompts")
        .select("template_config_json, subject_mode, featured_image_url, aspect_ratios")
        .eq("id", prePromptId)
        .maybeSingle()
        .then(({ data }: { data: any }) => {
          if (data) {
            if (data.featured_image_url && !preImg) setPreviewImageUrl(data.featured_image_url);

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
      setTemplateConfig(DEFAULT_CONFIG);
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
  // Video State
  const [animating, setAnimating] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);

  // Lightbox
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

  // ✅ Prevent double-fetch in Strict Mode
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // apply prefill once on mount
    if (preImg) {
      setPreviewImageUrl(preImg);
    }

    // If we have a remix param or img param, we assume the user wants to start the Remix Wizard
    // The feed passes 'remix' param with the prompt text usually.
    if (preImg || sp?.get("remix")) {
      setWizardOpen(true);

      // ✅ Ported Logic: If preImg exists, fetch it and add to uploads so Wizard shows it
      if (preImg && uploads.length === 0 && !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        const fetchImage = async () => {
          try {
            // Avoid double-fetch if already present (basic check)
            const res = await fetch(preImg);
            const blob = await res.blob();
            // Sanitize name
            let file = new File([blob], "remix_reference.jpg", { type: "image/jpeg" });
            try {
              file = await compressImage(file, { maxWidth: 1536, quality: 0.8 });
            } catch (e) {
              console.warn("Failed to compress remix ref", e);
            }
            setUploads((prev) => [...prev, file]);
          } catch (err) {
            console.error("Failed to load remix image as file:", err);
            hasFetchedRef.current = false; // Reset on failure so retry is possible if needed?
          }
        };
        fetchImage();
      }
    }
  }, [preImg, sp]);

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
    // When closing, we ensure the preview shows the Last Generated Image
    // This gives the user context of "where their generation went"
    if (lastImageUrl) {
      setPreviewImageUrl(lastImageUrl);
    }
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

  function handleWizardComplete(summary: string, ans: RemixAnswers, shouldGenerate = false) {
    setEditSummary(summary);
    setRemixAnswers(ans);
    setWizardOpen(false);
    if (summary) setManualMode(true);

    if (shouldGenerate) {
      handleGenerate({ prompt: summary, answers: ans });
    }
  }

  async function handleGenerate(overrides?: { prompt?: string; answers?: RemixAnswers }) {
    if (!handleAuthGate()) return;

    setGenError(null);

    if (mediaType === "video") {
      setGenError("Video generation is not wired yet. Switch to Image for now.");
      return;
    }

    if (generating) return;

    const promptToUse = overrides?.prompt ?? editSummary;
    const answersToUse = overrides?.answers ?? remixAnswers;

    if (!promptToUse) {
      setGenError("Please use Remix to create your edit instructions first.");
      return;
    }

    setGenerating(true);

    // Scroll to preview explicitly (ensure loading state is seen)
    if (typeof window !== "undefined" && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      // User is guaranteed by handleAuthGate
      if (!user?.id) {
        setGenError("Please log in.");
        setGenerating(false);
        return;
      }

      const form = new FormData();

      form.append("prompt", normalize(promptToUse));
      form.append("userId", normalize(user.id));
      form.append("aspectRatio", normalize(aspectRatio));

      // ✅ Standardized prompt columns
      form.append("combined_prompt_text", normalize(promptToUse));
      form.append("edit_instructions", normalize(promptToUse));
      form.append("template_reference_image", normalize(previewImageUrl));

      // ✅ Upload up to 10 images
      uploads.slice(0, 10).forEach((file) => {
        form.append("images", file, file.name || "upload");
      });


      if (prePromptId) form.append("promptId", normalize(prePromptId));
      if (prePromptSlug) form.append("promptSlug", normalize(prePromptSlug));

      if (answersToUse?.headline) {
        form.append("headline", answersToUse.headline);
      }
      if (answersToUse?.subjectLock) {
        form.append("subjectLock", answersToUse.subjectLock);
      }
      if (answersToUse?.industry_intent) {
        form.append("industry_intent", answersToUse.industry_intent);
      }
      if (answersToUse?.business_name) {
        form.append("business_name", answersToUse.business_name);
      }
      if (answersToUse?.subject_mode) {
        form.append("subjectMode", answersToUse.subject_mode);
      }

      // Also append logo if present (override previous logic?)
      // The API handles logo_image.
      if (logo) form.append("logo_image", logo);
      if (businessName) form.append("business_name", businessName); // Redundant if in answers, but safe.

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

      setLightboxOpen(true);

      // Auto-Switch for Video Intent -> Open Modal
      if (preIntent === "video") {
        setMediaType("video");
        setVideoModalOpen(true);
      }
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

  async function handleEditGenerate(prompt: string) {
    if (!lastFullQualityUrl) return;
    setGenerating(true);
    setGenError(null);

    try {
      // 1. Convert Source URL to Blob via server-side proxy (bypasses CORS)
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(lastFullQualityUrl)}`;

      let srcBlob: Blob;
      let srcFile: File;

      try {
        const srcRes = await fetch(proxyUrl);

        if (!srcRes.ok) {
          const errorText = await srcRes.text();
          throw new Error(`Failed to load image: ${errorText}`);
        }

        srcBlob = await srcRes.blob();
        srcFile = new File([srcBlob], "source_image", { type: srcBlob.type || "image/png" });
      } catch (fetchError: any) {
        console.error('Failed to fetch image for editing:', fetchError);
        throw new Error(`Cannot load image for editing: ${fetchError.message}`);
      }

      // 2. Build Form Data
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to edit.");

      const form = new FormData();
      form.append("userId", user.id);
      form.append("canvas_image", srcFile); // Explicitly Canvas Image
      form.append("prompt", prompt); // Simple text instruction
      form.append("edit_instructions", prompt); // Ensure backend sees strict edit instruction

      // Append Uploads (Subject Lock)
      uploads.forEach((f) => form.append("images", f));

      // Append Meta (Optional but good context)
      if (logo) form.append("logo_image", logo);
      if (businessName) form.append("business_name", businessName);
      if (remixAnswers?.subjectLock) form.append("subjectLock", remixAnswers.subjectLock);

      // 3. Call API
      const res = await fetch("/api/generate", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }

      const data = await res.json();
      const imageUrl = data.imageUrl;
      const fullQualityUrl = data.full_quality_url || imageUrl;

      setLastImageUrl(imageUrl);
      setLastFullQualityUrl(fullQualityUrl);
      setLightboxOpen(true);
      setEditModalOpen(false);

      // Auto-Switch for Video Intent
      if (preIntent === "video") {
        setMediaType("video");
        setVideoModalOpen(true);
      }

    } catch (e: any) {
      console.error("Edit Generation Error:", e);
      setGenError(e.message || "Failed to appply edits.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAnimate() {
    if (!handleAuthGate()) return;
    if (animating) return;

    const promptText = editSummary.trim();
    if (!promptText) {
      setGenError("Please describe the motion or scene you want to create.");
      return;
    }

    setAnimating(true);
    setGenError(null);
    setVideoResult(null);

    // Scroll to preview
    if (typeof window !== "undefined" && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      let sourceImage: string | undefined;
      let subjectImageBase64: string | undefined;

      if (videoSubMode === "image_to_video") {
        sourceImage = (lastImageUrl && lastImageUrl !== "/orb-neon.gif")
          ? lastImageUrl
          : (previewImageUrl !== "/orb-neon.gif" ? previewImageUrl : undefined);

        // Use first upload as either start frame OR subject reference
        if (uploads.length > 0) {
          const file = uploads[0];
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          subjectImageBase64 = undefined; // Force Start Frame (no Subject)

          // If no generated image yet, use this as the start frame
          if (!sourceImage || sourceImage.startsWith("blob:")) {
            sourceImage = base64;
          }
        }

        if (!sourceImage) {
          setGenError("Please generate or upload an image first for Image-to-Video.");
          setAnimating(false);
          return;
        }
      } else {
        // Text to Video
        sourceImage = undefined;
      }

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: sourceImage,
          mainSubjectBase64: subjectImageBase64,
          prompt: promptText,
          userId: user?.id,
          aspectRatio: aspectRatio,
          sourceImageId: prePromptId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Video generation failed");

      if (data.videoUrl) {
        setVideoResult(data.videoUrl);
      } else {
        throw new Error("No video URL returned from server");
      }
    } catch (err: any) {
      console.error("Video Generation Error:", err);
      setGenError(err.message || "Failed to animate");
    } finally {
      setAnimating(false);
    }
  }

  // Deprecated inline animation function


  function handleRemixFromLightbox() {
    if (!handleAuthGate()) return;

    // Check if the current generation result is a video
    if (mediaType === "video" || (lastImageUrl && lastImageUrl.startsWith("http") && lastImageUrl.includes("video"))) { // Weak check
      // Actually, if we just generated a video, we might want to extend it.
      // But here we are "Remixing".
      // If mediaType is video, open Video Modal?
      // Current UI has "Video" pill but disabled. We only generate Images in Studio for now.
      // So Lightbox in Studio is ONLY for images.

      // Wait, the user said "remix video option". This refers to the Community Remixes grid.
      // Those don't open lightbox. They have hover buttons.
    }
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
        logo={logo}
        onLogoChange={setLogo}
        businessName={businessName}
        onBusinessNameChange={setBusinessName}
        templateConfig={templateConfig}
        isGuest={!user}
        onGuestInteraction={() => handleAuthGate()}
      />
      <EditModeModal
        isOpen={editModalOpen}
        onClose={() => !generating && setEditModalOpen(false)}
        sourceImageUrl={lastFullQualityUrl || lastImageUrl || ""}
        onGenerate={handleEditGenerate}
        isGenerating={generating}
      />
      <GenerationLightbox
        open={lightboxOpen}
        url={lastImageUrl}
        onClose={closeLightbox}
        // Legacy props might be empty now, using editSummary
        combinedPromptText={editSummary}
        onShare={handleShare}
        onRemix={handleRemixFromLightbox}
        onEdit={() => {
          setLightboxOpen(false); // Close lightbox to show Edit Modal clearly
          setEditModalOpen(true);
        }}
        fullQualityUrl={lastFullQualityUrl}
      />

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prompt Studio</h1>
        <p className="mt-2 text-sm text-white/70 sm:text-base">
          Remix an existing prompt or build from scratch. Generate, save, and reuse winners.
        </p>
        <GenerationFailureNotification
          error={genError}
          onClose={() => setGenError(null)}
          onRetry={() => handleGenerate()}
        />
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" ref={previewRef}>
        {/* LEFT: Prompt Tool */}
        <div className="order-2 lg:order-1 p-0 sm:p-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="text-xl font-bold tracking-tight text-white">Prompt Tool</div>
            <div className="text-xs font-semibold text-lime-400 uppercase tracking-widest">AI Studio</div>
          </div>

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

              {(mediaType === "image" || (mediaType === "video" && videoSubMode === "image_to_video")) && (
                <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="text-xs font-bold text-white/50 uppercase tracking-wide">
                    {mediaType === "video" ? "Start Frame" : "Reference Images"}
                  </div>

                  <button
                    type="button"
                    onClick={() => setLibraryModalOpen(true)}
                    className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-lime-400/30 bg-lime-400/5 py-4 text-sm font-bold text-lime-400 transition-all hover:border-lime-400 hover:bg-lime-400/10 hover:shadow-[0_0_20px_-5px_#B7FF00] active:scale-[0.98]"
                  >
                    <Library size={18} className="transition-transform group-hover:scale-110" />
                    <span>PICK FROM YOUR LIBRARY</span>
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-white/5"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                      <span className="bg-[#121212] px-2 text-white/20">or upload new</span>
                    </div>
                  </div>

                  <ImageUploader files={uploads} onChange={setUploads} onUploadStart={handleAuthGate} />
                </div>
              )}
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

            <div className="grid grid-cols-2 gap-3">
              <SelectPill
                label="Image"
                selected={mediaType === "image"}
                onClick={() => setMediaType("image")}
                disabled={generating || animating}
              />
              <SelectPill
                label="Video"
                selected={mediaType === "video"}
                onClick={() => setMediaType("video")}
                disabled={generating || animating}
              />
            </div>

            {mediaType === "video" && (
              <div className="mt-3 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <SelectPill
                  label="Image to Video"
                  description="Start Frame"
                  selected={videoSubMode === "image_to_video"}
                  onClick={() => setVideoSubMode("image_to_video")}
                  disabled={generating || animating}
                />
                <SelectPill
                  label="Text to Video"
                  description="Words only"
                  selected={videoSubMode === "text_to_video"}
                  onClick={() => setVideoSubMode("text_to_video")}
                  disabled={generating || animating}
                />
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="grid grid-cols-4 gap-2">
                <SelectPill
                  label="9:16"
                  description="Vertical"
                  icon={<Smartphone size={16} />}
                  selected={aspectRatio === "9:16"}
                  onClick={() => setAspectRatio("9:16")}
                  disabled={generating}
                />
                <SelectPill
                  label="16:9"
                  description="Wide"
                  icon={<Monitor size={16} />}
                  selected={aspectRatio === "16:9"}
                  onClick={() => setAspectRatio("16:9")}
                  disabled={generating}
                />
                <SelectPill
                  label="1:1"
                  description="Square"
                  icon={<Square size={16} />}
                  selected={aspectRatio === "1:1"}
                  onClick={() => setAspectRatio("1:1")}
                  disabled={generating}
                />
                <SelectPill
                  label="4:5"
                  description="Rect"
                  icon={<RectangleVertical size={16} />}
                  selected={aspectRatio === "4:5"}
                  onClick={() => setAspectRatio("4:5")}
                  disabled={generating}
                />
              </div>
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
          <div className="space-y-4 pt-4 border-t border-white/5">

            {/* VIDEO RESULT ACTION */}
            {videoResult ? (
              <a
                href={videoResult}
                download={`video-${Date.now()}.mp4`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-5 text-base font-bold tracking-tight bg-white text-black hover:bg-white/90 transition-all shadow-lg shadow-white/10"
              >
                <Download size={20} />
                Download Video
              </a>
            ) : mediaType === "video" ? (
              /* ANIMATE BUTTON */
              <button
                type="button"
                onClick={handleAnimate}
                disabled={animating}
                className={[
                  "w-full inline-flex items-center justify-center rounded-2xl px-8 py-5 text-base font-bold tracking-tight text-white transition-all transform hover:scale-[1.01] shadow-[0_0_20px_-5px_#B7FF00]",
                  animating ? "cursor-not-allowed bg-zinc-700" : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500",
                ].join(" ")}
              >
                {animating ? (
                  <span className="flex items-center gap-2">
                    <LoadingHourglass className="w-5 h-5 text-white" />
                    <span>Animating...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Clapperboard size={20} />
                    <span>{videoSubMode === "image_to_video" ? "Animate Image" : "Generate Video"}</span>
                  </span>
                )}
              </button>
            ) : (
              /* GENERATE BUTTON */
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={generating}
                className={[
                  "w-full inline-flex items-center justify-center rounded-2xl px-8 py-5 text-base font-bold tracking-tight text-black transition-all transform hover:scale-[1.01] shadow-[0_0_20px_-5px_#B7FF00]",
                  generating ? "cursor-not-allowed bg-lime-400/60" : "bg-lime-400 hover:bg-lime-300",
                ].join(" ")}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <LoadingHourglass className="w-5 h-5 text-black" />
                    <span>Generating...</span>
                  </span>
                ) : "Generate Artwork"}
              </button>
            )}

            {/* Secondary Actions Row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold tracking-tight text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                {copied ? "Copied" : "Copy Prompt Only"}
              </button>

              <button
                type="button"
                onClick={() => { if (handleAuthGate()) setWizardOpen(true); }}
                className="inline-flex items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5 px-4 py-3 text-sm font-bold tracking-tight text-lime-200 hover:bg-lime-400/10 transition-all"
              >
                Remix Again
              </button>
            </div>
          </div>
        </div>



        {/* RIGHT: Preview */}
        < div className="order-1 lg:order-2 space-y-4" >
          <div className="group relative w-full overflow-hidden rounded-none bg-black/50 shadow-2xl transition-all duration-500 hover:shadow-[0_0_30px_-5px_rgba(183,255,0,0.1)]">
            {/* Generating Overlay */}
            {(generating || animating) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl transition-all duration-500">
                <LoadingOrb />
                {animating && <p className="mt-4 text-sm font-bold text-white/50 animate-pulse">Creating Video...</p>}
              </div>
            )}
            <div className="relative aspect-[9/16] w-full">
              {videoResult ? (
                <video
                  src={videoResult}
                  className="absolute inset-0 w-full h-full object-contain"
                  autoPlay
                  loop
                  controls
                  playsInline
                />
              ) : (
                <Image
                  src={lastImageUrl || previewImageUrl}
                  alt="Preview"
                  fill
                  className="object-contain"
                  priority={false}
                  unoptimized
                />
              )}
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


        </div >
      </section >
      {/* Video Modal remains for other flows, but Studio uses inline generation */}
      <VideoGeneratorModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        sourceImage={lastImageUrl || ""}
        initialPrompt={editSummary}
      />
      <LibraryImagePickerModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        onSelect={async (url) => {
          setPreviewImageUrl(url);
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            let file = new File([blob], "library_ref.jpg", { type: "image/jpeg" });
            try {
              file = await compressImage(file, { maxWidth: 1536, quality: 0.8 });
            } catch (e) { console.warn(e); }
            setUploads((prev) => [...prev, file]);
          } catch (err) {
            console.error("Failed to fetch library img:", err);
          }
        }}
      />
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
