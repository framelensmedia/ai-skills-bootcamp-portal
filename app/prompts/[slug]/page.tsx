"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type PromptMetaRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;

  image_url: string | null;
  featured_image_url?: string | null;
  media_url?: string | null;

  category: string | null;
  is_published: boolean | null;
  created_at: string | null;

  access_level: string; // free | premium (DB value)
};

type PromptBodyRow = {
  prompt: string | null;
  prompt_text: string | null;
};

type MediaType = "image" | "video";
type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

// This matches what your route.ts inserts into:
type RemixRow = {
  id: string;
  image_url: string;
  created_at: string;
  settings: any | null; // { aspectRatio, model, provider, ... }
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

  const [metaRow, setMetaRow] = useState<PromptMetaRow | null>(null);
  const [bodyRow, setBodyRow] = useState<PromptBodyRow | null>(null);

  const [remixInput, setRemixInput] = useState("");
  const [copied, setCopied] = useState(false);

  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  // Make preview match the selected aspect ratio
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

  // Remixes (per prompt)
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
          "id, title, slug, summary, access_level, image_url, featured_image_url, media_url, category, is_published, created_at"
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

      const promptAccess = String(meta.access_level || "free").toLowerCase();
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

      // Only load prompt text if not locked
      if (!locked) {
        const { data: body, error: bodyError } = await supabase
          .from("prompts")
          .select("prompt, prompt_text")
          .eq("id", meta.id)
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

  // Helper: fetch remixes from DB
  async function fetchRemixes(currentUserId: string, currentMeta: PromptMetaRow) {
    const supabase = createSupabaseBrowserClient();

    // IMPORTANT:
    // Your route.ts inserts into prompt_generations, not "remixes"
    // We treat those as "Remixes" in the UI.
    const { data, error } = await supabase
      .from("prompt_generations")
      .select("id, image_url, created_at, settings")
      .eq("user_id", currentUserId)
      .or(`prompt_id.eq.${currentMeta.id},prompt_slug.eq.${currentMeta.slug}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data ?? []) as RemixRow[];
  }

  // Load remixes for this prompt (even if Pro-locked), as long as logged in
  useEffect(() => {
    let cancelled = false;

    async function loadRemixes() {
      if (!userId) return;
      if (!metaRow?.id) return;

      setRemixesLoading(true);
      setRemixesError(null);

      try {
        const rows = await fetchRemixes(userId, metaRow);
        if (cancelled) return;
        setRemixes(rows);
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
  }, [userId, metaRow?.id, metaRow?.slug]);

  const fullPromptText = useMemo(() => {
    if (isLocked) return "";
    const p = (bodyRow?.prompt ?? "").toString().trim();
    if (p.length > 0) return p;
    return (bodyRow?.prompt_text ?? "").toString().trim();
  }, [bodyRow, isLocked]);

  const fallbackOrb = "/orb-neon.gif";

  const imageSrc = useMemo(() => {
    if (generatedImageUrl && generatedImageUrl.trim().length > 0) {
      return generatedImageUrl.trim();
    }

    const url =
      (metaRow?.featured_image_url ?? "").toString().trim() ||
      (metaRow?.image_url ?? "").toString().trim() ||
      (metaRow?.media_url ?? "").toString().trim();

    return url.length > 0 ? url : fallbackOrb;
  }, [metaRow, generatedImageUrl]);

  const isFallbackOrb = useMemo(() => {
    return imageSrc === fallbackOrb;
  }, [imageSrc, fallbackOrb]);

  async function handleCopy() {
    if (isLocked) return;

    try {
      await navigator.clipboard.writeText(fullPromptText || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  }

  async function refreshRemixes() {
    if (!userId || !metaRow) return;

    try {
      const rows = await fetchRemixes(userId, metaRow);
      setRemixes(rows);
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

    setGenerating(true);
    setGenerateError(null);

    try {
      const remix = remixInput.trim();
      const finalPrompt =
        remix.length > 0
          ? `${fullPromptText}\n\nRemix instructions:\n${remix}`
          : fullPromptText;

      const res = await fetch("/api/nano-banana/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          aspectRatio,
          userId,
          promptId: metaRow.id,
          promptSlug: metaRow.slug,
          remix,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Generation failed");
      }

      if (!json?.imageUrl) {
        throw new Error("No imageUrl returned from generator");
      }

      const newUrl = String(json.imageUrl);
      setGeneratedImageUrl(newUrl);

      // Refresh remixes list from DB (source of truth)
      await refreshRemixes();
    } catch (err: any) {
      setGenerateError(err?.message || "Generation failed");
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
      {/* Lightbox */}
      {lightboxOpen && lightboxUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/60 px-4 py-3">
              <div className="text-sm font-semibold text-white/80">Preview</div>
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
                onClick={closeLightbox}
              >
                Close
              </button>
            </div>

            <div className="relative h-[80vh] w-full bg-black">
              <Image
                src={lightboxUrl}
                alt="Full screen preview"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-5 sm:mb-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
              {metaRow.title}
            </h1>
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
                className={isFallbackOrb ? "object-contain brightness-[0.55]" : "object-contain"}
                priority
              />

              {isFallbackOrb ? (
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
          </div>
        </section>

        {/* TOOL PANEL */}
        <section className="order-2 lg:order-1 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-lg font-semibold">Prompt Tool</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                className={[
                  "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm",
                  isLocked
                    ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                    : "border-white/15 bg-black/30 hover:bg-black/50",
                ].join(" ")}
                onClick={handleCopy}
                disabled={isLocked}
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>

              <button
                className={[
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
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
          </div>

          {isLocked ? (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4">
              <div className="text-sm font-semibold text-lime-200">{lockedTitle}</div>
              <p className="mt-1 text-sm text-white/70">{lockedBody}</p>

              {lockReason === "login" ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    className="inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                    onClick={() =>
                      router.push(`/login?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`)
                    }
                  >
                    Log in
                  </button>

                  <button
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:bg-black/50"
                    onClick={() =>
                      router.push(`/signup?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`)
                    }
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
            <details className="group rounded-2xl border border-white/10 bg-black/30 p-4">
              <summary className="cursor-pointer select-none list-none text-sm font-semibold text-white/85">
                View full prompt <span className="ml-2 text-xs text-white/50">(click to expand)</span>
              </summary>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
                <pre className="whitespace-pre-wrap break-words text-sm text-white/80">
                  {isLocked
                    ? lockReason === "login"
                      ? "Locked. Log in to view this prompt."
                      : "Locked. Upgrade to Pro to view this prompt."
                    : fullPromptText && fullPromptText.trim().length > 0
                    ? fullPromptText
                    : "No prompt text found yet. Add it to the prompt or prompt_text column in Supabase."}
                </pre>
              </div>
            </details>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Remix</div>
            <p className="mt-2 text-sm text-white/60">
              Describe what you want to change. We’ll use this to auto-remix the prompt.
            </p>

            <textarea
              className={[
                "mt-3 w-full rounded-2xl border p-3 text-sm outline-none placeholder:text-white/35 focus:border-white/20",
                isLocked
                  ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                  : "border-white/10 bg-black/40 text-white/90",
              ].join(" ")}
              rows={4}
              placeholder="Example: Make this 9:16 TikTok style, neon accent lighting, more urgency, include a CTA..."
              value={remixInput}
              onChange={(e) => setRemixInput(e.target.value)}
              disabled={isLocked}
            />
          </div>

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
              <SelectPill
                label="Video"
                selected={mediaType === "video"}
                disabled
                onClick={() => setMediaType("video")}
              />
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

            <div className="mt-3 text-xs text-white/45">
              Next step: Wire Gemini (Nano Banana) for Image generation. Video remains disabled for V1.
            </div>
          </div>

          {/* Remixes (per prompt). Show for any logged in user, even if Pro-locked */}
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
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {remixes.slice(0, 12).map((r) => {
                    const ar = (r?.settings?.aspectRatio || r?.settings?.aspect_ratio || "")
                      .toString()
                      .trim();
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => openLightbox(r.image_url)}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-black hover:border-white/25"
                        title="Tap to view full screen"
                      >
                        <div className="relative aspect-square w-full">
                          <Image src={r.image_url} alt="Remix" fill className="object-cover" />
                        </div>

                        {ar ? (
                          <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[10px] text-white/75">
                            {ar}
                          </div>
                        ) : null}

                        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="absolute inset-0 bg-black/20" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {remixes.length > 12 ? (
                <div className="mt-3 text-xs text-white/45">
                  Showing latest 12. Next we add “View all” to open your full library.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
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
  const idleCls =
    "border-white/15 bg-black/40 text-white/80 hover:bg-black/55 hover:border-white/25";
  const selectedCls =
    "border-lime-400/60 bg-lime-400/15 text-white hover:bg-lime-400/20";

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
