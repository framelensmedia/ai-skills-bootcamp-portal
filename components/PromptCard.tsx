"use client";

import { useMemo, useEffect, useState } from "react";
import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useToast } from "@/context/ToastContext";

type PromptCardProps = {
  title: string;
  summary: string;
  slug: string;
  id: string; // Added for Favorites

  // Allow passing any of these from queries
  featuredImageUrl?: string | null;
  imageUrl?: string | null;
  mediaUrl?: string | null;

  category?: string;
  accessLevel?: string; // free | premium (DB value)

  packName?: string;
  packSlug?: string;

  initialFavorited?: boolean;
  onToggleFavorite?: (newVal: boolean) => void;
};

export default function PromptCard({
  title,
  summary,
  slug,
  id,
  featuredImageUrl,
  imageUrl,
  mediaUrl,
  category,
  accessLevel = "free",
  packName,
  packSlug,
  initialFavorited = false,
  onToggleFavorite,
}: PromptCardProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isAuthed, setIsAuthed] = useState(false);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loadingFav, setLoadingFav] = useState(false);

  // Track image failures so we can hard-fallback
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setIsAuthed(Boolean(data?.user));
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const { showToast } = useToast();

  async function handleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    if (loadingFav) return;

    const next = !favorited;
    setFavorited(next);
    setLoadingFav(true);

    // Show Optimistic Toast
    if (next) showToast("Added to Favorites!");
    else showToast("Removed from Favorites", "info");

    try {
      if (next) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId: id }),
        });
      } else {
        await fetch(`/api/favorites?promptId=${id}`, {
          method: "DELETE",
        });
      }
      if (onToggleFavorite) onToggleFavorite(next);
    } catch (err) {
      setFavorited(!next); // Revert
      showToast("Failed to update favorite", "error");
      console.error("Fav error", err);
    } finally {
      setLoadingFav(false);
    }
  }

  const safeSlug = (slug ?? "").trim().toLowerCase();
  const promptPath =
    safeSlug.length > 0 ? `/prompts/${encodeURIComponent(safeSlug)}` : "/prompts";

  // Allow everyone to view the prompt page. The page itself handles locking logic.
  const href = promptPath;

  const fallbackOrb = "/orb-neon.gif";
  const isPro = String(accessLevel).toLowerCase() === "premium";

  // Prefer featured image first, then image_url, then media_url, then fallback
  const bestImageUrl = useMemo(() => {
    const pick =
      (featuredImageUrl ?? "").toString().trim() ||
      (imageUrl ?? "").toString().trim() ||
      (mediaUrl ?? "").toString().trim();

    return pick.length > 0 ? pick : fallbackOrb;
  }, [featuredImageUrl, imageUrl, mediaUrl]);

  const resolvedImageUrl = imgFailed ? fallbackOrb : bestImageUrl;

  const isFallbackOrb =
    !resolvedImageUrl || resolvedImageUrl.trim().length === 0 || resolvedImageUrl === fallbackOrb;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    router.push(href);
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleClick}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-border/80 hover:bg-accent"
      >
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-black/40">
          {resolvedImageUrl && resolvedImageUrl.length > 5 ? (
            <Image
              src={resolvedImageUrl}
              alt={title}
              fill
              className={[
                "object-cover transition duration-300 group-hover:scale-[1.02]",
                isFallbackOrb ? "brightness-[0.55]" : "opacity-90",
              ].join(" ")}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              onError={() => setImgFailed(true)}
              onLoad={() => setImgFailed(false)}
            />
          ) : (
            /* Skeleton / Placeholder if no URL */
            <div className="h-full w-full bg-white/5 animate-pulse" />
          )}

          {/* Subtle dark overlay ONLY for fallback orb */}
          {isFallbackOrb ? (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />
          ) : null}

          {/* Top Categories & Labels */}
          <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/85">
              {(category ?? "general").toUpperCase()}
            </span>

            {isPro ? (
              <span className="rounded-full border border-lime-400/30 bg-lime-400/15 px-3 py-1 text-[11px] text-lime-200">
                PRO
              </span>
            ) : null}

            {packName && packSlug && (
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/prompts/packs/${packSlug}`);
                }}
                className="cursor-pointer rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/85 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
              >
                <span className="opacity-50">PACK:</span> {packName}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5 w-full">
          <div className="text-lg font-semibold leading-tight pr-6">{title}</div>

          <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {summary && summary.trim().length > 0 ? summary : "Open to view and use this prompt."}
          </div>

          <div className="mt-auto pt-4 flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground/70">{isAuthed ? "Remix Prompt" : "Log in to Remix"}</div>

            {/* Standard Remix Button shape (rounded-lg) without the loud green color */}
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground border border-border transition-transform shadow-sm group-hover:scale-105 shrink-0 ml-auto">
              <RefreshCw size={16} strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </button>

      {/* Favorite Button (Absolute Top Right) */}
      <button
        onClick={handleFavorite}
        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 hover:scale-110"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={favorited ? "#B7FF00" : "none"}
          stroke={favorited ? "#B7FF00" : "currentColor"}
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </button>
    </div>
  );
}
