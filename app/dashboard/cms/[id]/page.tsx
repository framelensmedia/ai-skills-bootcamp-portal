"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  ChevronLeft, Save, Trash2, Maximize2, Image as ImageIcon,
  Sparkles, CheckCircle, AlertCircle, Clock, LayoutGrid,
  Type, Globe, Tag, Layers, ArrowUpRight
} from "lucide-react";

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
  template_pack_id: string | null;
  pack_order_index: number | null;
  subject_mode: string | null;
};

type PackSimple = { id: string; pack_name: string; };
type ProfileRow = { role: string };

function roleRank(role: string) {
  const r = String(role || "user").toLowerCase();
  const order = ["user", "staff", "instructor", "editor", "admin", "super_admin"];
  return Math.max(0, order.indexOf(r));
}

function slugify(input: string) {
  return String(input || "").trim().toLowerCase()
    .replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 80);
}

const DEFAULT_REMIX_PLACEHOLDER = "Try: upload a product photo, swap the headline, match brand colors...";

// --- UI COMPONENTS ---
const Label = ({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) => (
  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
    {Icon && <Icon size={10} />}
    {children}
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04] ${className}`}>
    {children}
  </div>
);

const Input = (props: any) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#B7FF00]/50 focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-[#B7FF00]/50 transition-all ${props.className}`}
  />
);

const TextArea = (props: any) => (
  <textarea
    {...props}
    className={`w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#B7FF00]/50 focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-[#B7FF00]/50 transition-all ${props.className}`}
  />
);

const Toggle = ({ label, value, setValue, disabled }: any) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => setValue(!value)}
    className={`group flex items-center justify-between w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-all hover:bg-white/[0.05] disabled:opacity-50 ${value ? 'border-[#B7FF00]/30 bg-[#B7FF00]/5' : ''}`}
  >
    <span className={`text-xs font-medium ${value ? 'text-[#B7FF00]' : 'text-white/60 group-hover:text-white'}`}>{label}</span>
    <div className={`relative h-4 w-7 rounded-full transition-colors ${value ? 'bg-[#B7FF00]' : 'bg-white/10'}`}>
      <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-black shadow transition-transform ${value ? 'translate-x-3' : 'translate-x-0'}`} />
    </div>
  </button>
);

export default function CmsPromptEditorPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("user");
  const [row, setRow] = useState<PromptRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
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
  const [remixPlaceholder, setRemixPlaceholder] = useState("");
  const [subjectMode, setSubjectMode] = useState<"human" | "non_human">("non_human");

  // Pack
  const [packInfo, setPackInfo] = useState<{ id: string | null; name: string; index: number | null }>({ id: null, name: "", index: null });
  const [packs, setPacks] = useState<PackSimple[]>([]);

  // Upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isEditorPlus = roleRank(role) >= roleRank("editor");
  const canEdit = status !== "published" || isEditorPlus;

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
      setRole((profile as ProfileRow)?.role || "user");

      const { data: allPacks } = await supabase.from("template_packs").select("id, pack_name").order("pack_name");
      if (allPacks) setPacks(allPacks);

      const { data: r, error } = await supabase.from("prompts").select("*").eq("id", id).maybeSingle();
      if (error || !r) {
        setError(error?.message || "Not found");
        setLoading(false);
        return;
      }

      setRow(r);
      // Init Form
      setTitle(r.title || "");
      setSlug(r.slug || "");
      setSummary(r.summary || "");
      setPromptText(r.prompt || r.prompt_text || "");
      setAccessLevel(r.access_level || "free");
      setStatus(r.status || "draft");
      setCategory(r.category || "");
      setTags((r.tags || []).join(", "));
      setFeaturedImageUrl(r.featured_image_url || "");
      setMediaType(r.media_type || "image");
      setMediaUrl(r.media_url || "");
      setIsTrending(r.is_trending);
      setIsEditorsChoice(r.is_editors_choice);
      setIsFeatured(r.is_featured);
      setRemixPlaceholder(r.remix_placeholder || "");
      setSubjectMode((r.subject_mode as "human" | "non_human") || "non_human");

      if (r.template_pack_id) {
        setPackInfo({
          id: r.template_pack_id,
          name: allPacks?.find((p: any) => p.id === r.template_pack_id)?.pack_name || "",
          index: r.pack_order_index
        });
      }
      setLoading(false);
    }
    boot();
  }, [id]);

  async function handleSave(nextStatus?: string) {
    if (!row?.id) return;
    const nextSlug = slug.trim() ? slug.trim() : slugify(title);
    setSaving(true);

    try {
      const payload: any = {
        title: title.trim(),
        slug: nextSlug,
        summary: summary.trim(),
        prompt_text: promptText,
        prompt: promptText,
        access_level: accessLevel,
        status: nextStatus || status,
        category: category.trim(),
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        featured_image_url: featuredImageUrl,
        media_type: mediaType,
        media_url: mediaUrl,
        is_trending: isTrending,
        is_editors_choice: isEditorsChoice,
        is_featured: isFeatured,
        remix_placeholder: remixPlaceholder,
        template_pack_id: packInfo.id,
        subject_mode: subjectMode
      };

      if (nextStatus === "submitted") payload.submitted_at = new Date().toISOString();
      if (nextStatus === "published") {
        payload.published_at = new Date().toISOString();
        if (isEditorPlus) payload.approved_by = (await supabase.auth.getUser()).data.user?.id;
      }

      const { error } = await supabase.from("prompts").update(payload).eq("id", row.id);
      if (error) throw error;

      setStatus((nextStatus || status) as any);
      setSlug(nextSlug);
      setSuccessMsg(nextStatus === "published" ? "Published Successfully!" : "Saved Successfully!");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `featured/${row!.id}-${Date.now()}.${file.name.split(".").pop()}`;
      await supabase.storage.from("prompt-images").upload(path, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from("prompt-images").getPublicUrl(path);
      setFeaturedImageUrl(publicUrl);
      setSuccessMsg("Image uploaded");
    } catch (e) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-white/50">Loading Studio...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#B7FF00]/30 selection:text-[#B7FF00]">

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/cms/prompts" className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white">
              <ChevronLeft size={16} />
            </Link>
            <div className="h-6 w-[1px] bg-white/10" />
            <div>
              <h1 className="text-sm font-bold tracking-wide text-white">Prompt Editor</h1>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
                <span className={status === 'published' ? 'text-[#B7FF00]' : 'text-white/40'}>{status}</span>
                <span>•</span>
                <span className="font-mono">{row?.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === 'draft' && (
              <button
                onClick={() => { if (confirm("Delete draft?")) { supabase.from("prompts").delete().eq("id", id).then(() => router.push("/dashboard/cms")) } }}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/20"
              >
                <Trash2 size={12} />
              </button>
            )}

            <button
              disabled={saving}
              onClick={() => handleSave()}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <Save size={12} />
              Save Draft
            </button>

            {isEditorPlus ? (
              <button
                disabled={saving}
                onClick={() => handleSave("published")}
                className="flex items-center gap-2 rounded-lg bg-[#B7FF00] px-4 py-1.5 text-xs font-bold text-black shadow-[0_0_20px_-5px_#B7FF00] hover:bg-[#a3e600] disabled:opacity-50"
              >
                <Sparkles size={12} />
                Publish
              </button>
            ) : (
              <button
                onClick={() => handleSave("submitted")}
                disabled={status !== 'draft' || saving}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-white/90 disabled:opacity-50"
              >
                Submit for Review
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-12">

        {/* LEFT COLUMN (Content) - 8 Cols */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Title & Slug */}
          <div className="flex flex-col gap-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Prompt"
              className="w-full bg-transparent text-4xl font-bold text-white placeholder:text-white/10 focus:outline-none"
            />
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Globe size={14} />
              <span>/prompts/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="slug-goes-here"
                className="bg-transparent font-mono text-white/60 focus:outline-none focus:text-white"
              />
            </div>
          </div>

          {/* Featured Image - Wide & Cinematic */}
          <Card className="relative aspect-video w-full group">
            {featuredImageUrl ? (
              <Image src={featuredImageUrl} alt="Featured" fill className="object-cover transition-opacity duration-500 group-hover:opacity-75" />
            ) : (
              <div className="flex h-full w-full items-center justify-center flex-col gap-3 text-white/20">
                <ImageIcon size={48} />
                <span className="text-xs uppercase tracking-widest font-semibold">No Cover Image</span>
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/60 backdrop-blur-sm">
              <button onClick={() => fileRef.current?.click()} className="rounded-full bg-white px-5 py-2 text-xs font-bold text-black hover:scale-105 transition-transform">
                {uploading ? 'Uploading...' : 'Change Cover'}
              </button>
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept="image/*" />
          </Card>

          {/* Summary */}
          <div>
            <Label icon={LayoutGrid}>Description / Summary</Label>
            <TextArea
              value={summary}
              onChange={(e: any) => setSummary(e.target.value)}
              rows={3}
              placeholder="Short description for SEO and preview cards..."
            />
          </div>

          {/* Prompt Editor */}
          <div className="flex-1">
            <Label icon={Type}>Prompt Template</Label>
            <div className="relative rounded-2xl border border-white/10 bg-black/40">
              <div className="absolute top-0 left-0 right-0 h-10 border-b border-white/5 bg-white/5 flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                </div>
                <span className="mx-auto text-[10px] font-mono text-white/30 uppercase tracking-widest">CODE EDITOR</span>
              </div>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="w-full min-h-[400px] bg-transparent p-6 pt-14 font-mono text-sm leading-relaxed text-white/80 focus:outline-none resize-y placeholder:text-white/10"
                placeholder="Paste your prompt template here..."
              />
            </div>
          </div>

          {/* Remix Tips */}
          <Card className="p-5 border-[#B7FF00]/20 bg-[#B7FF00]/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <Label icon={Sparkles}>Remix Guidelines</Label>
              <button onClick={() => setRemixPlaceholder(DEFAULT_REMIX_PLACEHOLDER)} className="test-xs text-[#B7FF00] hover:underline text-[10px] uppercase font-bold tracking-wider">Use Template</button>
            </div>
            <TextArea
              value={remixPlaceholder}
              onChange={(e: any) => setRemixPlaceholder(e.target.value)}
              rows={4}
              className="bg-black/40 border-white/5"
              placeholder="Tips for users on how to use this prompt..."
            />
          </Card>

        </div>

        {/* RIGHT COLUMN (Metadata) - 4 Cols */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Status Card */}
          <Card className="p-5">
            <Label icon={CheckCircle}>Publishing</Label>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-white/50">Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${status === 'published' ? 'bg-[#B7FF00] text-black' : 'bg-white/10 text-white'}`}>
                  {status}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-white/50">Access</span>
                <select
                  value={accessLevel}
                  onChange={(e: any) => setAccessLevel(e.target.value)}
                  className="bg-transparent text-xs font-medium text-right focus:outline-none"
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Subject Mode Defaults */}
          <Card className="p-5">
            <Label icon={Sparkles}>Subject Mode Default</Label>
            <div className="mt-3 flex rounded-xl border border-white/10 bg-black/40 p-1">
              <button
                onClick={() => setSubjectMode("human")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${subjectMode === "human" ? "bg-[#B7FF00] text-black shadow-lg" : "text-white/40 hover:text-white"}`}
              >
                Human
              </button>
              <button
                onClick={() => setSubjectMode("non_human")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${subjectMode === "non_human" ? "bg-[#B7FF00] text-black shadow-lg" : "text-white/40 hover:text-white"}`}
              >
                Object/Product
              </button>
            </div>
            <p className="mt-2 text-[10px] text-white/40">
              {subjectMode === "human"
                ? "Use validation rules for human faces."
                : "Use validation rules for objects/products."}
            </p>
          </Card>

          {/* Pack Assignment */}
          <Card className="p-5">
            <Label icon={Layers}>Pack Assignment</Label>
            <div className="mt-3">
              <div className="relative">
                <select
                  value={packInfo.id || ""}
                  onChange={(e) => {
                    const pid = e.target.value || null;
                    const pName = packs.find(p => p.id === pid)?.pack_name || "";
                    setPackInfo({ ...packInfo, id: pid, name: pName });
                  }}
                  className="w-full appearance-none rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-[#B7FF00] focus:outline-none"
                  disabled={!canEdit}
                >
                  <option value="">No Pack (Standalone)</option>
                  {packs.map(p => <option key={p.id} value={p.id}>{p.pack_name}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                  <Layers size={14} />
                </div>
              </div>
              {packInfo.id && (
                <div className="mt-2 text-center">
                  <Link href={`/dashboard/cms/packs/${packInfo.id}`} className="text-[10px] text-[#B7FF00] hover:underline flex items-center justify-center gap-1">
                    View Pack <ArrowUpRight size={10} />
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Categorization */}
          <Card className="p-5">
            <Label icon={Tag}>Categorization</Label>
            <div className="flex flex-col gap-4 mt-2">
              <div>
                <span className="mb-1.5 block text-xs text-white/50">Category</span>
                <Input value={category} onChange={(e: any) => setCategory(e.target.value)} placeholder="e.g. Photography" />
              </div>
              <div>
                <span className="mb-1.5 block text-xs text-white/50">Tags</span>
                <Input value={tags} onChange={(e: any) => setTags(e.target.value)} placeholder="neon, portrait, 8k" />
              </div>
            </div>
          </Card>

          {/* Media Settings */}
          <Card className="p-5">
            <Label icon={maximize2IconHelper(Maximize2)}>Media Settings</Label>
            <div className="flex flex-col gap-4 mt-2">
              <select
                value={mediaType}
                onChange={(e: any) => setMediaType(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              <Input value={mediaUrl} onChange={(e: any) => setMediaUrl(e.target.value)} placeholder="External Media URL (optional)" />
            </div>
          </Card>

          {/* Visibility Toggles */}
          <div className="flex flex-col gap-2">
            <Toggle label="Trending" value={isTrending} setValue={setIsTrending} disabled={!canEdit} />
            <Toggle label="Editor's Choice" value={isEditorsChoice} setValue={setIsEditorsChoice} disabled={!canEdit} />
            <Toggle label="Featured" value={isFeatured} setValue={setIsFeatured} disabled={!canEdit} />
          </div>

          {/* Feedback Toast */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex gap-2 text-red-400">
                <AlertCircle size={16} />
                <span className="text-xs font-bold">Error Saving</span>
              </div>
              <p className="mt-1 text-xs text-red-500/80">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="animate-in fade-in slide-in-from-bottom-2 rounded-xl border border-[#B7FF00]/20 bg-[#B7FF00]/10 p-4">
              <div className="flex gap-2 text-[#B7FF00]">
                <CheckCircle size={16} />
                <span className="text-xs font-bold">{successMsg}</span>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}

function maximize2IconHelper(Icon: any) { return Icon } // Wrapper to satisfy type check if needed or just pass Icon
