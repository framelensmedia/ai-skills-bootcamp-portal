"use client";

import Image from "next/image";
import Loading from "@/components/Loading";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import RemixChatWizard, { RemixAnswers, TemplateConfig } from "@/components/RemixChatWizard";
import GenerationLightbox from "@/components/GenerationLightbox";
import { RefineChat } from "@/components/RefineChat";
import ImageUploader from "@/components/ImageUploader";

function Typewriter({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="text-lg font-bold text-white tracking-tight mb-2 min-h-[28px]">
      {text.split("").map((char, i) => (
        <span
          key={i}
          className={`inline-block transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDelay: `${i * 50}ms` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
      <span className={`inline-block ml-0.5 animate-pulse text-lime-400 ${visible ? 'opacity-100' : 'opacity-0'}`}>|</span>
    </div>
  );
}

/**
 * ✅ ADD: inline uploader UI (no extra component file needed)
 * - Allows up to 10 images
 * - Shows thumbnails + remove + clear
 * - If uploads exist, switches generation to /api/generate (FormData)
 * - Otherwise keeps /api/nano-banana/generate (JSON) to avoid breaking existing flow
 */

type PromptMetaRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;

  image_url: string | null;
  featured_image_url?: string | null;
  media_url?: string | null;

  category: string | null;
  created_at: string | null;

  access_level: string; // free | premium (DB value)
  template_config_json?: any;
  subject_mode?: "human" | "non_human";
};

type PromptBodyRow = {
  prompt: string | null;
  prompt_text: string | null;
};

type MediaType = "image" | "video";
type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

type RemixRow = {
  id: string;
  image_url: string;
  created_at: string;
  aspect_ratio: string | null;

  // optional if present in your table
  prompt_text?: string | null;
  remix?: string | null;
  prompt_slug?: string | null;
};

function PromptContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawSlug = (params?.slug ?? "") as string;

  const slug = useMemo(() => {
    return decodeURIComponent(String(rawSlug || "")).trim().toLowerCase();
  }, [rawSlug]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [metaRow, setMetaRow] = useState<PromptMetaRow | null>(null);
  const [bodyRow, setBodyRow] = useState<PromptBodyRow | null>(null);

  const [remixInput, setRemixInput] = useState(""); // Kept for legacy check, but mostly unused now? No, remove to force update.
  // Actually, if I remove `remixInput`, I break any lingering references.
  // I will remove it and fix references.
  const [copied, setCopied] = useState(false);

  // New Wizard State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [remixAnswers, setRemixAnswers] = useState<RemixAnswers | null>(null);
  const [editSummary, setEditSummary] = useState<string>("");
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | undefined>(undefined);

  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  const previewAspectClass = useMemo(() => {
    if (aspectRatio === "9:16") return "aspect-[9/16]";
    if (aspectRatio === "16:9") return "aspect-[16/9]";
    if (aspectRatio === "1:1") return "aspect-square";
    return "aspect-[4/5]";
  }, [aspectRatio]);

  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<"login" | "upgrade" | null>(null);

  // Generation state
  const [userId, setUserId] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Interaction State
  const [manualMode, setManualMode] = useState(false);

  // If user edits manually, enable manual mode
  // But actually, we want to start in overlay mode.
  // We'll rely on button clicks.

  // ✅ ADD: uploads state
  const MAX_UPLOADS = 10;
  const [uploads, setUploads] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    // revoke old urls
    uploadPreviews.forEach((u) => URL.revokeObjectURL(u));
    const next = uploads.map((f) => URL.createObjectURL(f));
    setUploadPreviews(next);

    return () => next.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads]);

  function addUploads(files: File[]) {
    const imagesOnly = files.filter((f) => f.type?.startsWith("image/"));
    if (!imagesOnly.length) return;

    setUploads((prev) => {
      const merged = [...prev, ...imagesOnly];
      return merged.length > MAX_UPLOADS ? merged.slice(0, MAX_UPLOADS) : merged;
    });
  }

  function removeUpload(idx: number) {
    setUploads((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearUploads() {
    setUploads([]);
  }

  // If we land here from a Remix action, we allow:
  // - override preview image
  // - optional prefilled prompt to generate (treated as a full prompt)
  const [overridePreviewUrl, setOverridePreviewUrl] = useState<string | null>(null);
  const [remixIsFullPrompt, setRemixIsFullPrompt] = useState(false);

  // Track what prompt was used for the last generation
  const [lastFinalPrompt, setLastFinalPrompt] = useState<string>("");

  // Remixes (per prompt) from prompt_generations
  const [remixes, setRemixes] = useState<RemixRow[]>([]);
  const [remixesLoading, setRemixesLoading] = useState(false);
  const [remixesError, setRemixesError] = useState<string | null>(null);

  // Fullscreen viewer (lightbox)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function openLightbox(url: string) {
    if (!url) return;
    setLightboxUrl(url);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxUrl(null);
  }

  // Apply query params once on mount
  // /prompts/[slug]?img=...&prefill=...&remix=...
  useEffect(() => {
    const img = (searchParams.get("img") || "").trim();
    const prefill = (searchParams.get("prefill") || "").trim();
    const remix = (searchParams.get("remix") || "").trim();

    if (img.length) setOverridePreviewUrl(img);

    if (prefill.length) {
      setEditSummary(prefill);
      // setRemixIsFullPrompt(true); // Concept deprecated? simple usage
    } else if (remix.length) {
      setEditSummary(remix);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load prompt meta + auth + (if allowed) prompt body
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

      const { data: meta, error: metaError } = await supabase
        .from("prompts")
        .select(
          "id, title, slug, summary, access_level, image_url, featured_image_url, media_url, category, created_at, template_config_json, subject_mode"
        )
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;

      if (metaError) {
        setMetaRow(null);
        setBodyRow(null);
        setErrorMsg(metaError.message);
        setLoading(false);
        return;
      }

      if (!meta) {
        setMetaRow(null);
        setBodyRow(null);
        setErrorMsg("No prompt found for this slug.");
        setLoading(false);
        return;
      }

      setMetaRow(meta as PromptMetaRow);

      const config = (meta as any).template_config_json || {};
      setTemplateConfig({
        editable_fields: config.editable_fields || [],
        editable_groups: config.editable_groups || [],
        subject_mode: (meta as any).subject_mode || config.subject_mode || "non_human"
      });

      const promptAccess = String((meta as any).access_level || "free").toLowerCase();
      const proPrompt = promptAccess === "premium";

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isLoggedIn = Boolean(user?.id);

      if (!isLoggedIn) {
        setUserId(null);
        setIsLocked(true);
        setLockReason("login");
        setBodyRow({ prompt: null, prompt_text: null });
        setLoading(false);
        return;
      }

      setUserId(user!.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", user!.id)
        .maybeSingle();

      const proUser = String(profile?.plan || "free").toLowerCase() === "premium";

      const locked = proPrompt && !proUser;

      setIsLocked(locked);
      setLockReason(locked ? "upgrade" : null);

      if (!locked) {
        const { data: body, error: bodyError } = await supabase
          .from("prompts")
          .select("prompt, prompt_text")
          .eq("id", (meta as any).id)
          .maybeSingle();

        if (bodyError) {
          setBodyRow({ prompt: null, prompt_text: null });
        } else {
          setBodyRow((body ?? { prompt: null, prompt_text: null }) as PromptBodyRow);
        }
      } else {
        setBodyRow({ prompt: null, prompt_text: null });
      }

      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Load remixes for this prompt (as long as logged in)
  useEffect(() => {
    let cancelled = false;

    async function loadRemixes() {
      if (!userId) return;
      if (!metaRow?.id) return;

      setRemixesLoading(true);
      setRemixesError(null);

      try {
        const supabase = createSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("prompt_generations")
          .select("*")
          .eq("user_id", userId)
          .eq("prompt_id", metaRow.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (error) {
          setRemixesError(error.message);
          setRemixes([]);
          setRemixesLoading(false);
          return;
        }

        const rows: RemixRow[] = (data ?? []).map((r: any) => ({
          id: String(r.id),
          image_url: String(r.image_url || ""),
          created_at: String(r.created_at || ""),
          aspect_ratio: r?.settings?.aspectRatio ?? null,
          prompt_text: r?.prompt_text ?? r?.final_prompt ?? null,
          remix: r?.remix ?? null,
          prompt_slug: r?.prompt_slug ?? null,
        }));

        setRemixes(rows.filter((r) => r.image_url.trim().length > 0));
      } catch (e: any) {
        if (cancelled) return;
        setRemixesError(e?.message || "Failed to load remixes");
        setRemixes([]);
      } finally {
        if (cancelled) return;
        setRemixesLoading(false);
      }
    }

    loadRemixes();

    return () => {
      cancelled = true;
    };
  }, [userId, metaRow?.id]);

  const fullPromptText = useMemo(() => {
    if (isLocked) return "";
    const p = (bodyRow?.prompt ?? "").toString().trim();
    if (p.length > 0) return p;
    return (bodyRow?.prompt_text ?? "").toString().trim();
  }, [bodyRow, isLocked]);

  const fallbackOrb = "/orb-neon.gif";

  const imageSrc = useMemo(() => {
    if (overridePreviewUrl && overridePreviewUrl.trim().length > 0) {
      return overridePreviewUrl.trim();
    }

    if (generatedImageUrl && generatedImageUrl.trim().length > 0) {
      return generatedImageUrl.trim();
    }

    const url =
      (metaRow?.featured_image_url ?? "").toString().trim() ||
      (metaRow?.image_url ?? "").toString().trim() ||
      (metaRow?.media_url ?? "").toString().trim();

    return url.length > 0 ? url : fallbackOrb;
  }, [metaRow, generatedImageUrl, overridePreviewUrl]);

  async function handleCopyPromptText() {
    if (isLocked) return;
    try {
      await navigator.clipboard.writeText(editSummary || fullPromptText || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  }

  function handleShare() {
    console.log("Share coming soon");
  }

  async function handleCopyGenerated() {
    try {
      await navigator.clipboard.writeText(editSummary || "");
    } catch {
      // no-op
    }
  }

  async function handleDownloadGenerated() {
    const url = (generatedImageUrl || overridePreviewUrl || "").trim();
    if (!url) return;
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = `prompt-generation-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleRefine(instruction: string) {
    if (generating || !generatedImageUrl) return;
    setGenerating(true);
    setGenerateError(null);

    try {
      const refResponse = await fetch(generatedImageUrl);
      const refBlob = await refResponse.blob();

      const form = new FormData();
      form.append("template_reference_image", refBlob, "ref_image.png");
      form.append("prompt", instruction);
      form.append("edit_instructions", instruction);
      if (userId) form.append("userId", userId);

      // Include original uploads for likeness maintenance
      uploads.slice(0, MAX_UPLOADS).forEach((file) => {
        form.append("images", file, file.name);
      });

      const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Refinement failed");
      }

      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        // setHasGeneratedForActions(true); // Assuming this variable might not exist?
      }
    } catch (e: any) {
      console.error(e);
      setGenerateError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleRemixFocus() {
    // Trigger wizard, close lightbox
    setLightboxOpen(false);
    setWizardOpen(true);
  }

  function handleWizardComplete(summary: string, ans: RemixAnswers, files?: File[]) {
    setEditSummary(summary);
    setRemixAnswers(ans);
    if (files) {
      // files is File[]
      // We need to manage uploads state
      // clearUploads? or just set?
      // setUploads is available? Yes.
      // But setUploads appends? No, we likely want to replace if wizard returns the full set.
      // But RemixChatWizard might return NEW uploads or ALL?
      // In RemixChatWizard, onComplete calls with `uploads` (state).
      // So it is the full set currently in the wizard.
      // BUT my PromptPage implementation uses `addUploads` / `removeUpload`.
      // `setUploads` updates the array.
      // So `setUploads(files)` is correct.
      setUploads(files);
    }
    setWizardOpen(false);
    // When wizard completes (with valid output), switch to manual mode so user sees the result
    if (summary) setManualMode(true);
  }

  function handleRemixFromCard(row: RemixRow) {
    if (row.image_url) {
      setOverridePreviewUrl(row.image_url);
    }
    // clear previous guided answers as we are starting a fresh remix on a new image
    setRemixAnswers(null);
    setEditSummary(""); // clear old summary or maybe keep it? Let's clear to force new chat flow.
    setWizardOpen(true);
  }

  async function downloadAnyImage(url: string) {
    const u = (url || "").trim();
    if (!u) return;
    try {
      const res = await fetch(u, { mode: "cors" });
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = `remix-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch {
      window.open(u, "_blank", "noopener,noreferrer");
    }
  }

  async function refreshRemixes() {
    if (!userId || !metaRow?.id) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("prompt_generations")
        .select("*")
        .eq("user_id", userId)
        .eq("prompt_id", metaRow.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const rows: RemixRow[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        image_url: String(r.image_url || ""),
        created_at: String(r.created_at || ""),
        aspect_ratio: r?.settings?.aspectRatio ?? null,
        prompt_text: r?.prompt_text ?? r?.final_prompt ?? null,
        remix: r?.remix ?? null,
        prompt_slug: r?.prompt_slug ?? null,
      }));
      setRemixes(rows.filter((r) => r.image_url.trim().length > 0));
    } catch {
      // no-op
    }
  }

  async function handleGenerate() {
    if (isLocked) {
      if (lockReason === "login") {
        router.push(`/login?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`);
      } else {
        router.push("/pricing");
      }
      return;
    }

    if (mediaType === "video") {
      setGenerateError("Video generation is disabled for V1.");
      return;
    }

    if (!userId || !metaRow?.id) {
      setGenerateError("Missing user info. Please refresh and try again.");
      return;
    }

    if (!editSummary) {
      setGenerateError("Please use 'Remix' to create instructions first.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const form = new FormData();
      form.append("prompt", editSummary);
      form.append("userId", userId);
      form.append("aspectRatio", aspectRatio);

      // context
      form.append("promptId", metaRow.id);
      form.append("promptSlug", metaRow.slug);

      // standard fields
      form.append("edit_instructions", editSummary);
      form.append("combined_prompt_text", editSummary);
      form.append("template_reference_image", imageSrc); // The current preview image is the template anchor

      uploads.slice(0, MAX_UPLOADS).forEach((file) => {
        form.append("images", file, file.name);
      });

      if (logo) {
        form.append("logo_image", logo, logo.name);
      }
      if (businessName) {
        form.append("business_name", businessName);
      }
      if (remixAnswers?.headline) {
        form.append("headline", remixAnswers.headline);
      }
      if (remixAnswers?.subjectLock) {
        form.append("subjectLock", remixAnswers.subjectLock);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (!res.ok) {
        setGenerateError(json?.error || json?.message || "Generation failed.");
        setGenerating(false);
        return;
      }

      const url = (json?.imageUrl || "").trim();
      if (url) {
        setGeneratedImageUrl(url);
        setOverridePreviewUrl(url); // Show result in main preview
        refreshRemixes();
      } else {
        setGenerateError("No image returned.");
      }
    } catch (e: any) {
      setGenerateError(e?.message || "Failed.");
    } finally {
      setGenerating(false);
    }
  }


  function clearGenerated() {
    setGeneratedImageUrl(null);
    setGenerateError(null);
  }

  if (loading) {
    return <Loading />;
  }

  if (errorMsg || !metaRow) {
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

  const access = String(metaRow.access_level || "free").toLowerCase();
  const showProBadge = access === "premium";

  const lockedTitle =
    lockReason === "login" ? "Log in to view this prompt" : "This is a Pro prompt";
  const lockedBody =
    lockReason === "login"
      ? "Create a free account to unlock the prompt tool and start generating."
      : "Upgrade to Pro to unlock the full prompt text and generator tools.";

  const hasGeneratedForActions = Boolean(
    (generatedImageUrl && generatedImageUrl.trim().length > 0) ||
    (overridePreviewUrl && overridePreviewUrl.trim().length > 0)
  );

  return (
    <>
      <RemixChatWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
        templatePreviewUrl={imageSrc}
        initialValues={remixAnswers}
        uploads={uploads}
        onUploadsChange={setUploads}
        logo={logo}
        onLogoChange={setLogo}
        businessName={businessName}
        onBusinessNameChange={setBusinessName}
        templateConfig={templateConfig}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
        {/* Lightbox */}
        <GenerationLightbox
          open={lightboxOpen}
          url={lightboxUrl}
          onClose={closeLightbox}
          combinedPromptText={editSummary || fullPromptText || ""}
          onShare={handleShare}
          onRemix={handleRemixFocus}
        />

        <div className="mb-5 sm:mb-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">{metaRow.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/70 sm:text-base">
                {metaRow.summary && metaRow.summary.trim().length > 0
                  ? metaRow.summary
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

        <div className="grid gap-5 lg:grid-cols-2">
          {/* PREVIEW PANEL */}
          <section className="order-1 lg:order-2">
            <button
              type="button"
              className="group relative block w-full text-left"
              onClick={() => openLightbox(imageSrc)}
              title="Open full screen"
            >
              <div
                className={[
                  "relative w-full overflow-hidden rounded-none bg-black/50 shadow-2xl transition-all duration-500 group-hover:shadow-[0_0_30px_-5px_rgba(183,255,0,0.1)]",
                  previewAspectClass,
                ].join(" ")}
              >
                <Image
                  src={imageSrc}
                  alt={metaRow.title}
                  fill
                  className="object-contain"
                  priority
                />

                {/* Expand Icon Overlay - Subtle */}
                <div className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/50 backdrop-blur-sm transition-all group-hover:scale-110 group-hover:bg-black/60 group-hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Floating Tags / Info */}
            <div className="mt-4 flex flex-wrap items-center gap-2 justify-center">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/70 backdrop-blur-md">
                {(metaRow.category ?? "general").toString().toUpperCase()}
              </span>

              {showProBadge && (
                <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-bold tracking-wide text-lime-200 backdrop-blur-md">
                  PRO
                </span>
              )}

              {generatedImageUrl && (
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/70 backdrop-blur-md">
                  GENERATED
                </span>
              )}
            </div>

            {generateError ? (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                {generateError}
              </div>
            ) : null}

            {/* Minimal Actions for Generated Result */}
            {hasGeneratedForActions && (
              <div className="mt-6 flex justify-center gap-4">
                <button
                  type="button"
                  onClick={handleDownloadGenerated}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white hover:bg-white/10 transition-all hover:scale-110"
                  title="Download"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={clearGenerated}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white hover:bg-white/10 transition-all hover:scale-110"
                  title="Clear"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </section>

          {/* TOOL PANEL */}
          <section className="order-2 lg:order-1 p-0 sm:p-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="text-xl font-bold tracking-tight text-white">Prompt Tool</div>
              <div className="text-xs font-semibold text-lime-400 uppercase tracking-widest">AI Studio</div>
            </div>

            {isLocked ? (
              <div className="rounded-3xl border border-lime-400/20 bg-lime-400/5 p-6 backdrop-blur-xl">
                <div className="text-sm font-semibold text-lime-200">{lockedTitle}</div>
                <p className="mt-1 text-sm text-lime-100/70">{lockedBody}</p>

                {lockReason === "login" ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-lime-400 px-4 py-3 text-sm font-bold text-black hover:bg-lime-300 transition-all hover:scale-[1.02]"
                      onClick={() => router.push(`/login?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`)}
                    >
                      Log in
                    </button>

                    <button
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm font-bold text-lime-100 hover:bg-lime-400/20 transition-all"
                      onClick={() => router.push(`/signup?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`)}
                    >
                      Create free account
                    </button>
                  </div>
                ) : (
                  <button
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-lime-400 px-4 py-3 text-sm font-bold text-black hover:bg-lime-300 transition-all hover:scale-[1.02]"
                    onClick={() => router.push("/pricing")}
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>
            ) : null}

            {/* EDIT SUMMARY DISPLAY (Glass Card) */}
            <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden">




              {/* Overlay for Initial Interaction (Guided vs Freestyle) */}
              {!manualMode && !generating && !isLocked && !generatedImageUrl && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-md transition-all duration-300">
                  <Typewriter text="How do you want to start?" />
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={handleRemixFocus}
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
                </div>
              )}

              {generatedImageUrl ? (
                <RefineChat onRefine={handleRefine} isGenerating={generating} />
              ) : (
                <div className={`relative transition-all duration-500 ${!manualMode && !isLocked ? 'blur-sm opacity-40 scale-[0.98]' : ''}`}>
                  <textarea
                    readOnly={!manualMode || isLocked}
                    onClick={!manualMode && !isLocked ? undefined : undefined}
                    onChange={(e) => {
                      if (manualMode && !isLocked) {
                        setEditSummary(e.target.value);
                      }
                    }}
                    className={[
                      "w-full rounded-2xl rounded-tl-none border-0 p-5 text-sm outline-none transition-all placeholder:text-white/30 leading-relaxed font-medium resize-none shadow-inner",
                      isLocked
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-[#2A2A2A] text-white focus:ring-2 focus:ring-lime-400/30 ring-1 ring-white/5"
                    ].join(" ")}
                    rows={6}
                    placeholder={isLocked ? "Locked." : "Describe your image..."}
                    value={editSummary}
                  />

                  {!isLocked && (
                    <div className={`grid transition-all duration-300 ease-in-out ${manualMode ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">Reference Images</div>
                        <ImageUploader files={uploads} onChange={setUploads} disabled={!manualMode} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>



            {/* Generator Settings (Glass Card) */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-white/90">Settings</div>
                </div>
                <div className="text-xs font-mono text-lime-400/80">
                  {mediaType.toUpperCase()} / {aspectRatio}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SelectPill
                  label="Image"
                  selected={mediaType === "image"}
                  onClick={() => setMediaType("image")}
                  disabled={isLocked || generating}
                />
                <SelectPill label="Video" selected={mediaType === "video"} disabled onClick={() => setMediaType("video")} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SelectPill
                  label="9:16"
                  selected={aspectRatio === "9:16"}
                  onClick={() => setAspectRatio("9:16")}
                  disabled={isLocked || generating}
                />
                <SelectPill
                  label="16:9"
                  selected={aspectRatio === "16:9"}
                  onClick={() => setAspectRatio("16:9")}
                  disabled={isLocked || generating}
                />
                <SelectPill
                  label="1:1"
                  selected={aspectRatio === "1:1"}
                  onClick={() => setAspectRatio("1:1")}
                  disabled={isLocked || generating}
                />
                <SelectPill
                  label="4:5"
                  selected={aspectRatio === "4:5"}
                  onClick={() => setAspectRatio("4:5")}
                  disabled={isLocked || generating}
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end pt-2">
              <button
                className={[
                  "flex-1 inline-flex items-center justify-center rounded-2xl px-6 py-4 text-sm font-bold tracking-tight text-white transition-all transform hover:scale-[1.02]",
                  isLocked
                    ? "cursor-not-allowed bg-white/5 text-white/20"
                    : "bg-white/10 hover:bg-white/20 border border-white/10 shadow-lg backdrop-blur-md",
                ].join(" ")}
                onClick={handleCopyPromptText}
                disabled={isLocked}
              >
                {copied ? "Copied" : "Copy Prompt Only"}
              </button>

              <button
                className={[
                  "flex-[2] inline-flex items-center justify-center rounded-2xl px-8 py-4 text-sm font-bold tracking-tight text-black transition-all transform hover:scale-[1.02] shadow-[0_0_20px_-5px_#B7FF00]",
                  isLocked
                    ? "bg-white/10 text-white/40 hover:bg-white/15"
                    : generating
                      ? "bg-lime-400/60"
                      : "bg-lime-400 hover:bg-lime-300",
                ].join(" ")}
                onClick={handleGenerate}
                disabled={isLocked || generating}
              >
                {generating
                  ? "Generating..."
                  : lockReason === "login"
                    ? "Log in to Generate"
                    : isLocked
                      ? "Upgrade to Pro"
                      : "Generate Artwork"}
              </button>
            </div>

            {userId ? (
              <div className="mt-8">
                <div className="flex items-center justify-between gap-3 mb-4 px-2">
                  <div className="text-sm font-bold text-white/60 uppercase tracking-widest">Remix History</div>
                  <div className="text-xs font-mono text-white/40">
                    {remixesLoading ? "..." : remixes.length ? `${remixes.length}` : "0"}
                  </div>
                </div>

                {remixesError ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-xs text-red-200">
                    {remixesError}
                  </div>
                ) : null}

                {remixesLoading ? (
                  <div className="px-2 text-sm text-white/40 animate-pulse">Loading library...</div>
                ) : remixes.length === 0 ? (
                  <div className="rounded-3xl border border-white/5 bg-white/5 p-8 text-center">
                    <p className="text-sm text-white/40">No remixes yet.</p>
                    <p className="text-xs text-white/20 mt-1">Generate your first image to start your collection.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {remixes.slice(0, 12).map((r) => (
                      <div
                        key={r.id}
                        className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 hover:border-lime-400/30 transition-all hover:shadow-[0_0_15px_-5px_rgba(183,255,0,0.3)]"
                      >
                        <button
                          type="button"
                          onClick={() => openLightbox(r.image_url)}
                          className="block w-full"
                          title="View"
                        >
                          <div className="relative aspect-square w-full">
                            <Image src={r.image_url} alt="Remix" fill className="object-cover transition duration-500 group-hover:scale-110" />
                          </div>
                        </button>

                        {/* Hover actions */}
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                          <div className="pointer-events-auto absolute bottom-2 left-2 right-2 flex gap-1 justify-center">
                            <button
                              type="button"
                              onClick={() => downloadAnyImage(r.image_url)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
                              title="Download"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemixFromCard(r)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg bg-lime-400 hover:bg-lime-300 text-black font-bold"
                              title="Remix this"
                            >
                              ↺
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => router.push("/library")}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white transition-all"
                  >
                    View Full Library <span className="transition-transform group-hover:translate-x-1">→</span>
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div >
      </main>
    </>
  );
}

function SelectPill({
  label,
  disabled,
  selected,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const base = "rounded-xl border px-3 py-2 text-sm text-left transition";
  const disabledCls = "cursor-not-allowed border-white/10 bg-black/20 text-white/30";
  const idleCls = "border-white/15 bg-black/40 text-white/80 hover:bg-black/55 hover:border-white/25";
  const selectedCls = "border-lime-400/60 bg-lime-400/15 text-white hover:bg-lime-400/20";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={[base, disabled ? disabledCls : selected ? selectedCls : idleCls].join(" ")}
      aria-pressed={selected ? "true" : "false"}
    >
      {label}
    </button>
  );
}

export default function PromptPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-8 text-white">Loading prompt...</div>}>
      <PromptContent />
    </Suspense>
  );
}
