"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type PromptRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  prompt_text: string;
  prompt: string | null;
  access_level: string;
  status: string;
  category: string | null;
  tags: string[] | null;
  featured_image_url: string | null;
  media_type: string;
  media_url: string | null;
  is_trending: boolean;
  is_editors_choice: boolean;
  is_featured: boolean | null;
  author_id: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  published_at: string | null;

  remix_placeholder: string | null;
};

type ProfileRow = { role: string };

function roleRank(role: string) {
  const r = String(role || "user").toLowerCase();
  const order = ["user", "staff", "instructor", "editor", "admin", "super_admin"];
  const idx = order.indexOf(r);
  return idx === -1 ? 0 : idx;
}

function slugify(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function safeExtFromName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "png";
  if (!["png", "jpg", "jpeg", "webp"].includes(ext)) return "png";
  return ext;
}

const DEFAULT_REMIX_PLACEHOLDER =
  "Try: upload a product photo, swap the headline, match brand colors, change background, add a logo, make it 9:16 for Reels, and add a CTA.";

export default function CmsPromptEditorPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [role, setRole] = useState<string>("user");

  const isEditorPlus = useMemo(() => roleRank(role) >= roleRank("editor"), [role]);

  const [row, setRow] = useState<PromptRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [promptText, setPromptText] = useState("");
  const [accessLevel, setAccessLevel] = useState<"free" | "premium">("free");
  const [status, setStatus] = useState<"draft" | "submitted" | "published">("draft");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaUrl, setMediaUrl] = useState("");

  const [isTrending, setIsTrending] = useState(false);
  const [isEditorsChoice, setIsEditorsChoice] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  // NEW: remix placeholder/inspiration
  const [remixPlaceholder, setRemixPlaceholder] = useState<string>("");

  // upload state
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      if (cancelled) return;
      setMe(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setRole(String((profile as ProfileRow | null)?.role || "user"));

      const { data: promptRow, error } = await supabase
        .from("prompts")
        .select(
          "id, title, slug, summary, prompt_text, prompt, access_level, status, category, tags, featured_image_url, media_type, media_url, is_trending, is_editors_choice, is_featured, author_id, submitted_at, approved_by, published_at, remix_placeholder"
        )
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !promptRow) {
        setError(error?.message || "Prompt not found");
        setLoading(false);
        return;
      }

      const r = promptRow as PromptRow;
      setRow(r);

      setTitle(r.title || "");
      setSlug(r.slug || "");
      setSummary(r.summary || "");
      setPromptText((r.prompt && r.prompt.trim().length ? r.prompt : r.prompt_text) || "");
      setAccessLevel((String(r.access_level || "free").toLowerCase() as any) || "free");
      setStatus((String(r.status || "draft").toLowerCase() as any) || "draft");
      setCategory(r.category || "");
      setTags((r.tags || []).join(", "));
      setFeaturedImageUrl(r.featured_image_url || "");
      setMediaType((String(r.media_type || "image").toLowerCase() as any) || "image");
      setMediaUrl(r.media_url || "");

      setIsTrending(Boolean(r.is_trending));
      setIsEditorsChoice(Boolean(r.is_editors_choice));
      setIsFeatured(Boolean(r.is_featured));

      setRemixPlaceholder(String(r.remix_placeholder || ""));

      setLoading(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [id, router, supabase]);

  function validateForSubmit() {
    if (!title.trim()) return "Title is required.";
    if (!slug.trim()) return "Slug is required.";
    if (!promptText.trim()) return "Prompt text is required.";
    return null;
  }

  async function saveDraft(nextStatus?: "draft" | "submitted" | "published") {
    if (!row?.id) return;

    const nextSlug = slug.trim() ? slug.trim() : slugify(title);
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 50);

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        slug: nextSlug,
        summary: summary.trim() || null,
        prompt_text: promptText.trim(),
        prompt: promptText.trim(),
        access_level: accessLevel,
        status: nextStatus || status,
        category: category.trim() || null,
        tags: tagList.length ? tagList : null,
        featured_image_url: featuredImageUrl.trim() || null,
        media_type: mediaType,
        media_url: mediaUrl.trim() || null,
        is_trending: isTrending,
        is_editors_choice: isEditorsChoice,
        is_featured: isFeatured,
        remix_placeholder: remixPlaceholder.trim() || null,
      };

      if ((nextStatus || status) === "submitted") payload.submitted_at = new Date().toISOString();
      if ((nextStatus || status) === "published") payload.published_at = new Date().toISOString();

      const { error } = await supabase.from("prompts").update(payload).eq("id", row.id);

      if (error) throw error;

      setStatus((nextStatus || status) as any);
      setSlug(nextSlug);

      setSuccessMsg(
        nextStatus === "submitted"
          ? "Prompt submitted for review!"
          : nextStatus === "published"
            ? "Prompt published!"
            : "Draft saved!"
      );
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    const v = validateForSubmit();
    if (v) {
      setError(v);
      return;
    }
    await saveDraft("submitted");
  }

  async function approveAndPublish() {
    if (!isEditorPlus) return;

    const v = validateForSubmit();
    if (v) {
      setError(v);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const nextSlug = slug.trim() ? slug.trim() : slugify(title);

      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 50);

      const payload: any = {
        title: title.trim(),
        slug: nextSlug,
        summary: summary.trim() || null,
        prompt_text: promptText.trim(),
        prompt: promptText.trim(),
        access_level: accessLevel,
        status: "published",
        category: category.trim() || null,
        tags: tagList.length ? tagList : null,
        featured_image_url: featuredImageUrl.trim() || null,
        media_type: mediaType,
        media_url: mediaUrl.trim() || null,
        is_trending: isTrending,
        is_editors_choice: isEditorsChoice,
        is_featured: isFeatured,
        remix_placeholder: remixPlaceholder.trim() || null,
        approved_by: me?.id || null,
        published_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("prompts").update(payload).eq("id", row!.id);
      if (error) throw error;

      setStatus("published");
      setSlug(nextSlug);
      setSuccessMsg("Approved and published!");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to publish");
    } finally {
      setSaving(false);
    }
  }

  async function sendBackToDraft() {
    if (!isEditorPlus) return;
    await saveDraft("draft");
  }

  async function handlePickFile() {
    setUploadError(null);
    fileRef.current?.click();
  }

  async function deleteDraft() {
    if (!row?.id || status !== "draft") return;
    if (!confirm("Are you sure you want to delete this draft? This cannot be undone.")) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("prompts").delete().eq("id", row.id);
      if (error) throw error;
      router.push("/dashboard/cms");
    } catch (e: any) {
      setError(e?.message || "Failed to delete");
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me?.id || !row?.id) return;

    setUploading(true);
    setUploadError(null);

    try {
      const ext = safeExtFromName(file.name);
      const path = `featured/${row.id}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("prompt-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || undefined,
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from("prompt-images").getPublicUrl(path);
      const publicUrl = data?.publicUrl;

      if (!publicUrl) throw new Error("Upload succeeded but no public URL returned.");

      setFeaturedImageUrl(publicUrl);

      const { error: dbErr } = await supabase
        .from("prompts")
        .update({ featured_image_url: publicUrl })
        .eq("id", row.id);

      if (dbErr) throw dbErr;
      setSuccessMsg("Featured image uploaded!");
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white">
        Loading editor…
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
          <div className="text-lg font-semibold text-red-200">Editor error</div>
          <div className="mt-2 text-sm text-red-200/80">{error || "Unknown error"}</div>

          <button
            className="mt-5 rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
            onClick={() => router.push("/dashboard/cms")}
          >
            Back to CMS
          </button>
        </div>
      </div>
    );
  }

  const canSubmit = status === "draft";
  const canEdit = status !== "published" || isEditorPlus;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10 text-white">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prompt Editor</h1>
          <p className="mt-1 text-sm text-white/70">
            Status: <span className="text-white">{status.toUpperCase()}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Delete Draft Button */}
          {status === "draft" && (
            <button
              disabled={saving}
              onClick={deleteDraft}
              className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2 text-sm text-red-300 hover:bg-red-950/40"
            >
              Delete
            </button>
          )}

          <button
            onClick={() => router.push("/dashboard/cms")}
            className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
          >
            Back to CMS
          </button>

          <button
            disabled={!canEdit || saving}
            onClick={() => saveDraft("draft")}
            className={[
              "rounded-xl border px-4 py-2 text-sm",
              !canEdit || saving
                ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                : "border-white/15 bg-black/30 hover:bg-black/50",
            ].join(" ")}
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>

          <button
            disabled={!canEdit || !canSubmit || saving}
            onClick={submitForReview}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold",
              !canEdit || !canSubmit || saving
                ? "cursor-not-allowed bg-white/10 text-white/40"
                : "bg-lime-400 text-black hover:bg-lime-300",
            ].join(" ")}
          >
            Submit for Review
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {successMsg ? (
        <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-4 text-sm font-semibold text-lime-300">
          {successMsg}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <div className="grid grid-cols-1 gap-4">
          {/* Featured image upload */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Featured Image</div>
                <p className="mt-1 text-xs text-white/60">
                  Upload a thumbnail so staff can create prompts without burning credits.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={!canEdit || uploading}
                  className={[
                    "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm",
                    !canEdit || uploading
                      ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                      : "border-white/15 bg-black/30 hover:bg-black/50",
                  ].join(" ")}
                >
                  {uploading ? "Uploading…" : "Upload Image"}
                </button>
              </div>
            </div>

            {uploadError ? (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
                {uploadError}
              </div>
            ) : null}

            {featuredImageUrl ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr] sm:items-start">
                <div className="relative aspect-square w-full max-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-black">
                  <Image src={featuredImageUrl} alt="Featured image" fill className="object-cover" />
                </div>
                <div className="text-xs text-white/60 break-all">
                  <div className="text-white/80 font-semibold">URL</div>
                  <div className="mt-1">{featuredImageUrl}</div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-white/50">No featured image uploaded yet.</div>
            )}
          </div>

          {/* NEW: Remix inspiration / placeholder */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Remix Inspiration (placeholder)</div>
                <p className="mt-1 text-xs text-white/60">
                  This shows inside the Remix box to guide users on how to best use this prompt.
                </p>
              </div>

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setRemixPlaceholder(DEFAULT_REMIX_PLACEHOLDER)}
                className={[
                  "rounded-xl border px-3 py-2 text-xs",
                  !canEdit
                    ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
                    : "border-white/15 bg-black/30 text-white/80 hover:bg-black/50",
                ].join(" ")}
              >
                Use sample
              </button>
            </div>

            <textarea
              value={remixPlaceholder}
              onChange={(e) => setRemixPlaceholder(e.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder={DEFAULT_REMIX_PLACEHOLDER}
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
            />

            <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/60">
              Tip examples you can paste:
              <div className="mt-2 grid gap-1 text-white/55">
                <div>• Upload your product image, keep the style, change only the background.</div>
                <div>• Swap headline copy, keep layout, match brand colors, add CTA button.</div>
                <div>• Make it 9:16 for Reels, higher contrast, and add urgency.</div>
              </div>
            </div>
          </div>

          <label className="text-sm">
            <div className="mb-1 text-white/70">Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 flex items-center justify-between gap-2 text-white/70">
              <span>Slug</span>
              <button
                type="button"
                onClick={() => setSlug(slugify(title))}
                disabled={!canEdit}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/70 hover:bg-black/40"
              >
                Auto-generate
              </button>
            </div>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 text-white/70">Summary</div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={!canEdit}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 text-white/70">Prompt Text</div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={!canEdit}
              rows={10}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 text-white/70">Access Level</div>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as any)}
                disabled={!canEdit}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
              >
                <option value="free">free</option>
                <option value="premium">premium</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 text-white/70">Category</div>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
              />
            </label>
          </div>

          <label className="text-sm">
            <div className="mb-1 text-white/70">Tags (comma separated)</div>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 text-white/70">Media Type</div>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as any)}
                disabled={!canEdit}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
              >
                <option value="image">image</option>
                <option value="video">video</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 text-white/70">Media URL (optional)</div>
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/20"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Toggle label="Trending" value={isTrending} setValue={setIsTrending} disabled={!canEdit} />
            <Toggle label="Editor’s Choice" value={isEditorsChoice} setValue={setIsEditorsChoice} disabled={!canEdit} />
            <Toggle label="Featured" value={isFeatured} setValue={setIsFeatured} disabled={!canEdit} />
          </div>
        </div>
      </div>

      {isEditorPlus ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Editor Actions</h2>
              <p className="mt-1 text-sm text-white/70">Approve and publish submitted prompts.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={sendBackToDraft}
                disabled={saving}
                className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
              >
                Send Back to Draft
              </button>

              <button
                onClick={approveAndPublish}
                disabled={saving}
                className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
              >
                Approve + Publish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  value,
  setValue,
  disabled,
}: {
  label: string;
  value: boolean;
  setValue: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setValue(!value)}
      className={[
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
        disabled
          ? "cursor-not-allowed border-white/10 bg-black/20 text-white/30"
          : value
            ? "border-lime-400/40 bg-lime-400/10 text-white"
            : "border-white/10 bg-black/30 text-white/75 hover:border-white/20 hover:text-white",
      ].join(" ")}
      aria-pressed={value ? "true" : "false"}
    >
      <span className={["h-2.5 w-2.5 rounded-full", value ? "bg-lime-400" : "bg-white/30"].join(" ")} />
      {label}
    </button>
  );
}
