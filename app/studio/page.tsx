"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type MediaType = "image" | "video";
type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

type SavedPromptRow = {
  id: string;
  title: string | null;
  prompt: string;
  created_at: string;
};

export default function StudioPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  const [promptTitle, setPromptTitle] = useState("");
  const [promptInput, setPromptInput] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedPromptRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const previewAspectClass = useMemo(() => {
    if (aspectRatio === "9:16") return "aspect-[9/16]";
    if (aspectRatio === "16:9") return "aspect-[16/9]";
    if (aspectRatio === "1:1") return "aspect-square";
    return "aspect-[4/5]";
  }, [aspectRatio]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user?.id) {
        setUserId(null);
        setLoading(false);
        router.push(`/login?redirectTo=${encodeURIComponent("/studio")}`);
        return;
      }

      setUserId(user.id);
      setLoading(false);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  async function loadSavedPrompts(uid: string) {
    setSavedLoading(true);
    setSavedError(null);

    try {
      const { data, error } = await supabase
        .from("studio_prompts")
        .select("id, title, prompt, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;

      setSaved((data ?? []) as SavedPromptRow[]);
    } catch (e: any) {
      setSavedError(e?.message || "Failed to load saved prompts");
      setSaved([]);
    } finally {
      setSavedLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    loadSavedPrompts(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleGenerate() {
    if (mediaType === "video") {
      setGenerateError("Video generation is disabled for V1.");
      return;
    }

    if (!userId) {
      setGenerateError("Missing user info. Please refresh and try again.");
      return;
    }

    const raw = promptInput.trim();
    if (!raw) {
      setGenerateError("Type a prompt first.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch("/api/nano-banana/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: raw,
          aspectRatio,
          userId,
          promptId: null,
          promptSlug: null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Generation failed");
      }

      if (!json?.imageUrl) {
        throw new Error("No imageUrl returned from generator");
      }

      setGeneratedImageUrl(String(json.imageUrl));
    } catch (err: any) {
      setGenerateError(err?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavePrompt() {
    if (!userId) return;

    const raw = promptInput.trim();
    if (!raw) {
      setSaveMsg("Type a prompt first.");
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    try {
      const title = promptTitle.trim();
      const { error } = await supabase.from("studio_prompts").insert({
        user_id: userId,
        title: title.length ? title : null,
        prompt: raw,
      });

      if (error) throw error;

      setSaveMsg("Saved to your Studio library.");
      setPromptTitle("");
      await loadSavedPrompts(userId);
      setTimeout(() => setSaveMsg(null), 1500);
    } catch (e: any) {
      setSaveMsg(e?.message || "Failed to save prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleUseSaved(p: SavedPromptRow) {
    setPromptTitle(p.title ?? "");
    setPromptInput(p.prompt);
    setSaveMsg(null);
  }

  async function handleDeleteSaved(id: string) {
    if (!userId) return;

    try {
      const { error } = await supabase.from("studio_prompts").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      await loadSavedPrompts(userId);
    } catch {
      // no-op
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="text-lg font-semibold">Loading Studio…</div>
        </div>
      </main>
    );
  }

  const fallbackOrb = "/orb-neon.gif";
  const previewSrc = generatedImageUrl?.trim().length ? generatedImageUrl : fallbackOrb;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10 text-white">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
  Prompt Studio
</h1>

          <p className="mt-2 max-w-3xl text-sm text-white/70 sm:text-base">
            Create custom prompts, generate images, and save your best prompts to reuse later.
          </p>
        </div>

        <button
          className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50 sm:mt-0 sm:w-auto"
          onClick={() => router.push("/library")}
        >
          Go to My Library
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* PREVIEW */}
        <section className="order-1 lg:order-2 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div
            className={[
              "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black",
              previewAspectClass,
            ].join(" ")}
          >
            <Image
              src={previewSrc}
              alt="Studio preview"
              fill
              className={previewSrc === fallbackOrb ? "object-contain brightness-[0.55]" : "object-contain"}
              priority
            />
          </div>

          {generateError ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
              {generateError}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Preview</div>
            <p className="mt-2 text-sm text-white/65">
              Your most recent output will show here.
            </p>
          </div>
        </section>

        {/* TOOL */}
        <section className="order-2 lg:order-1 rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-lg font-semibold">Studio Tool</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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

              <button
                className={[
                  "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold",
                  saving
                    ? "border-white/10 bg-black/20 text-white/40"
                    : "border-white/15 bg-black/30 text-white hover:bg-black/50",
                ].join(" ")}
                onClick={handleSavePrompt}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Prompt"}
              </button>
            </div>
          </div>

          {saveMsg ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
              {saveMsg}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Prompt Title (optional)</div>
            <input
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
              placeholder="Example: Atlanta event flyer prompt"
              value={promptTitle}
              onChange={(e) => setPromptTitle(e.target.value)}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Your Prompt</div>
            <p className="mt-2 text-sm text-white/60">
              Write anything. This Studio version is not pre-filled.
            </p>

            <textarea
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
              rows={8}
              placeholder="Type your prompt here..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
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
              <SelectPill label="Image" selected={mediaType === "image"} onClick={() => setMediaType("image")} />
              <SelectPill label="Video" selected={mediaType === "video"} disabled onClick={() => setMediaType("video")} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectPill label="9:16" selected={aspectRatio === "9:16"} onClick={() => setAspectRatio("9:16")} />
              <SelectPill label="16:9" selected={aspectRatio === "16:9"} onClick={() => setAspectRatio("16:9")} />
              <SelectPill label="1:1" selected={aspectRatio === "1:1"} onClick={() => setAspectRatio("1:1")} />
              <SelectPill label="4:5" selected={aspectRatio === "4:5"} onClick={() => setAspectRatio("4:5")} />
            </div>

            <div className="mt-3 text-xs text-white/45">
              Video remains disabled for V1.
            </div>
          </div>

          {/* Saved prompts */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Recent Saved Prompts</div>
              <div className="text-xs text-white/50">
                {savedLoading ? "Loading..." : saved.length ? `${saved.length}` : "0"}
              </div>
            </div>

            {savedError ? (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
                {savedError}
              </div>
            ) : null}

            {savedLoading ? (
              <div className="mt-3 text-sm text-white/60">Loading…</div>
            ) : saved.length === 0 ? (
              <div className="mt-3 text-sm text-white/60">
                Nothing saved yet. Hit “Save Prompt” to start building your custom library.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {saved.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/40 p-3"
                  >
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => handleUseSaved(p)}
                      title="Load this prompt into the editor"
                    >
                      <div className="text-sm font-semibold text-white/85">
                        {p.title?.trim().length ? p.title : "Untitled Prompt"}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-white/60">
                        {p.prompt}
                      </div>
                    </button>

                    <button
                      type="button"
                      className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/75 hover:bg-black/50"
                      onClick={() => handleDeleteSaved(p.id)}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 text-xs text-white/45">
              Next: we can add “View all” for Studio saved prompts in My Library.
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
