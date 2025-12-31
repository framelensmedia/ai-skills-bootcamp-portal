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

  access_level: string; // free | premium
};

type PromptBodyRow = {
  prompt: string | null;
  prompt_text: string | null;
};

type MediaType = "image" | "video";
type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

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

  // gating state
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<"login" | "upgrade" | null>(null);

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

      // 1) SAFE meta query (from view)
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
      const premiumPrompt = promptAccess === "premium";

      // 2) Determine login status
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isLoggedIn = Boolean(user?.id);

      // Logged out users are ALWAYS locked (even for free prompts)
      if (!isLoggedIn) {
        setIsLocked(true);
        setLockReason("login");
        setBodyRow({ prompt: null, prompt_text: null });
        setLoading(false);
        return;
      }

      // 3) Logged in: check plan for premium prompts
      let premiumUser = false;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", user!.id)
        .maybeSingle();

      premiumUser = String(profile?.plan || "free").toLowerCase() === "premium";

      const locked = premiumPrompt && !premiumUser;

      setIsLocked(locked);
      setLockReason(locked ? "upgrade" : null);

      // 4) Only fetch prompt text if unlocked
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

  const fullPromptText = useMemo(() => {
    if (isLocked) return "";
    const p = (bodyRow?.prompt ?? "").toString().trim();
    if (p.length > 0) return p;
    return (bodyRow?.prompt_text ?? "").toString().trim();
  }, [bodyRow, isLocked]);

  const imageSrc = useMemo(() => {
    const url =
      (metaRow?.featured_image_url ?? "").toString().trim() ||
      (metaRow?.image_url ?? "").toString().trim() ||
      (metaRow?.media_url ?? "").toString().trim();

    return url.length > 0 ? url : "/orb-neon.gif";
  }, [metaRow]);

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

  function handleGenerate() {
    if (isLocked) {
      if (lockReason === "login") router.push("/login");
      else router.push("/pricing");
      return;
    }

    alert(
      `Generate clicked:\nMedia: ${mediaType}\nAspect: ${aspectRatio}\nRemix: ${
        remixInput.trim() ? remixInput.trim() : "(none)"
      }`
    );
  }

  function handlePrimaryCta() {
    if (lockReason === "login") router.push("/login");
    else router.push("/pricing");
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
  const showPremiumBadge = access === "premium";

  const lockedTitle = lockReason === "login" ? "Log in to view this prompt" : "This is a premium prompt";
  const lockedBody =
    lockReason === "login"
      ? "Create a free account to unlock the prompt tool and start generating."
      : "Upgrade to Premium to unlock the full prompt text and generator tools.";
  const ctaLabel = lockReason === "login" ? "Log in / Sign up" : "Upgrade to Premium";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
      {/* Header */}
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

      {/* Mobile: Preview first, Tool second | Desktop: Tool left, Preview right */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* PREVIEW PANEL */}
        <section className="order-1 lg:order-2 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
            <Image src={imageSrc} alt={metaRow.title} fill className="object-cover" priority />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
              {(metaRow.category ?? "general").toString().toUpperCase()}
            </span>

            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/50">
              SLUG: {metaRow.slug}
            </span>

            {showPremiumBadge ? (
              <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[11px] text-lime-200">
                PREMIUM
              </span>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Preview</div>
            <p className="mt-2 text-sm text-white/65">
              This panel becomes your “example output” area. For now it shows the featured image (or orb fallback).
            </p>
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
                  isLocked ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30" : "border-white/15 bg-black/30 hover:bg-black/50",
                ].join(" ")}
                onClick={handleCopy}
                disabled={isLocked}
              >
                {copied ? "Copied" : "Copy Prompt"}
              </button>

              <button
                className={[
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
                  isLocked ? "bg-white/10 text-white/40 hover:bg-white/15" : "bg-lime-400 text-black hover:bg-lime-300",
                ].join(" ")}
                onClick={handleGenerate}
              >
                {lockReason === "login" ? "Log in to Generate" : isLocked ? "Upgrade to Generate" : "Generate"}
              </button>
            </div>
          </div>

          {isLocked ? (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4">
              <div className="text-sm font-semibold text-lime-200">{lockedTitle}</div>
              <p className="mt-1 text-sm text-white/70">{lockedBody}</p>
              <button
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                onClick={handlePrimaryCta}
              >
                {ctaLabel}
              </button>
            </div>
          ) : null}

          {/* Full prompt dropdown */}
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
                      : "Locked. Upgrade to Premium to view this prompt."
                    : fullPromptText && fullPromptText.trim().length > 0
                    ? fullPromptText
                    : "No prompt text found yet. Add it to the prompt or prompt_text column in Supabase."}
                </pre>

                {isLocked ? (
                  <button
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                    onClick={handlePrimaryCta}
                  >
                    {ctaLabel}
                  </button>
                ) : null}
              </div>
            </details>
          </div>

          {/* Remix */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Remix</div>
            <p className="mt-2 text-sm text-white/60">
              Describe what you want to change. We’ll use this to auto-remix the prompt (next step).
            </p>

            <textarea
              className={[
                "mt-3 w-full rounded-2xl border p-3 text-sm outline-none placeholder:text-white/35 focus:border-white/20",
                isLocked ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30" : "border-white/10 bg-black/40 text-white/90",
              ].join(" ")}
              rows={4}
              placeholder="Example: Make this 9:16 TikTok style, neon accent lighting, more urgency, include a CTA..."
              value={remixInput}
              onChange={(e) => setRemixInput(e.target.value)}
              disabled={isLocked}
            />
          </div>

          {/* Generator options */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Generator Settings</div>
              <div className="text-xs text-white/50">
                Selected: {mediaType.toUpperCase()} · {aspectRatio}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectPill label="Image" selected={mediaType === "image"} onClick={() => setMediaType("image")} disabled={isLocked} />
              <SelectPill label="Video" selected={mediaType === "video"} disabled onClick={() => setMediaType("video")} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectPill label="9:16" selected={aspectRatio === "9:16"} onClick={() => setAspectRatio("9:16")} disabled={isLocked} />
              <SelectPill label="16:9" selected={aspectRatio === "16:9"} onClick={() => setAspectRatio("16:9")} disabled={isLocked} />
              <SelectPill label="1:1" selected={aspectRatio === "1:1"} onClick={() => setAspectRatio("1:1")} disabled={isLocked} />
              <SelectPill label="4:5" selected={aspectRatio === "4:5"} onClick={() => setAspectRatio("4:5")} disabled={isLocked} />
            </div>

            <div className="mt-3 text-xs text-white/45">
              Next step: Wire Nano Banana for Image generation. Video remains disabled for V1.
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
  const idleCls =
    "border-white/15 bg-black/40 text-white/80 hover:bg-black/55 hover:border-white/25";
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
