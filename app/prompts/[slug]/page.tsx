"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import RemixChatWizard, { RemixAnswers } from "@/components/RemixChatWizard";
import GenerationLightbox from "@/components/GenerationLightbox";
import { RefineChat } from "@/components/RefineChat";

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
        .from("prompts_public")
        .select(
          "id, title, slug, summary, access_level, image_url, featured_image_url, media_url, category, created_at"
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
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 text-white">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="text-lg font-semibold">Loading prompt…</div>
          <div className="mt-2 text-sm text-white/60">Slug: {slug || "(empty)"}</div>
        </div>
      </main>
    );
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
          <section className="order-1 lg:order-2 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => openLightbox(imageSrc)}
              title="Open full screen"
            >
              <div
                className={[
                  "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black",
                  previewAspectClass,
                ].join(" ")}
              >
                <Image
                  src={imageSrc}
                  alt={metaRow.title}
                  fill
                  className={imageSrc === fallbackOrb ? "object-contain brightness-[0.55]" : "object-contain"}
                  priority
                />

                {imageSrc === fallbackOrb ? (
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />
                ) : null}
              </div>
            </button>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
                {(metaRow.category ?? "general").toString().toUpperCase()}
              </span>

              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/50">
                SLUG: {metaRow.slug}
              </span>

              {showProBadge ? (
                <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[11px] text-lime-200">
                  PRO
                </span>
              ) : null}

              {generatedImageUrl ? (
                <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
                  GENERATED
                </span>
              ) : null}
            </div>

            {generateError ? (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                {generateError}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Preview</div>

                {generatedImageUrl ? (
                  <button
                    type="button"
                    onClick={clearGenerated}
                    className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/80 hover:bg-black/50"
                  >
                    Clear output
                  </button>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-white/65">Click the image to view full screen.</p>

              {hasGeneratedForActions ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={handleDownloadGenerated}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/85 hover:bg-black/50"
                  >
                    Download
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyGenerated}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/85 hover:bg-black/50"
                  >
                    Copy
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/85 hover:bg-black/50"
                  >
                    Share
                  </button>

                  <button
                    type="button"
                    onClick={handleRemixFocus}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-3 py-2 text-xs font-semibold text-black hover:bg-lime-300"
                  >
                    Remix
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          {/* TOOL PANEL */}
          <section className="order-2 lg:order-1 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
            <div className="text-lg font-semibold">Prompt Tool</div>


            {isLocked ? (
              <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4">
                <div className="text-sm font-semibold text-lime-200">{lockedTitle}</div>
                <p className="mt-1 text-sm text-white/70">{lockedBody}</p>

                {lockReason === "login" ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      className="inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                      onClick={() => router.push(`/login?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`)}
                    >
                      Log in
                    </button>

                    <button
                      className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:bg-black/50"
                      onClick={() => router.push(`/signup?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`)}
                    >
                      Create free account
                    </button>
                  </div>
                ) : (
                  <button
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                    onClick={() => router.push("/pricing")}
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>
            ) : null}

            <div className="mt-4">
              {/* EDIT SUMMARY DISPLAY (Replaces "View full prompt" and "Remix Input") */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-semibold">Prompt</div>

                {generatedImageUrl ? (
                  <RefineChat onRefine={handleRefine} isGenerating={generating} />
                ) : (
                  <textarea
                    readOnly
                    onClick={!isLocked ? handleRemixFocus : undefined}
                    className={[
                      "mt-3 w-full rounded-2xl border p-4 text-sm outline-none focus:border-white/20 transition-colors",
                      isLocked ? "border-white/5 bg-black/20 text-white/30 cursor-not-allowed" : "border-white/10 bg-black/40 text-white/85 cursor-pointer hover:bg-black/50 hover:border-white/20"
                    ].join(" ")}
                    rows={6}
                    placeholder={isLocked ? "Locked." : "Click here to remix constraints & instructions..."}
                    value={editSummary}
                  />
                )}
              </div>
            </div>

            {/* Reference Uploads Preview (Read only view of what's in the wizard) */}
            {uploads.length > 0 && !isLocked && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Subject References</div>
                  <div className="text-xs text-white/45">{uploads.length}</div>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {uploadPreviews.map((src, idx) => (
                    <div key={src} className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      <Image src={src} alt="Ref" fill className="object-cover" unoptimized />
                    </div>
                  ))}
                </div>
              </div>
            )}


            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Generator Settings</div>
                <div className="text-xs text-white/50">
                  Selected: {mediaType.toUpperCase()} · {aspectRatio}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                className={[
                  "inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition sm:py-2",
                  isLocked
                    ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                    : "border-white/15 bg-black/40 text-white/85 hover:bg-black/60",
                ].join(" ")}
                onClick={handleCopyPromptText}
                disabled={isLocked}
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>

              <button
                className={[
                  "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-black transition sm:py-2",
                  isLocked
                    ? "bg-white/10 text-white/40 hover:bg-white/15"
                    : generating
                      ? "bg-lime-400/60 text-black"
                      : "bg-lime-400 text-black hover:bg-lime-300",
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
                      : "Generate"}
              </button>
            </div>

            {userId ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Remixes</div>
                  <div className="text-xs text-white/50">
                    {remixesLoading ? "Loading..." : remixes.length ? `${remixes.length}` : "0"}
                  </div>
                </div>

                {remixesError ? (
                  <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
                    {remixesError}
                  </div>
                ) : null}

                {remixesLoading ? (
                  <div className="mt-3 text-sm text-white/60">Loading your remixes…</div>
                ) : remixes.length === 0 ? (
                  <div className="mt-3 text-sm text-white/60">
                    No remixes yet. Generate one to start building your library.
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {remixes.slice(0, 12).map((r) => (
                      <div
                        key={r.id}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-black hover:border-white/25"
                      >
                        <button
                          type="button"
                          onClick={() => openLightbox(r.image_url)}
                          className="block w-full"
                          title="Tap to view full screen"
                        >
                          <div className="relative aspect-square w-full">
                            <Image src={r.image_url} alt="Remix" fill className="object-cover" />
                          </div>
                        </button>

                        {/* Hover actions */}
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="absolute inset-0 bg-black/40" />
                          <div className="pointer-events-auto absolute bottom-2 left-2 right-2 grid grid-cols-4 gap-2">
                            <button
                              type="button"
                              onClick={() => downloadAnyImage(r.image_url)}
                              className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-[11px] text-white/85 hover:bg-black/70"
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyGenerated}
                              className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-[11px] text-white/85 hover:bg-black/70"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={handleShare}
                              className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-[11px] text-white/85 hover:bg-black/70"
                            >
                              Share
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemixFromCard(r)}
                              className="rounded-lg bg-lime-400 px-2 py-2 text-[11px] font-semibold text-black hover:bg-lime-300"
                            >
                              Remix
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
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:bg-black/50"
                  >
                    View all remixes
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
