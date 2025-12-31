"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type PromptCardProps = {
  title: string;
  summary: string;
  slug: string;
  imageUrl?: string | null;
  category?: string;
};

export default function PromptCard({
  title,
  summary,
  slug,
  imageUrl,
  category,
}: PromptCardProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [isAuthed, setIsAuthed] = useState<boolean>(false);

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

  const safeSlug = (slug ?? "").trim().toLowerCase();

  const promptPath =
    safeSlug.length > 0 ? `/prompts/${encodeURIComponent(safeSlug)}` : "/prompts";

  const loginPath = `/login?redirectTo=${encodeURIComponent(promptPath)}`;

  const href = isAuthed ? promptPath : loginPath;

  const fallbackOrb = "/orb-neon.gif";

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    router.push(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:border-white/20 hover:bg-white/10"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl && imageUrl.trim().length > 0 ? imageUrl : fallbackOrb}
          alt={title}
          className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />

        <div className="absolute left-3 top-3">
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/80">
            {(category ?? "general").toUpperCase()}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="text-lg font-semibold leading-tight">{title}</div>
        <div className="mt-2 line-clamp-2 text-sm text-white/70">
          {summary && summary.trim().length > 0
            ? summary
            : "Open to view and use this prompt."}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-white/50">
            {isAuthed ? "Open prompt" : "Log in to open"}
          </div>
          <div className="text-xs text-lime-300 opacity-0 transition group-hover:opacity-100">
            {isAuthed ? "View →" : "Log in →"}
          </div>
        </div>
      </div>
    </button>
  );
}
