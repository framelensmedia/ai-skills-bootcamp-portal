// app/studio/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type MediaType = "image" | "video";
type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

type LibraryRow = {
  id: string;
  image_url: string;
  created_at: string;
  aspect_ratio: string | null;
  // best-effort: if your API stored prompt text inside settings, we’ll use it for Copy/Remix
  prompt_text?: string | null;
};

function downloadUrl(url: string, filename = "remix.png") {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    // no-op
  }
}

function safeFilenameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "remix.png";
    return last.includes(".") ? last : `${last}.png`;
  } catch {
    return "remix.png";
  }
}

export default function StudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Prompt inputs
  const [promptText, setPromptText] = useState("");
  const [remixText, setRemixText] = useState("");

  // Track the last combined prompt used to generate (for Copy/Remix actions)
  const [lastFinalPrompt, setLastFinalPrompt] = useState<string>("");

  // Generator settings
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  // Reference images (max 10)
  const [refImages, setRefImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Output
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxPrompt, setLightboxPrompt] = useState<string>("");

  // Recent generations (optional)
  const [recent, setRecent] = useState<LibraryRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  const previewAspectClass = useMemo(() => {
    if (aspectRatio === "9:16") return "aspect-[9/16]";
    if (aspectRatio === "16:9") return "aspect-[16/9]";
    if (aspectRatio === "1:1") return "aspect-square";
    return "aspect-[4/5]";
  }, [aspectRatio]);

  // Auth + redirect
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setCheckingAuth(true);
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();

      if (cancelled) return;

      const uid = data?.user?.id ?? null;
      setUserId(uid);
      setCheckingAuth(false);

      if (!uid) {
        router.push(`/login?redirectTo=${encodeURIComponent("/studio")}`);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Handoff support:
  // /studio?img=<url>&prefill=<prompt>
  // - img becomes the preview/output image
  // - prefill becomes the promptText (remixText cleared)
  useEffect(() => {
    const img = (searchParams.get("img") || "").trim();
    const prefill = (searchParams.get("prefill") || "").trim();

    if (img.length) {
      setGeneratedImageUrl(img);
      // also set lightbox data if user opens it
    }

    if (prefill.length) {
      setPromptText(prefill);
      setRemixText("");
      setLastFinalPrompt(prefill);
      setGenerateError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadRecent() {
    if (!userId) return;

    setRecentLoading(true);
    setRecentError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("prompt_generations")
        .select("id, image_url, created_at, settings")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw new Error(error.message);

      const rows: LibraryRow[] = (data ?? []).map((r: any) => {
        const settings = r?.settings ?? {};
        const promptFromSettings =
          (settings?.finalPrompt ?? "").toString().trim() ||
          (settings?.prompt ?? "").toString().trim() ||
          (settings?.promptText ?? "").toString().trim() ||
          null;

        return {
          id: r.id,
          image_url: r.image_url,
          created_at: r.created_at,
          aspect_ratio: settings?.aspectRatio ?? null,
          prompt_text: promptFromSettings,
        };
      });

      setRecent(rows);
    } catch (e: any) {
      setRecentError(e?.message || "Failed to load recent generations");
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function openLightbox(url: string, promptForThisImage?: string | null) {
    if (!url) return;
    setLightboxUrl(url);
    setLightboxPrompt((promptForThisImage || "").trim());
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxUrl(null);
    setLightboxPrompt("");
  }

  function onPickImages(files: FileList | null) {
    if (!files) return;

    const next = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (next.length === 0) return;

    setRefImages((prev) => {
      const merged = [...prev, ...next];
      return merged.slice(0, 10);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeRefImage(idx: number) {
    setRefImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearRefImages() {
    setRefImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearOutput() {
    setGeneratedImageUrl(null);
    setGenerateError(null);
  }

  async function handleCopyPrompt(text: string) {
    const t = (text || "").trim();
    if (!t.length) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      // no-op
    }
  }

  function handleSharePlaceholder(url: string) {
    // UI-only for now
    // later: navigator.share + fallback
    // eslint-disable-next-line no-console
    console.log("Share clicked (not hooked up yet):", url);
  }

  function handleRemixIntoStudio(prefill: string, img?: string | null) {
    const t = (prefill || "").trim();
    if (img && img.trim().length) setGeneratedImageUrl(img.trim());
    if (t.length) {
      setPromptText(t);
      setRemixText("");
      setLastFinalPrompt(t);
      setGenerateError(null);
    }
    closeLightbox();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleGenerate() {
    if (!userId) {
      router.push(`/login?redirectTo=${encodeURIComponent("/studio")}`);
      return;
    }

    if (mediaType === "video") {
      setGenerateError("Video generation is disabled for V1.");
      return;
    }

    const basePrompt = promptText.trim();
    if (!basePrompt) {
      setGenerateError("Type a prompt first.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const remix = remixText.trim();
      const finalPrompt =
        remix.length > 0 ? `${basePrompt}\n\nRemix instructions:\n${remix}` : basePrompt;

      setLastFinalPrompt(finalPrompt);

      const fd = new FormData();
      fd.append("prompt", finalPrompt);
      fd.append("aspectRatio", aspectRatio);
      fd.append("userId", userId);

      // Studio does NOT have a prompt_id
      fd.append("promptId", "");
      fd.append("promptSlug", "studio");

      refImages.slice(0, 10).forEach((f) => fd.append("images", f));

      const res = await fetch("/api/nano-banana/generate", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Generation failed");
      if (!json?.imageUrl) throw new Error("No imageUrl returned from generator");

      setGeneratedImageUrl(String(json.imageUrl));

      // refresh recent
      loadRecent();
    } catch (e: any) {
      setGenerateError(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="text-lg font-semibold">Loading…</div>
        </div>
      </main>
    );
  }

  const activeLightboxPrompt =
    (lightboxPrompt || "").trim() || (generatedImageUrl === lightboxUrl ? (lastFinalPrompt || "").trim() : "");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10 text-white">
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
            <div className="flex flex-col gap-2 border-b border-white/10 bg-black/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-white/80">Preview</div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
                  onClick={() => downloadUrl(lightboxUrl, safeFilenameFromUrl(lightboxUrl))}
                >
                  Download
                </button>

                <button
                  type="button"
                  disabled={!activeLightboxPrompt.length}
                  className={[
                    "rounded-xl border px-3 py-2 text-xs",
                    activeLightboxPrompt.length
                      ? "border-white/15 bg-black/40 text-white/80 hover:bg-black/60"
                      : "cursor-not-allowed border-white/10 bg-black/20 text-white/30",
                  ].join(" ")}
                  onClick={() => handleCopyPrompt(activeLightboxPrompt)}
                  title={activeLightboxPrompt.length ? "Copy prompt used to generate" : "Prompt text not available for this item yet"}
                >
                  Copy
                </button>

                <button
                  type="button"
                  disabled={!activeLightboxPrompt.length}
                  className={[
                    "rounded-xl border px-3 py-2 text-xs",
                    activeLightboxPrompt.length
                      ? "border-white/15 bg-black/40 text-white/80 hover:bg-black/60"
                      : "cursor-not-allowed border-white/10 bg-black/20 text-white/30",
                  ].join(" ")}
                  onClick={() => handleRemixIntoStudio(activeLightboxPrompt, lightboxUrl)}
                  title={activeLightboxPrompt.length ? "Remix this inside Studio" : "Prompt text not available for this item yet"}
                >
                  Remix
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
                  onClick={() => handleSharePlaceholder(lightboxUrl)}
                >
                  Share
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
                  onClick={closeLightbox}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="relative h-[80vh] w-full bg-black">
              <Image src={lightboxUrl} alt="Full screen preview" fill className="object-contain" priority />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">Prompt Studio</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70 sm:text-base">
            Create anything from scratch. Add optional remix instructions and reference images.
          </p>
        </div>

        <button
          className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50 sm:mt-0 sm:w-auto"
          onClick={() => router.push("/library")}
        >
          My Library
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* PREVIEW */}
        <section className="order-1 lg:order-2 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <button
            type="button"
            className="block w-full text-left"
            onClick={() => generatedImageUrl && openLightbox(generatedImageUrl, lastFinalPrompt)}
            title={generatedImageUrl ? "Open full screen" : ""}
          >
            <div
              className={[
                "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black",
                previewAspectClass,
              ].join(" ")}
            >
              {generatedImageUrl ? (
                <Image src={generatedImageUrl} alt="Generated output" fill className="object-contain" priority />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
                  Output preview will appear here
                </div>
              )}
            </div>
          </button>

          {/* Actions for generated output */}
          {generatedImageUrl ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadUrl(generatedImageUrl, safeFilenameFromUrl(generatedImageUrl))}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/85 hover:bg-black/50"
              >
                Download
              </button>

              <button
                type="button"
                disabled={!lastFinalPrompt.trim().length}
                onClick={() => handleCopyPrompt(lastFinalPrompt)}
                className={[
                  "rounded-xl border px-3 py-2 text-xs",
                  lastFinalPrompt.trim().length
                    ? "border-white/15 bg-black/30 text-white/85 hover:bg-black/50"
                    : "cursor-not-allowed border-white/10 bg-black/20 text-white/30",
                ].join(" ")}
              >
                Copy
              </button>

              <button
                type="button"
                disabled={!lastFinalPrompt.trim().length}
                onClick={() => handleRemixIntoStudio(lastFinalPrompt, generatedImageUrl)}
                className={[
                  "rounded-xl border px-3 py-2 text-xs",
                  lastFinalPrompt.trim().length
                    ? "border-white/15 bg-black/30 text-white/85 hover:bg-black/50"
                    : "cursor-not-allowed border-white/10 bg-black/20 text-white/30",
                ].join(" ")}
                title="Loads the prompt back into Studio so you can iterate fast"
              >
                Remix
              </button>

              <button
                type="button"
                onClick={() => handleSharePlaceholder(generatedImageUrl)}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/85 hover:bg-black/50"
              >
                Share
              </button>

              <button
                type="button"
                onClick={clearOutput}
                className="ml-auto rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/80 hover:bg-black/50"
              >
                Clear
              </button>
            </div>
          ) : null}

          {generateError ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
              {generateError}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
            <div>
              <div className="text-sm font-semibold">Preview</div>
              <p className="mt-1 text-sm text-white/60">
                {generatedImageUrl ? "Click image to view full screen." : "Generate to see output."}
              </p>
            </div>
          </div>
        </section>

        {/* TOOL */}
        <section className="order-2 lg:order-1 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-lg font-semibold">Studio Tool</div>

            <button
              className={[
                "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
                generating ? "bg-lime-400/60 text-black" : "bg-lime-400 text-black hover:bg-lime-300",
              ].join(" ")}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>

          {/* Prompt */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Prompt</div>
            <p className="mt-2 text-sm text-white/60">Type what you want to generate.</p>

            <textarea
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
              rows={6}
              placeholder="Example: A futuristic neon flyer design for an Atlanta AI meetup, cinematic lighting, high contrast..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={generating}
            />
          </div>

          {/* Remix */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Remix</div>
            <p className="mt-2 text-sm text-white/60">Optional changes to apply. Use this like “edit notes.”</p>

            <textarea
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
              rows={4}
              placeholder="Example: Make it more premium, add neon green accents, increase urgency, simplify background..."
              value={remixText}
              onChange={(e) => setRemixText(e.target.value)}
              disabled={generating}
            />
          </div>

          {/* Reference images */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Reference images</div>
              <div className="text-xs text-white/50">{refImages.length}/10</div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPickImages(e.target.files)}
                disabled={generating || refImages.length >= 10}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={generating || refImages.length >= 10}
                className={[
                  "rounded-xl border px-3 py-2 text-xs font-semibold",
                  generating || refImages.length >= 10
                    ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                    : "border-white/15 bg-black/30 text-white/80 hover:bg-black/50",
                ].join(" ")}
              >
                Upload images
              </button>

              {refImages.length ? (
                <button
                  type="button"
                  onClick={clearRefImages}
                  disabled={generating}
                  className={[
                    "rounded-xl border px-3 py-2 text-xs font-semibold",
                    generating
                      ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                      : "border-white/15 bg-black/30 text-white/80 hover:bg-black/50",
                  ].join(" ")}
                >
                  Clear
                </button>
              ) : null}
            </div>

            {refImages.length ? (
              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
                {refImages.map((f, idx) => {
                  const url = URL.createObjectURL(f);
                  return (
                    <div
                      key={`${f.name}-${idx}`}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-black"
                      title={f.name}
                    >
                      <div className="relative aspect-square w-full">
                        <Image src={url} alt="Reference" fill className="object-cover" />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRefImage(idx)}
                        className="absolute right-1 top-1 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-[10px] text-white/85 opacity-0 transition group-hover:opacity-100"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 text-xs text-white/50">
                Tip: Upload up to 10 images to guide style, layout, branding, or reference designs.
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Generator Settings</div>
              <div className="text-xs text-white/50">
                Selected: {mediaType.toUpperCase()} · {aspectRatio}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectPill label="Image" selected={mediaType === "image"} onClick={() => setMediaType("image")} disabled={generating} />
              <SelectPill label="Video" selected={mediaType === "video"} disabled onClick={() => setMediaType("video")} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectPill label="9:16" selected={aspectRatio === "9:16"} onClick={() => setAspectRatio("9:16")} disabled={generating} />
              <SelectPill label="16:9" selected={aspectRatio === "16:9"} onClick={() => setAspectRatio("16:9")} disabled={generating} />
              <SelectPill label="1:1" selected={aspectRatio === "1:1"} onClick={() => setAspectRatio("1:1")} disabled={generating} />
              <SelectPill label="4:5" selected={aspectRatio === "4:5"} onClick={() => setAspectRatio("4:5")} disabled={generating} />
            </div>

            <div className="mt-3 text-xs text-white/45">Model: gemini-3-pro-image-preview. Video remains disabled for V1.</div>
          </div>

          {/* Recent (optional) */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Recent generations</div>
              <div className="text-xs text-white/50">{recentLoading ? "Loading..." : recent.length ? `${recent.length}` : "0"}</div>
            </div>

            {recentError ? (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
                {recentError}
              </div>
            ) : null}

            {recentLoading ? (
              <div className="mt-3 text-sm text-white/60">Loading…</div>
            ) : recent.length === 0 ? (
              <div className="mt-3 text-sm text-white/60">No generations yet.</div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {recent.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openLightbox(r.image_url, r.prompt_text || null)}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-black hover:border-white/25"
                    title="Tap to view full screen"
                  >
                    <div className="relative aspect-square w-full">
                      <Image src={r.image_url} alt="Recent generation" fill className="object-cover" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={() => router.push("/library")}
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-black/50"
              >
                View all remixes
              </button>
            </div>
          </div>
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
