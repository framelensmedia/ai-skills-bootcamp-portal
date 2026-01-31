"use client";

import Image from "next/image";
import Loading from "@/components/Loading";

import { useEffect, useMemo, useState, useRef, Suspense, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import RemixChatWizard, { RemixAnswers, TemplateConfig } from "@/components/RemixChatWizard";
import GenerationLightbox from "@/components/GenerationLightbox";
import { GENERATION_MODELS, VIDEO_MODELS, DEFAULT_MODEL_ID, DEFAULT_VIDEO_MODEL_ID } from "@/lib/model-config";
import { RefineChat } from "@/components/RefineChat";
import ImageUploader from "@/components/ImageUploader";
import Link from "next/link";
import { ArrowRight, Smartphone, Monitor, Square, RectangleVertical, ChevronLeft, Clapperboard, TriangleAlert } from "lucide-react";
import LoadingHourglass from "@/components/LoadingHourglass";
import LoadingOrb from "@/components/LoadingOrb";
import { GenerationFailureNotification } from "@/components/GenerationFailureNotification";
import GalleryBackToTop from "@/components/GalleryBackToTop";
import StudioCommunityFeed from "@/components/StudioCommunityFeed";
import PromptCard from "@/components/PromptCard";
import RemixCard from "@/components/RemixCard";
import LazyMedia from "@/components/LazyMedia";
import GenerationOverlay from "@/components/GenerationOverlay";
import VideoGeneratorModal from "@/components/VideoGeneratorModal";
import { compressImage } from "@/lib/compressImage";

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
  author_id?: string;
  aspect_ratios?: string[];
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
  const [isAdmin, setIsAdmin] = useState(false); // Admin State
  const [lockReason, setLockReason] = useState<"login" | "upgrade" | null>(null);

  // Generation state
  const [userId, setUserId] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const shuffledRemixIds = useRef<{ id: string, type: "image" | "video" }[]>([]);

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
  const [inputVideo, setInputVideo] = useState<string | null>(null); // For extension

  // Video Remix State
  const [videoRemixOpen, setVideoRemixOpen] = useState(false);
  const [selectedVideoRemix, setSelectedVideoRemix] = useState<any>(null);

  // Model Management State
  const [generationsPaused, setGenerationsPaused] = useState(false);
  const [modelsConfig, setModelsConfig] = useState<any>({});
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);

  // Sync model selection when media type changes
  useEffect(() => {
    if (mediaType === "video") setSelectedModel(DEFAULT_VIDEO_MODEL_ID);
    else setSelectedModel(DEFAULT_MODEL_ID);
  }, [mediaType]);

  // Fetch Config & User Role
  useEffect(() => {
    const fetchConfig = async () => {
      const supabase = createSupabaseBrowserClient();

      // 1. Fetch Global Config
      const { data: pausedConfig, error: configError } = await supabase.from("app_config").select("value").eq("key", "generations_paused").maybeSingle();
      if (configError) console.error("Error fetching pause config:", configError);

      if (pausedConfig) {
        setGenerationsPaused(pausedConfig.value === true || pausedConfig.value === "true");
      }

      const { data: models } = await supabase.from("app_config").select("value").eq("key", "model_availability").maybeSingle();
      if (models && models.value) {
        setModelsConfig(models.value);
      }

      // 2. Fetch User Role for Admin Bypass
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
        if (profile) {
          const role = String(profile.role || "").toLowerCase();
          if (role === "admin" || role === "super_admin") {
            setIsAdmin(true);
          }
        }
      }
    };
    fetchConfig();
  }, []);

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

  // Subject Settings (Parity with Studio)
  const [subjectMode, setSubjectMode] = useState<"human" | "non_human">("human");
  const [subjectLock, setSubjectLock] = useState(true);

  // Manual Mode Handler with Template Pre-load
  const handleFreestyleEnter = async () => {
    setManualMode(true);

    // Auto-load template image as reference if none exists
    if (uploads.length === 0 && metaRow?.featured_image_url) {
      try {
        const res = await fetch(metaRow.featured_image_url);
        const blob = await res.blob();
        let file = new File([blob], "template_ref.jpg", { type: "image/jpeg" });
        try {
          file = await compressImage(file, { maxWidth: 1536, quality: 0.8 });
        } catch (e) { console.warn("Compression failed", e); }
        setUploads([file]);
      } catch (e) {
        console.error("Failed to preload template image", e);
      }
    }
  };

  // If we land here from a Remix action, we allow:
  // - override preview image
  // - optional prefilled prompt to generate (treated as a full prompt)
  const [overridePreviewUrl, setOverridePreviewUrl] = useState<string | null>(null);
  const [remixIsFullPrompt, setRemixIsFullPrompt] = useState(false);

  // Track what prompt was used for the last generation
  const [lastFinalPrompt, setLastFinalPrompt] = useState<string>("");

  // 1. Specific Remixes (for this prompt, finite)
  // We use 'any[]' to accommodate RemixItem shape
  const [specificRemixes, setSpecificRemixes] = useState<any[]>([]);
  const [specificLoading, setSpecificLoading] = useState(false);

  // 3. Global Community Remixes (Infinite)
  // We use 'any[]' to accommodate the RemixItem shape required by RemixCard
  const [communityRemixes, setCommunityRemixes] = useState<any[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityPage, setCommunityPage] = useState(0);
  const [hasMoreCommunity, setHasMoreCommunity] = useState(true);
  const communityObserver = useRef<IntersectionObserver | null>(null);

  const lastCommunityRef = useCallback((node: HTMLDivElement | null) => {
    if (communityLoading) return;
    if (communityObserver.current) communityObserver.current.disconnect();
    communityObserver.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreCommunity) {
        setCommunityPage((prev) => prev + 1);
      }
    });
    if (node) communityObserver.current.observe(node);
  }, [communityLoading, hasMoreCommunity]);

  // Fullscreen viewer (lightbox)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxVideoUrl, setLightboxVideoUrl] = useState<string | null>(null);
  const [lightboxMediaType, setLightboxMediaType] = useState<"image" | "video">("image");
  const [remixRefreshTrigger, setRemixRefreshTrigger] = useState(0);

  function openLightbox(url: string, type: "image" | "video" = "image", videoUrl?: string) {
    if (!url) return;
    setLightboxUrl(url);
    if (type === "video" && videoUrl) {
      setLightboxVideoUrl(videoUrl);
      setLightboxMediaType("video");
    } else {
      setLightboxMediaType("image");
      setLightboxVideoUrl(null);
    }
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxUrl(null);
    setLightboxVideoUrl(null);
    setLightboxMediaType("image");
  }

  // Apply query params once on mount
  // /prompts/[slug]?img=...&prefill=...&remix=...
  useEffect(() => {
    const img = (searchParams.get("img") || "").trim();
    const prefill = (searchParams.get("prefill") || "").trim();
    const remix = (searchParams.get("remix") || "").trim();
    const extendVideo = (searchParams.get("video") || searchParams.get("extend") || "").trim();
    const promptParam = (searchParams.get("prompt") || "").trim();

    if (extendVideo) {
      setMediaType("video");
      setManualMode(true);
      setInputVideo(extendVideo);
      if (promptParam) setEditSummary(promptParam);
      return;
    }

    if (img.length) setOverridePreviewUrl(img);

    if (prefill.length) {
      setEditSummary(prefill);
    } else if (remix.length) {
      setEditSummary(remix);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch creator profile
  const [creatorProfile, setCreatorProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
  } | null>(null);

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
          "id, title, slug, summary, access_level, image_url, featured_image_url, media_url, category, created_at, template_config_json, subject_mode, author_id, aspect_ratios"
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

      if (meta.aspect_ratios && Array.isArray(meta.aspect_ratios) && meta.aspect_ratios.length > 0) {
        const valid = ["9:16", "16:9", "1:1", "4:5"];
        if (valid.includes(meta.aspect_ratios[0])) {
          setAspectRatio(meta.aspect_ratios[0] as AspectRatio);
        }
      }

      // Fetch Prompt Creator Profile
      if (meta.author_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, profile_image")
          .eq("user_id", meta.author_id)
          .maybeSingle();

        if (profile) {
          setCreatorProfile({
            full_name: profile.full_name,
            avatar_url: profile.profile_image,
            created_at: ""
          });
        }
      }

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
        .select("plan, role")
        .eq("user_id", user!.id)
        .maybeSingle();

      const role = String(profile?.role || "user").toLowerCase();
      if (role === "admin" || role === "super_admin") {
        setIsAdmin(true);
      }

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
  useEffect(() => {
    if (!metaRow?.id) return;
    async function loadSpecific() {
      setSpecificLoading(true);
      const supabase = createSupabaseBrowserClient();

      // Fetch Images
      const { data: imageData } = await supabase
        .from("prompt_generations")
        .select("*")
        .eq("prompt_id", metaRow!.id)
        .order("created_at", { ascending: false })
        .limit(16);

      // Fetch Videos (linked via prompt_id directy - NEW logic)
      const { data: videoData } = await supabase
        .from("video_generations")
        .select("*")
        .eq("prompt_id", metaRow!.id)
        .order("created_at", { ascending: false })
        .limit(16);

      const combined = [
        ...(imageData || []).map((r: any) => ({ ...r, mediaType: "image" })),
        ...(videoData || []).map((r: any) => ({ ...r, mediaType: "video", image_url: r.thumbnail_url || r.image_url || "", video_url: r.video_url }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 16);

      console.log("DEBUG loadSpecific combined:", combined.length, combined[0]);

      if (combined.length > 0) {
        const userIds = Array.from(new Set(combined.map((r: any) => r.user_id).filter(Boolean)));
        let profileMap = new Map();

        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", userIds);
          profiles?.forEach((p: any) => profileMap.set(p.user_id, p));
        }

        const rows = combined.map((r: any) => {
          const profile = profileMap.get(r.user_id) || {};
          const settings = r.settings || {};
          return {
            id: String(r.id),
            imageUrl: String(r.image_url || ""),
            videoUrl: r.video_url, // Add this
            mediaType: r.mediaType, // Add this
            title: settings.headline || (r.mediaType === "video" ? "Animated Scene" : "Untitled Remix"),
            username: profile.full_name || "Anonymous Creator",
            userAvatar: profile.profile_image || null,
            upvotesCount: r.upvotes_count || 0,
            originalPromptText: r.prompt_text || r.original_prompt_text || r.prompt || "", // Fallback for video 'prompt'
            remixPromptText: r.remix || r.remix_prompt_text || "",
            combinedPromptText: r.final_prompt || r.combined_prompt_text || r.prompt || "",
            createdAt: r.created_at,
            promptId: r.prompt_id || null,
            prompt_slug: r.prompt_slug ?? null,
          };
        });
        setSpecificRemixes(rows); // Removed filter because videos don't have imageUrl
      }
      setSpecificLoading(false);
    }
    loadSpecific();
  }, [metaRow?.id, remixRefreshTrigger]);





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

  const uploadFile = async (file: File) => {
    // Compress before upload to save bandwidth and storage
    let fileToUpload = file;
    try {
      fileToUpload = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
    } catch (e) {
      console.warn("Compression failed for refine upload", e);
    }

    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const { data, error } = await supabase.storage
      .from("remix-images")
      .upload(fileName, fileToUpload);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from("remix-images")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  async function handleRefine(instruction: string) {
    if (generating || !generatedImageUrl) return;
    setGenerating(true);
    setGenerateError(null);

    // Scroll to preview on mobile
    if (typeof window !== "undefined" && window.innerWidth < 1024 && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      const refResponse = await fetch(generatedImageUrl);
      const refBlob = await refResponse.blob();
      const refFile = new File([refBlob], "ref_image.png", { type: refBlob.type });

      // Upload Reference Image Client-Side
      const refUrl = await uploadFile(refFile);

      // Upload User Inputs Client-Side
      const uploadPromises = uploads.slice(0, MAX_UPLOADS).map(file => uploadFile(file));
      const imageUrls = await Promise.all(uploadPromises);

      const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const payload = {
        template_reference_image: refUrl, // Send URL
        prompt: instruction,
        edit_instructions: instruction,
        userId,
        imageUrls // Send URLs
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
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

  function handleWizardComplete(summary: string, ans: RemixAnswers, shouldGenerate = false) {
    setEditSummary(summary);
    setRemixAnswers(ans);
    // uploads are updated via setUploads prop in wizard
    setWizardOpen(false);
    // When wizard completes (with valid output), switch to manual mode so user sees the result
    if (summary) setManualMode(true);

    if (shouldGenerate) {
      // Trigger generation with these fresh values
      handleGenerate({ prompt: summary, answers: ans });
    }
  }

  function handleRemixFromCard(row: any) {
    console.log("DEBUG handleRemixFromCard", { mediaType: row.mediaType, videoUrl: row.videoUrl, row });

    // Video Flow
    if (row.mediaType === "video" || row.videoUrl) {
      // alert("Video Remix Triggered: " + row.id); 
      setSelectedVideoRemix(row);
      setVideoRemixOpen(true);
      return;
    }

    // Image Flow
    if (row.image_url) {
      setOverridePreviewUrl(row.image_url);
    }
    // clear previous guided answers as we are starting a fresh remix on a new image
    setRemixAnswers(null);
    setEditSummary("");
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
    setRemixRefreshTrigger(prev => prev + 1);
  }

  async function handleGenerate(overrides?: { prompt?: string; answers?: RemixAnswers; files?: File[] }) {
    if (isLocked) {
      if (lockReason === "login") {
        router.push(`/login?redirectTo=${encodeURIComponent(`/prompts/${slug}`)}`);
      } else {
        router.push("/pricing");
      }
      return;
    }



    if (!userId || !metaRow?.id) {
      setGenerateError("Missing user info. Please refresh and try again.");
      return;
    }

    const promptToUse = overrides?.prompt ?? editSummary;
    const answersToUse = overrides?.answers ?? remixAnswers;
    const uploadsToUse = overrides?.files ?? uploads;

    if (!promptToUse) {
      setGenerateError("Please use 'Remix' to create instructions first.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    // Scroll to preview on mobile
    if (typeof window !== "undefined" && window.innerWidth < 1024 && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      // Upload Images Client-Side
      const uploadPromises = uploadsToUse.slice(0, MAX_UPLOADS).map(file => uploadFile(file));
      const imageUrls = await Promise.all(uploadPromises);

      // Upload Logo if exists
      let logoUrl = null;
      if (logo) {
        logoUrl = await uploadFile(logo); // Re-use uploadFile
      }

      // --- VIDEO GENERATION ---
      if (mediaType === "video") {
        let sourceImageWithBase64: string | undefined = !inputVideo ? imageSrc : undefined; // Default to template image

        // If user uploaded a file, convert to base64 for Image-to-Video
        // This matches Studio behavior handling
        if (uploadsToUse.length > 0) {
          try {
            let file = uploadsToUse[0];
            // Compress before base64 conversion (Fixes Payload Too Large)
            try {
              file = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
            } catch (ce) {
              console.warn("Video compression skipped", ce);
            }

            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
            sourceImageWithBase64 = base64;
          } catch (e) {
            console.warn("Failed to convert upload to base64", e);
            // Fallback to uploaded URL if base64 fails
            if (imageUrls.length > 0) sourceImageWithBase64 = imageUrls[0];
          }
        }

        const videoPayload = {
          image: sourceImageWithBase64,
          inputVideo: inputVideo || undefined, // Send video if extending
          prompt: promptToUse,
          // sourceImageId: metaRow.id, // REMOVED: Prompt ID != Generation ID
          // Only send sourceImageId if we are remixing an actual generation
          sourceImageId: undefined,
          promptId: metaRow.id, // NEW: Link to Prompt Template directly
          aspectRatio, // Ensure aspect ratio is sent
          userId, // Ensure userId is sent
          modelId: selectedModel // Pass selected video model
        };

        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(videoPayload),
        });

        const json = await res.json();
        if (!res.ok) {
          setGenerateError(json?.error || "Video generation failed.");
          setGenerating(false);
          return;
        }

        const vUrl = (json?.videoUrl || "").trim();
        if (vUrl) {
          setGeneratedImageUrl(vUrl);
          setOverridePreviewUrl(vUrl);
          refreshRemixes();
        } else {
          setGenerateError("No video returned.");
        }
        setGenerating(false);
        return;
      }

      // --- IMAGE GENERATION (Existing) ---
      const payload = {
        prompt: promptToUse,
        userId,
        aspectRatio,
        promptId: metaRow.id,
        promptSlug: metaRow.slug,
        edit_instructions: promptToUse,
        combined_prompt_text: promptToUse,

        subjectMode: answersToUse?.subjectMode || templateConfig?.subject_mode || "non_human",
        template_reference_image: imageSrc, // Used as reference for Remix

        imageUrls, // Send URLs
        logo_image: logoUrl,

        business_name: businessName,
        headline: answersToUse?.headline,
        subheadline: answersToUse?.subheadline,
        cta: answersToUse?.cta,
        promotion: answersToUse?.promotion,

        industry_intent: answersToUse?.industry_intent,
        subjectLock: answersToUse?.subjectLock,

        // Pass Selected Model
        modelId: selectedModel
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
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
      if (mediaType !== "video") setGenerating(false); // Video handles its own setGenerating(false)
    }
  }


  function clearGenerated() {
    setGeneratedImageUrl(null);
    setGenerateError(null);
    // Reset to template image when clearing
    setOverridePreviewUrl(null);
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
    generatedImageUrl && generatedImageUrl.trim().length > 0
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
          videoUrl={lightboxVideoUrl}
          mediaType={lightboxMediaType}
          onClose={closeLightbox}
          combinedPromptText={editSummary || fullPromptText || ""}
          onShare={handleShare}
          onRemix={handleRemixFocus}



        />

        {/* GLOBAL PAUSE BANNER */}
        {generationsPaused && (
          <div className={`mb-6 rounded-2xl border p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 ${isAdmin ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"
            }`}>
            <div className={`p-2 rounded-full ${isAdmin ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}>
              <TriangleAlert size={24} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isAdmin ? "text-amber-200" : "text-red-200"}`}>
                {isAdmin ? "Generations Paused (Admin Bypass Active)" : "Generations Paused"}
              </h3>
              <p className={`text-sm ${isAdmin ? "text-amber-200/70" : "text-red-200/70"}`}>
                {isAdmin
                  ? "System is paused for users, but you can still generate as an Admin."
                  : "System upgrades in progress. Please check back shortly."}
              </p>
            </div>
          </div>
        )}

        <div className="mb-5 sm:mb-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {/* Creator Profile */}
              {creatorProfile && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-800 shrink-0">
                    {creatorProfile.avatar_url ? (
                      <Image
                        src={creatorProfile.avatar_url}
                        alt={creatorProfile.full_name || "Creator"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/40">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white leading-none">
                      {creatorProfile.full_name || "Anonymous Creator"}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Community Member
                    </div>
                  </div>
                </div>
              )}
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
          <section className="order-1 lg:order-2" ref={previewRef}>
            <div className="lg:sticky lg:top-8">
              <button
                type="button"
                className="group relative block w-full text-left"
                onClick={() => {
                  // check if we are showing video
                  if (mediaType === "video" && generatedImageUrl) {
                    openLightbox(imageSrc, "video", generatedImageUrl);
                  } else {
                    openLightbox(imageSrc);
                  }
                }}
                title="Open full screen"
              >
                <div
                  className={[
                    "relative w-full overflow-hidden rounded-none bg-black/50 shadow-2xl transition-all duration-500 group-hover:shadow-[0_0_30px_-5px_rgba(183,255,0,0.1)]",
                    previewAspectClass,
                  ].join(" ")}
                >
                  {mediaType === "video" && (generatedImageUrl || inputVideo) ? (
                    <LazyMedia
                      src={generatedImageUrl || inputVideo || ""}
                      type="video"
                      className="absolute inset-0 w-full h-full object-cover"
                      poster={imageSrc}
                    />
                  ) : (
                    <Image
                      src={imageSrc}
                      alt={metaRow.title}
                      fill
                      className="object-contain"
                      priority
                      unoptimized
                    />
                  )}
                  {/* Generating Overlay */}
                  {generating && (
                    <GenerationOverlay />
                  )}

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

              <GenerationFailureNotification
                error={generateError}
                onClose={() => setGenerateError(null)}
                onRetry={() => handleGenerate()}
              />

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
            </div>

          </section>

          {/* TOOL PANEL */}
          <section className="order-2 lg:order-1 p-0 sm:p-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="text-xl font-bold tracking-tight text-white">Prompt Tool</div>
              {manualMode ? (
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className="text-xs font-bold text-white/40 hover:text-white uppercase tracking-wider transition-colors flex items-center gap-1 group"
                >
                  <ChevronLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                  Back to Menu
                </button>
              ) : (
                <div className="text-xs font-semibold text-lime-400 uppercase tracking-widest">AI Studio</div>
              )}
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
                      onClick={handleFreestyleEnter}
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

                  {/* Reference Images (Top - Parity with Studio) */}
                  {!isLocked && manualMode && (
                    <div className="mb-4">
                      <ImageUploader files={uploads} onChange={setUploads} disabled={!manualMode} />
                    </div>
                  )}

                  {/* Subject Mode & Lock (Parity with Studio) */}
                  {manualMode && !isLocked && (
                    <div className="flex items-center justify-between px-2 mb-4 animate-in fade-in zoom-in duration-300">
                      {/* Subject Toggle */}
                      <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                        <button
                          type="button"
                          onClick={() => setSubjectMode("human")}
                          className={`
                            px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5
                            ${subjectMode === "human" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-white/40 hover:text-white hover:bg-white/5"}
                          `}
                        >
                          <span>Human Subject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubjectMode("non_human")}
                          className={`
                            px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5
                            ${subjectMode === "non_human" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-white/40 hover:text-white hover:bg-white/5"}
                          `}
                        >
                          <span>Object</span>
                        </button>
                      </div>

                      {/* Lock Toggle */}
                      <button
                        type="button"
                        onClick={() => setSubjectLock(!subjectLock)}
                        className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
                          ${subjectLock
                            ? "bg-lime-400/10 border-lime-400/30 text-lime-400"
                            : "bg-black/40 border-white/10 text-white/40 hover:text-white hover:border-white/20"}
                        `}
                      >
                        <div className={`w-2 h-2 rounded-full ${subjectLock ? "bg-lime-400 animate-pulse" : "bg-white/20"}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {subjectLock ? "Strict Lock" : "Loose"}
                        </span>
                      </button>
                    </div>
                  )}

                  <textarea
                    readOnly={!manualMode || isLocked}
                    onClick={!manualMode && !isLocked ? undefined : undefined}
                    onChange={(e) => {
                      if (manualMode && !isLocked) {
                        setEditSummary(e.target.value);
                      }
                    }}
                    className={[
                      "w-full rounded-2xl border-0 p-5 text-sm outline-none transition-all placeholder:text-white/30 leading-relaxed font-medium resize-none shadow-inner",
                      isLocked
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-[#2A2A2A] text-white focus:ring-2 focus:ring-lime-400/30 ring-1 ring-white/5"
                    ].join(" ")}
                    rows={6}
                    placeholder={isLocked ? "Locked." : "Describe your image..."}
                    value={editSummary}
                  />
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
                <SelectPill
                  label="Video"
                  selected={mediaType === "video"}
                  disabled={isLocked || generating}
                  onClick={() => {
                    setMediaType("video");
                    // Auto-switch incompatible aspect ratios for video
                    if (aspectRatio === "1:1" || aspectRatio === "4:5") {
                      setAspectRatio("16:9");
                    }
                  }}
                />
              </div>

              <div className="mt-3">

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SelectPill
                    label="9:16"
                    description="Vertical"
                    icon={<Smartphone size={16} />}
                    selected={aspectRatio === "9:16"}
                    onClick={() => setAspectRatio("9:16")}
                    disabled={isLocked || generating}
                  />
                  <SelectPill
                    label="16:9"
                    description="Widescreen"
                    icon={<Monitor size={16} />}
                    selected={aspectRatio === "16:9"}
                    onClick={() => setAspectRatio("16:9")}
                    disabled={isLocked || generating}
                  />
                  <SelectPill
                    label="1:1"
                    description="Square Feed"
                    icon={<Square size={16} />}
                    selected={aspectRatio === "1:1"}
                    onClick={() => setAspectRatio("1:1")}
                    disabled={isLocked || generating || mediaType === "video"}
                  />
                  <SelectPill
                    label="4:5"
                    description="Rectangle Feed"
                    icon={<RectangleVertical size={16} />}
                    selected={aspectRatio === "4:5"}
                    onClick={() => setAspectRatio("4:5")}
                    disabled={isLocked || generating || mediaType === "video"}
                  />
                </div>
              </div>

              {/* MODEL SELECTOR (New) */}
              {mediaType === "image" && GENERATION_MODELS.length > 1 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">Model</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {GENERATION_MODELS.map((model) => (
                      <SelectPill
                        key={model.id}
                        label={model.label}
                        description={model.description}
                        selected={selectedModel === model.id}
                        onClick={() => setSelectedModel(model.id)}
                        disabled={modelsConfig && modelsConfig[model.id] === false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* VIDEO MODEL SELECTOR */}
              {mediaType === "video" && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">Video Model</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {VIDEO_MODELS.map((model) => (
                      <SelectPill
                        key={model.id}
                        label={model.label}
                        description={model.description}
                        selected={selectedModel === model.id}
                        onClick={() => setSelectedModel(model.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end pt-2">
              <button
                className={[
                  "w-full inline-flex items-center justify-center rounded-2xl px-8 py-4 text-sm font-bold tracking-tight text-black transition-all transform hover:scale-[1.02] shadow-[0_0_20px_-5px_#B7FF00]",
                  isLocked
                    ? "bg-white/10 text-white/40 hover:bg-white/15"
                    : generating
                      ? "bg-lime-400/60"
                      : "bg-lime-400 hover:bg-lime-300",
                ].join(" ")}
                onClick={() => handleGenerate()}
                disabled={isLocked || generating || (generationsPaused && !isAdmin)}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <LoadingHourglass className="w-5 h-5 text-black" />
                    <span>{mediaType === "video" ? "Creating Video..." : "Generating..."}</span>
                  </span>
                ) : lockReason === "login"
                  ? "Log in to Generate"
                  : isLocked
                    ? "Upgrade to Pro"
                    : mediaType === "video" ? (
                      <span className="flex items-center gap-2">
                        <Clapperboard size={18} />
                        <span>Animate Video</span>
                      </span>
                    ) : "Generate Artwork"}
              </button>
            </div>

            {/* 1. SPECIFIC REMIXES (Made with this Prompt) - Finite */}
            <div className="mt-8">
              <div className="flex items-center justify-between gap-3 mb-4 px-2">
                <div className="text-sm font-bold text-white uppercase tracking-widest opacity-80">
                  Made with this Prompt
                </div>
              </div>

              {specificLoading ? (
                <div className="px-2 text-sm text-white/40 animate-pulse">Loading remixes...</div>
              ) : specificRemixes.length === 0 ? (
                <div className="rounded-3xl border border-white/5 bg-white/5 p-8 text-center">
                  <p className="text-sm text-white/40">No remixes yet.</p>
                  <p className="text-xs text-white/20 mt-1">Be the first to remix this prompt!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {specificRemixes.map((r) => (
                    <div
                      key={r.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 hover:border-lime-400/30 transition-all hover:shadow-[0_0_15px_-5px_rgba(183,255,0,0.3)]"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/remix/${r.id}`)}
                        className="block w-full"
                        title="View Community Remix"
                      >
                        <div className="relative aspect-square w-full">
                          {r.mediaType === "video" && r.videoUrl ? (
                            <>
                              <LazyMedia
                                src={r.videoUrl || ""}
                                type="video"
                                className="absolute inset-0 w-full h-full object-cover"
                                poster={r.imageUrl || undefined}
                              />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-8 h-8 rounded-full border border-white/60 flex items-center justify-center group-hover:scale-110 group-hover:border-white transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                                  <svg className="w-4 h-4 text-white/90 ml-0.5 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="absolute top-2 right-2 z-10 bg-black/70 text-lime-400 text-[10px] font-bold uppercase px-2 py-1 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />
                                Video
                              </div>
                            </>
                          ) : (
                            <Image src={r.imageUrl} alt="Remix" fill className="object-cover transition duration-500 group-hover:scale-110" unoptimized />
                          )}
                        </div>
                      </button>

                      {/* Hover actions */}
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20">
                        <div className="pointer-events-auto absolute bottom-2 left-2 right-2 flex gap-1 justify-center z-30">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/remix/${r.id}`); }}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
                            title="View"
                          >
                            <span className="text-xs font-bold">VIEW</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemixFromCard(r); }}
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
            </div>

            {/* Community Feed */}
            <div className="mt-8 border-t border-white/10 pt-8">
              <StudioCommunityFeed />
            </div>

          </section >
        </div >


        <VideoGeneratorModal
          isOpen={videoRemixOpen}
          onClose={() => setVideoRemixOpen(false)}
          sourceImage={selectedVideoRemix?.imageUrl || ""}
          sourceImageId={selectedVideoRemix?.id}
          userId={userId || undefined}
        />
      </main >
    </>
  );
}

function SelectPill({
  label,
  description,
  icon,
  disabled,
  selected,
  onClick,
}: {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const base = "group relative flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all active:scale-[0.98]";
  const disabledCls = "cursor-not-allowed border-white/5 bg-white/5 text-white/20";
  const idleCls = "border-white/10 bg-zinc-900/50 text-zinc-400 hover:border-white/20 hover:bg-zinc-900 hover:text-white";
  const selectedCls = "border-[#B7FF00] bg-[#B7FF00]/5 text-[#B7FF00] shadow-[0_0_15px_-5px_rgba(183,255,0,0.3)]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={[base, disabled ? disabledCls : selected ? selectedCls : idleCls].join(" ")}
      aria-pressed={selected ? "true" : "false"}
    >
      {icon || description ? (
        <>
          {icon && <div className={`flex-shrink-0 transition-colors ${selected ? "text-[#B7FF00]" : "text-white/40 group-hover:text-white"}`}>{icon}</div>}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold uppercase tracking-wider ${selected ? "text-[#B7FF00]" : "text-white group-hover:text-white"}`}>{label}</div>
            {description && <div className={`text-[10px] mt-0.5 truncate ${selected ? "text-[#B7FF00]/70" : "text-white/30 group-hover:text-white/50"}`}>{description}</div>}
          </div>
        </>
      ) : (
        <div className={`text-sm font-medium ${selected ? "text-[#B7FF00]" : "text-white"}`}>{label}</div>
      )}
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
