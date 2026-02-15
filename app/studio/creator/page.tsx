"use client";

import { useState, useMemo, useEffect, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { transformAutoModeToPrompt, type AutoModeData } from "@/lib/autoModeTransformer";
import { compressImage } from "@/lib/compressImage";
import AutoModeChat from "../components/AutoModeChat";
import RemixChatWizard, { RemixAnswers, TemplateConfig } from "@/components/RemixChatWizard";
import ImageUploader from "@/components/ImageUploader";
import { Smartphone, Monitor, Square, RectangleVertical, ChevronLeft, Clapperboard, Download } from "lucide-react";
import LoadingHourglass from "@/components/LoadingHourglass";
import LoadingOrb from "@/components/LoadingOrb";
import SubjectControls from "../components/SubjectControls";
import VideoGeneratorModal from "@/components/VideoGeneratorModal";
import GenerationOverlay from "@/components/GenerationOverlay";
import LibraryImagePickerModal from "@/components/LibraryImagePickerModal";
import GenerationLightbox from "@/components/GenerationLightbox";
import { GenerationFailureNotification } from "@/components/GenerationFailureNotification";
import PromptCard from "@/components/PromptCard";
import RemixCard from "@/components/RemixCard";
import Link from "next/link";
import { ArrowRight, Library, TriangleAlert } from "lucide-react";
import GalleryBackToTop from "@/components/GalleryBackToTop";
import StudioCommunityFeed from "@/components/StudioCommunityFeed";
import { GENERATION_MODELS, VIDEO_MODELS, DEFAULT_MODEL_ID, DEFAULT_VIDEO_MODEL_ID } from "@/lib/model-config";

type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

function TypeWriter({ text }: { text: string }) {
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
        <div ref={ref} className="text-xl font-bold text-foreground tracking-tight mb-4 min-h-[28px]">
            {text.split("").map((char, i) => (
                <span
                    key={i}
                    className={`inline-block transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transitionDelay: `${i * 50}ms` }}
                >
                    {char === " " ? "\u00A0" : char}
                </span>
            ))}
            <span className={`inline-block ml-0.5 animate-pulse text-primary ${visible ? 'opacity-100' : 'opacity-0'}`}>|</span>
        </div>
    );
}

function CreatorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    // Mode state
    const [mode, setMode] = useState<"auto" | "manual" | "wizard">("manual");

    // Wizard State
    const [wizardOpen, setWizardOpen] = useState(false);
    const [remixAnswers, setRemixAnswers] = useState<RemixAnswers | null>(null);
    const [templateConfig, setTemplateConfig] = useState<TemplateConfig | undefined>(undefined);
    const [logo, setLogo] = useState<File | null>(null);
    const [businessName, setBusinessName] = useState<string>("");

    // User auth
    const [user, setUser] = useState<any>(null);

    // Global Pause State
    const [generationsPaused, setGenerationsPaused] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // Fetch Config & User Role
    useEffect(() => {
        const fetchConfig = async () => {
            const supabase = createSupabaseBrowserClient();

            // 1. Fetch Global Config
            const { data: pausedConfig } = await supabase.from("app_config").select("value").eq("key", "generations_paused").maybeSingle();
            if (pausedConfig) {
                setGenerationsPaused(pausedConfig.value === true || pausedConfig.value === "true");
            }

            // 2. Fetch User Role for Admin Bypass AND Credits
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from("profiles").select("role, credits").eq("user_id", user.id).maybeSingle();
                if (profile) {
                    const role = String(profile.role || "").toLowerCase();
                    if (role === "admin" || role === "super_admin") {
                        setIsAdmin(true);
                    }
                    setUserCredits(profile.credits ?? 0);
                }
            }

            // 3. Fetch Model Config
            const { data: models } = await supabase.from("app_config").select("value").eq("key", "model_availability").maybeSingle();
            if (models && models.value) {
                setModelsConfig(models.value);
            }
        };
        fetchConfig();
    }, []);

    // Manual mode state
    const [manualPrompt, setManualPrompt] = useState("");
    const [uploads, setUploads] = useState<File[]>([]);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:5");
    const [mediaType, setMediaType] = useState<"image" | "video">("image");

    // Credits
    const [userCredits, setUserCredits] = useState<number | null>(null);
    const VIDEO_COST = 30;
    const IMAGE_COST = 3;
    const isVideo = mediaType === "video";
    const currentCost = isVideo ? VIDEO_COST : IMAGE_COST;
    const hasCredits = isAdmin || (userCredits ?? 0) >= currentCost;
    const creditError = !hasCredits && userCredits !== null ? `Insufficient credits. Need ${currentCost}, have ${userCredits}.` : null;



    // Model Selection
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
    const [modelsConfig, setModelsConfig] = useState<any>({});

    // Video State
    const [animating, setAnimating] = useState(false);
    const [videoResult, setVideoResult] = useState<string | null>(null);
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const [videoSubMode, setVideoSubMode] = useState<"image_to_video" | "text_to_video">("image_to_video");
    const [libraryModalOpen, setLibraryModalOpen] = useState(false);

    // Intent check
    useEffect(() => {
        if (searchParams?.get("intent") === "video") {
            setMediaType("video");
        }
    }, [searchParams]);

    const [stylePreset, setStylePreset] = useState<string | null>(null);

    const STYLE_PRESETS = [
        { id: "cinematic", label: "Cinematic", icon: "🎬", prompt: "Shot on RED Weapon 8K with Panavision Primo 70mm lens. Cinematic lighting, color graded." },
        { id: "commercial", label: "TV Ad", icon: "📺", prompt: "Shot on ARRI Alexa Mini with Zeiss Master Prime 50mm. High key lighting, crisp, clean, premium advertisement look." },
        { id: "documentary", label: "Docu", icon: "📹", prompt: "Shot on Canon 5D Mk IV with Sigma 24-70mm f/2.8 lens. Natural lighting, handheld feel, authentic texture." },
        { id: "cartoon", label: "Cartoon", icon: "🎨", prompt: "3D Animation style by Pixar. Vibrant colors, expressive lighting, soft shading, cute characters." }
    ];

    // Subject Settings (Parity with Studio)
    const [subjectMode, setSubjectMode] = useState<"human" | "non_human">("human");
    const [subjectLock, setSubjectLock] = useState(true);
    const [subjectOutfit, setSubjectOutfit] = useState("");
    const [keepOutfit, setKeepOutfit] = useState(true);

    // Generation state
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string>("/orb-neon.gif"); // Default placeholder
    const previewRef = useRef<HTMLDivElement>(null);
    const shuffledRemixIds = useRef<string[]>([]);

    // Community Feed handled by StudioCommunityFeed component now

    const previewAspectClass = useMemo(() => {
        // Force 1:1 if showing the placeholder orb
        if (previewImage === "/orb-neon.gif") return "aspect-square";

        if (aspectRatio === "9:16") return "aspect-[9/16]";
        if (aspectRatio === "16:9") return "aspect-[16/9]";
        if (aspectRatio === "1:1") return "aspect-square";
        return "aspect-[4/5]";
    }, [aspectRatio, previewImage]);

    // Switch Default Model when Media Type Changes
    useEffect(() => {
        if (mediaType === "video") setSelectedModel(DEFAULT_VIDEO_MODEL_ID);
        else setSelectedModel(DEFAULT_MODEL_ID);
    }, [mediaType]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }: { data: { user: any } }) => setUser(data.user));
    }, [supabase]);

    // Update preview when user uploads an image manually
    useEffect(() => {
        if (mode === "manual" && uploads.length > 0 && previewImage === "/orb-neon.gif") {
            const url = URL.createObjectURL(uploads[0]);
            setPreviewImage(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [uploads, mode, previewImage]);

    // Handle Remix Params
    useEffect(() => {
        const remixPrompt = searchParams?.get("remix");
        const imgUrl = searchParams?.get("img");
        const promptId = searchParams?.get("promptId");

        if (remixPrompt || imgUrl) {

            // If image is present, set as preview (but don't auto-upload as file to avoid huge payloads/security errors)
            if (imgUrl) {
                setPreviewImage(imgUrl);
            }

            if (promptId) {
                // Template Remix -> Wizard
                setMode("wizard");
                setWizardOpen(true);

                supabase.from("prompts")
                    .select("template_config_json, subject_mode")
                    .eq("id", promptId)
                    .maybeSingle()
                    .then(({ data }: { data: { template_config_json: any; subject_mode: "human" | "non_human" } | null }) => {
                        if (data) {
                            const config = data.template_config_json || {};
                            setTemplateConfig({
                                editable_fields: config.editable_fields || [],
                                editable_groups: config.editable_groups || [],
                                subject_mode: data.subject_mode || config.subject_mode || "non_human"
                            });
                        } else {
                            // Fallback if ID invalid -> Auto Mode
                            setMode("auto");
                            setWizardOpen(false);
                        }
                    });
            } else {
                // Custom / Fallback Remix -> Auto Mode
                // "The idea is that there are never any carbon copies... sending it through the auto mode enforces a completely new generation"
                setMode("auto");
                setWizardOpen(false);
            }
        }
    }, [searchParams, supabase]);

    const handleWizardComplete = (summary: string, ans: RemixAnswers) => {
        setManualPrompt(summary);
        setRemixAnswers(ans);

        // Sync Subject Settings from Wizard
        if (ans.subjectLock === "false") setSubjectLock(false);
        else setSubjectLock(true);

        if (ans.subjectOutfit) {
            setSubjectOutfit(ans.subjectOutfit);
            setKeepOutfit(false); // CRITICAL: If user specified a new outfit, disable keepOutfit so the outfit change logic fires
        }
        if (ans.subjectMode === "non_human") setSubjectMode("non_human");
        else setSubjectMode("human");

        setWizardOpen(false);
        setMode("manual"); // Switch to manual to review/generate
    };

    const handleAuthGate = () => {
        if (!user) {
            router.push("/login"); // Consider adding redirectTo
            return false;
        }
        return true;
    };

    const handleAutoModeStart = () => {
        if (!handleAuthGate()) return;
        setMode("auto");
    };

    const handleAutoModeComplete = async (data: AutoModeData) => {
        const { prompt, uploads: autoUploads } = transformAutoModeToPrompt(data);

        // Auto-detect Subject Lock if subject photo is present
        const hasSubject = !!data.assets?.subject_photo;

        await generateImage(prompt, autoUploads, { subjectLock: hasSubject, logoFile: data.assets?.logo });
    };

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [resultData, setResultData] = useState<any>(null);

    const handleManualGenerate = async () => {
        if (!handleAuthGate()) return;

        if (!manualPrompt.trim()) {
            setError("Please describe what you want to create");
            return;
        }

        await generateImage(manualPrompt, uploads, { logoFile: logo });
    };

    // Helper: Staged Upload
    const uploadFile = async (file: File): Promise<string> => {
        try {
            // 1. Compress
            let compressed = file;
            try {
                // Use higher resolution for creator studio source images
                compressed = await compressImage(file, { maxWidth: 2048, quality: 0.85 });
            } catch (e) {
                console.warn("Compression failed, using original", e);
            }

            // 2. Get Signed URL
            const signRes = await fetch("/api/sign-upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: compressed.name,
                    fileType: compressed.type
                })
            });

            if (!signRes.ok) {
                const errText = await signRes.text();
                throw new Error(`Sign Failed: ${signRes.status} ${errText}`);
            }
            const { signedUrl, publicUrl } = await signRes.json();

            // 3. Upload to Storage
            console.log("Uploading file:", compressed.name, "Type:", compressed.type, "Size:", compressed.size);

            const uploadRes = await fetch(signedUrl, {
                method: "PUT",
                body: compressed,
                headers: { "Content-Type": compressed.type || 'application/octet-stream' }
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                console.error("Upload PUT Failed:", uploadRes.status, errText);
                console.error("Signed URL used:", signedUrl);
                alert(`Upload Failed (${uploadRes.status}): ${errText}`);
                throw new Error(`Upload Failed: ${uploadRes.status} ${errText}`);
            }

            return publicUrl;
        } catch (error) {
            console.error("Upload helper failed:", error);
            throw error;
        }
    };

    const generateImage = async (prompt: string, imageUploads: File[], options: { subjectLock?: boolean, logoFile?: File | null } = {}) => {
        setGenerating(true);
        setError(null);

        // Scroll to preview
        if (typeof window !== "undefined" && previewRef.current) {
            previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        try {
            if (!user?.id) {
                setError("Please log in.");
                setGenerating(false);
                return;
            }

            // 1. Upload Images Client-Side (Staging)
            const uploadPromises = imageUploads.map(file => uploadFile(file));
            const uploadedImageUrls = await Promise.all(uploadPromises);

            // 2. Upload Logo if exists
            let logoUrl = null;
            if (options.logoFile) {
                try {
                    logoUrl = await uploadFile(options.logoFile);
                } catch (e) {
                    console.warn("Logo upload failed", e);
                }
            }

            // 3. Build JSON Payload
            const stylePrompt = stylePreset ? STYLE_PRESETS.find(p => p.id === stylePreset)?.prompt : "";
            const finalPrompt = stylePrompt ? `${prompt}, ${stylePrompt}` : prompt;

            // Subject Settings
            const effectiveSubjectLock = options.subjectLock !== undefined ? options.subjectLock : subjectLock;

            const payload: any = {
                prompt: finalPrompt,
                userId: user.id,
                aspectRatio: aspectRatio,
                combined_prompt_text: prompt,
                modelId: selectedModel,
                subjectOutfit: subjectOutfit,

                // Passed as URLs now
                imageUrls: uploadedImageUrls,
                logo_image: logoUrl, // ✅ Pass Logo URL

                subjectLock: effectiveSubjectLock ? "true" : "false",
                forceCutout: (effectiveSubjectLock && subjectMode === "human") ? "true" : "false", // Only if lock is on
                subjectMode: subjectMode === "human" ? "human" : "object",
                keepOutfit: keepOutfit ? "true" : "false",

                // Remix Params inherited
                template_reference_image: searchParams?.get("img"),
            };

            // Mix in remix answers
            if (remixAnswers) {
                Object.assign(payload, {
                    headline: remixAnswers.headline,
                    subheadline: remixAnswers.subheadline,
                    cta: remixAnswers.cta,
                    promotion: remixAnswers.promotion,
                    business_name: remixAnswers.business_name,
                    industry_intent: remixAnswers.industry_intent,
                    instructions: remixAnswers.instructions,
                });
            }

            // Use AbortController with 300s timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);

            const res = await fetch("/api/creator-generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                // If not JSON, it's likely an HTML 500 error or network failure text
                console.error("Non-JSON response:", text);
            }

            if (!res.ok) {
                const msg = json?.message || json?.error || (text.length < 200 ? text : `Server Error (${res.status})`);
                throw new Error(msg || "Generation failed");
            }

            // Update Credits
            if (json.remainingCredits !== undefined) {
                setUserCredits(json.remainingCredits);
            }

            // Navigate to library to see result ... OR stay if Video Intent
            const intent = searchParams?.get("intent");
            if (intent === "video") {
                // Auto-switch to video tab & Open Modal
                setMediaType("video");

                const data = json;
                if (data && data.imageUrl) {
                    setPreviewImage(data.full_quality_url || data.imageUrl);
                    // Ensure state updates before opening
                    setTimeout(() => setVideoModalOpen(true), 100);
                }
            } else {
                // Inline Display for Creator Studio
                const data = json;
                if (data && data.imageUrl) {
                    const finalUrl = data.full_quality_url || data.imageUrl;
                    setPreviewImage(finalUrl);
                    setResultData(data);

                    // Open Lightbox
                    setLightboxOpen(true);
                }
            }

        } catch (err: any) {
            console.error("Generate Error:", err);
            // Detect timeout/abort
            if (err.name === 'AbortError') {
                setError("Request timed out. Please try again with a smaller image or better connection.");
            } else {
                setError(err.message || "Failed to generate");
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleAnimate = async () => {
        if (!handleAuthGate()) return;
        if (animating) return;

        const promptText = manualPrompt.trim();
        if (!promptText) {
            setError("Please describe the motion or scene you want to create.");
            return;
        }

        setAnimating(true);
        setError(null);
        setVideoResult(null);

        // Scroll to preview
        if (typeof window !== "undefined" && previewRef.current) {
            previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        try {
            let sourceImage: string | undefined;
            let subjectImageBase64: string | undefined;

            if (videoSubMode === "image_to_video") {
                sourceImage = (previewImage && previewImage !== "/orb-neon.gif") ? previewImage : undefined;

                if (uploads.length > 0) {
                    let file = uploads[0];
                    // Compress to prevent Payload Too Large
                    try {
                        file = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
                    } catch (e) {
                        console.warn("Compression skipped", e);
                    }

                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });

                    // In Image-to-Video, the upload IS the start frame. 
                    // We do NOT want to set subjectImageBase64, because that triggers Semantic Remix (Text-to-Video).
                    subjectImageBase64 = undefined;

                    if (!sourceImage || sourceImage.startsWith("blob:")) {
                        sourceImage = base64;
                    }
                }

                if (!sourceImage) {
                    setError("Please generate or upload an image first for Image-to-Video.");
                    setAnimating(false);
                    return;
                }
            } else {
                sourceImage = undefined;
                // For Text to Video, we skip images
            }

            const res = await fetch("/api/generate-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: sourceImage,
                    mainSubjectBase64: subjectImageBase64,
                    prompt: promptText,
                    userId: user?.id,
                    aspectRatio: aspectRatio,
                    sourceImageId: searchParams?.get("promptId") || undefined,
                    modelId: selectedModel
                })
            });

            let data;
            try {
                data = await res.json();
            } catch (jsonErr) {
                // If JSON fails (e.g. 504 Gateway Timeout HTML), read raw text
                const text = await res.text().catch(() => "Unknown server error");
                throw new Error(`Video Generation Failed (${res.status}): ${text.slice(0, 100)}`);
            }

            if (!res.ok) throw new Error(data.error || "Video generation failed");

            if (data.videoUrl) {
                if (data.remainingCredits !== undefined) {
                    setUserCredits(data.remainingCredits);
                }
                setVideoResult(data.videoUrl);
            } else {
                throw new Error("No video URL returned from server");
            }
        } catch (err: any) {
            console.error("Video Generation Error:", err);
            setAnimating(false);
        }
    };

    const handleShare = async (url: string) => {
        try {
            // 1. Fetch the image as a blob
            const res = await fetch(url);
            const blob = await res.blob();

            // 2. Create a File object
            const filename = `ai-creation-${Date.now()}.png`; // Simple timestamp filename
            const file = new File([blob], filename, { type: blob.type });

            // 3. Check if we can share files
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'My AI Artwork',
                    text: 'Check out what I created with AI!'
                });
            } else {
                // Fallback: Share just the URL if file sharing isn't supported
                await navigator.share({
                    title: 'My AI Artwork',
                    text: 'Check out what I created with AI!',
                    url: url
                });
            }
        } catch (err) {
            console.error("Share failed:", err);
        }
    };

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
                    <Clapperboard className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                    Creator Studio
                </h1>
                <p className="mt-2 text-muted-foreground">Generate stunning visuals in minutes</p>
            </div>

            {/* GLOBAL PAUSE BANNER */}
            {generationsPaused && (
                <div className={`mb-8 rounded-2xl border p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 ${isAdmin ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN: Controls */}
                <div className="lg:col-span-5 space-y-6 order-2 lg:order-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-foreground">Prompt Tool</h2>
                        <div className="text-xs font-bold text-primary uppercase tracking-wider">AI Studio</div>
                    </div>

                    <p className="text-xs text-muted-foreground/60 text-center italic">
                        AI is not perfect; it can make mistakes.
                    </p>

                    {/* Settings Card */}
                    <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-foreground">Settings</div>
                            </div>
                            <div className="text-xs font-mono text-primary">
                                {mediaType.toUpperCase()} / {aspectRatio}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <SelectPill
                                label="Image"
                                selected={mediaType === "image"}
                                onClick={() => setMediaType("image")}
                                disabled={generating || animating}
                            />
                            <SelectPill
                                label="Video"
                                selected={mediaType === "video"}
                                onClick={() => setMediaType("video")}
                                disabled={generating || animating}
                            />
                        </div>

                        {mediaType === "video" && (
                            <div className="mt-3 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <SelectPill
                                    label="Image to Video"
                                    description="Start Frame"
                                    selected={videoSubMode === "image_to_video"}
                                    onClick={() => setVideoSubMode("image_to_video")}
                                    disabled={generating || animating}
                                />
                                <SelectPill
                                    label="Text to Video"
                                    description="Words only"
                                    selected={videoSubMode === "text_to_video"}
                                    onClick={() => setVideoSubMode("text_to_video")}
                                    disabled={generating || animating}
                                />
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-border">
                            <div className="grid grid-cols-4 gap-2">
                                <SelectPill
                                    label="9:16"
                                    description="Vertical"
                                    icon={<Smartphone size={16} />}
                                    selected={aspectRatio === "9:16"}
                                    onClick={() => setAspectRatio("9:16")}
                                    disabled={generating}
                                />
                                <SelectPill
                                    label="16:9"
                                    description="Wide"
                                    icon={<Monitor size={16} />}
                                    selected={aspectRatio === "16:9"}
                                    onClick={() => setAspectRatio("16:9")}
                                    disabled={generating}
                                />
                                <SelectPill
                                    label="1:1"
                                    description="Square"
                                    icon={<Square size={16} />}
                                    selected={aspectRatio === "1:1"}
                                    onClick={() => setAspectRatio("1:1")}
                                    disabled={generating}
                                />
                                <SelectPill
                                    label="4:5"
                                    description="Rect"
                                    icon={<RectangleVertical size={16} />}
                                    selected={aspectRatio === "4:5"}
                                    onClick={() => setAspectRatio("4:5")}
                                    disabled={generating}
                                />
                            </div>
                        </div>

                        {/* Model Selector */}
                        {mediaType === "image" && GENERATION_MODELS.length > 1 && (
                            <div className="mt-4 pt-4 border-t border-border">
                                <div className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Model</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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

                        {/* Video Model Selector - Only show if multiple models */}
                        {mediaType === "video" && VIDEO_MODELS.length > 1 && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">Video Model</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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



                    {/* Style Presets */}
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            Style Preset <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Optional</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {STYLE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() => setStylePreset(stylePreset === preset.id ? null : preset.id)}
                                    className={`
                                            relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all group overflow-hidden
                                            ${stylePreset === preset.id
                                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                            : "bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border"
                                        }
                                        `}
                                >
                                    <div className={`text-2xl transition-transform duration-300 ${stylePreset === preset.id ? "scale-110" : "group-hover:scale-110"}`}>{preset.icon}</div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold uppercase tracking-wide truncate">{preset.label}</span>
                                        <span className={`text-[9px] leading-tight truncate opacity-70 ${stylePreset === preset.id ? "text-black" : "text-white"}`}>
                                            {preset.prompt.split("with")[0].replace("Shot on ", "")}
                                        </span>
                                    </div>

                                    {/* Selection Ring */}
                                    {stylePreset === preset.id && (
                                        <div className="absolute inset-0 border-2 border-black/10 rounded-xl" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>


                    {/* Prompt Tool Card */
                    }
                    <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden min-h-[300px]">
                        {/* Choice Overlay Removed as requested */}

                        <RemixChatWizard
                            isOpen={wizardOpen}
                            onClose={() => {
                                setWizardOpen(false);
                            }}
                            onComplete={handleWizardComplete}
                            templatePreviewUrl={previewImage}
                            initialValues={remixAnswers}
                            uploads={uploads}
                            onUploadsChange={setUploads}
                            logo={logo}
                            onLogoChange={setLogo}
                            businessName={businessName}
                            onBusinessNameChange={setBusinessName}
                            templateConfig={templateConfig}
                            isGuest={!user}
                            onGuestInteraction={() => handleAuthGate()}
                        />

                        {/* AUTO MODE */}
                        {mode === "auto" && (
                            <div>
                                <AutoModeChat
                                    onComplete={handleAutoModeComplete}
                                    disabled={generating}
                                    initialReferenceImage={uploads[0] || null}
                                />
                            </div>
                        )}

                        {/* MANUAL MODE */}
                        <div className={`relative transition-all duration-500`}>
                            {(mediaType === "image" || (mediaType === "video" && videoSubMode === "image_to_video")) && (
                                <div className="mb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="text-xs font-bold text-white/50 uppercase tracking-wide">
                                        {mediaType === "video" ? "Start Frame" : "Reference Images"}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setLibraryModalOpen(true)}
                                        className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-lime-400/30 bg-lime-400/5 py-4 text-sm font-bold text-lime-400 transition-all hover:border-lime-400 hover:bg-lime-400/10 hover:shadow-[0_0_20px_-5px_#B7FF00] active:scale-[0.98]"
                                    >
                                        <Library size={18} className="transition-transform group-hover:scale-110" />
                                        <span>PICK FROM YOUR LIBRARY</span>
                                    </button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                            <div className="w-full border-t border-white/5"></div>
                                        </div>
                                        <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                            <span className="bg-[#121212] px-2 text-white/20">or upload new</span>
                                        </div>
                                    </div>

                                    <ImageUploader files={uploads} onChange={setUploads} onUploadStart={handleAuthGate} />

                                    {uploads.length > 0 && (
                                        <SubjectControls
                                            subjectMode={subjectMode}
                                            setSubjectMode={setSubjectMode}
                                            subjectLock={subjectLock}
                                            setSubjectLock={setSubjectLock}
                                            subjectOutfit={subjectOutfit}
                                            setSubjectOutfit={setSubjectOutfit}
                                            keepOutfit={keepOutfit}
                                            setKeepOutfit={setKeepOutfit}
                                        />
                                    )}
                                </div>
                            )}

                            <textarea
                                onChange={(e) => setManualPrompt(e.target.value)}
                                className="w-full rounded-2xl border-0 bg-[#2A2A2A] p-5 text-sm text-white outline-none transition-all placeholder:text-white/30 leading-relaxed font-medium resize-none shadow-inner focus:ring-2 focus:ring-lime-400/30 ring-1 ring-white/5"
                                rows={8}
                                placeholder="Describe your image..."
                                value={manualPrompt}
                                onClick={handleAuthGate}
                                onFocus={handleAuthGate}
                            />
                        </div>
                    </div>



                    {/* Generate Button */}
                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
                            {error}
                        </div>
                    )}
                    {creditError && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
                            {creditError}
                        </div>
                    )}

                    {mediaType === "video" ? (
                        <button
                            className={[
                                "w-full inline-flex items-center justify-center rounded-2xl px-8 py-5 text-base font-bold tracking-tight text-black transition-all transform hover:scale-[1.01] shadow-[0_0_20px_-5px_#B7FF00]",
                                animating || !hasCredits ? "bg-lime-400/60 opacity-70 cursor-not-allowed" : "bg-lime-400 hover:bg-lime-300",
                            ].join(" ")}
                            onClick={handleAnimate}
                            disabled={animating || (generationsPaused && !isAdmin) || !hasCredits}
                        >
                            {animating ? (
                                <span className="flex items-center gap-2">
                                    <LoadingHourglass className="w-5 h-5 text-black" />
                                    <span>Creating Video...</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Clapperboard size={20} />
                                    <span>{videoSubMode === "image_to_video" ? "Animate Image" : "Generate Video"} ({isAdmin ? "∞" : VIDEO_COST} Cr)</span>
                                </span>
                            )}
                        </button>
                    ) : (
                        <button
                            className={[
                                "w-full inline-flex items-center justify-center rounded-2xl px-8 py-5 text-base font-bold tracking-tight text-black transition-all transform hover:scale-[1.01] shadow-[0_0_20px_-5px_#B7FF00]",
                                generating || !hasCredits ? "bg-lime-400/60 opacity-70 cursor-not-allowed" : "bg-lime-400 hover:bg-lime-300",
                            ].join(" ")}
                            onClick={mode === "auto" ? undefined : handleManualGenerate}
                            disabled={generating || (generationsPaused && !isAdmin) || !hasCredits}
                        >
                            {generating ? (
                                <span className="flex items-center gap-2">
                                    <LoadingHourglass className="w-5 h-5 text-black" />
                                    <span>Generating...</span>
                                </span>
                            ) : `Generate Artwork (${isAdmin ? "∞" : IMAGE_COST} Cr)`}
                        </button>
                    )}



                    <GenerationFailureNotification
                        error={error}
                        onClose={() => setError(null)}
                        onRetry={() => generateImage(manualPrompt || "", uploads)}
                    />

                    <StudioCommunityFeed />
                </div>

                {/* RIGHT COLUMN: Preview / Results */}
                <div className="lg:col-span-7 order-1 lg:order-2" ref={previewRef}>
                    <div className="sticky top-8 w-full flex flex-col space-y-4">
                        <div className={`order-2 lg:order-1 relative w-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden shadow-2xl transition-all duration-300 ${previewAspectClass}`}>
                            {/* Generating Overlay */}
                            {generating && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl transition-all duration-500">
                                    <GenerationOverlay label={mediaType === "video" ? "GENERATING VIDEO" : "GENERATING IMAGE"} />
                                </div>
                            )}

                            {videoResult ? (
                                <video
                                    src={videoResult}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    autoPlay
                                    loop
                                    controls
                                    playsInline
                                />
                            ) : (
                                <Image
                                    src={previewImage}
                                    alt="Preview"
                                    fill
                                    className={`object-cover ${previewImage !== "/orb-neon.gif" ? "opacity-80" : ""}`}
                                    unoptimized
                                />
                            )}

                            {/* Only show overlay for actual images, not the placeholder */}
                            {previewImage !== "/orb-neon.gif" && !videoResult && (
                                <div className="absolute inset-0 bg-black/35 pointer-events-none" />
                            )}

                            {/* Download Button for Video */}
                            {videoResult && (
                                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30">
                                    <a
                                        href={videoResult}
                                        download="video.mp4"
                                        className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-zinc-200 transition-colors"
                                    >
                                        <Download size={18} /> Download
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Placeholder Text - Responsive Order (Top on mobile, Bottom upon desktop) */}
                        {(!previewImage || previewImage === "/orb-neon.gif") && !videoResult && (
                            <div className="w-full flex justify-center order-1 lg:order-2">
                                <div className="bg-black/50 backdrop-blur-md rounded-xl p-6 w-full border border-white/5 text-center">
                                    <h3 className="text-2xl font-bold text-white mb-2">{mediaType === "video" ? "Your Video" : "Your Artwork"}</h3>
                                    <p className="text-sm text-white/50">
                                        Generated {mediaType === "video" ? "videos" : "images"} will appear here. You can then edit, download, or share them.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Video Modal is only used for Remix Cards / Library items now, 
                Studio handles its own inline generation */}
            <VideoGeneratorModal
                isOpen={videoModalOpen}
                onClose={() => setVideoModalOpen(false)}
                sourceImage={previewImage}
                initialPrompt={manualPrompt}
                initialModelId={selectedModel}
            />
            <LibraryImagePickerModal
                isOpen={libraryModalOpen}
                onClose={() => setLibraryModalOpen(false)}
                onSelect={async (url) => {
                    setPreviewImage(url);
                    try {
                        const res = await fetch(url);
                        const blob = await res.blob();
                        let file = new File([blob], "library_ref.jpg", { type: "image/jpeg" });
                        try {
                            file = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
                        } catch (e) { console.warn(e); }
                        setUploads((prev) => [...prev, file]);
                    } catch (err) {
                        console.error("Failed to fetch library img:", err);
                    }
                }}
            />

            {/* Lightbox for Inline Preview */}
            <GenerationLightbox
                open={lightboxOpen}
                url={previewImage}
                videoUrl={null}
                mediaType="image"
                onClose={() => setLightboxOpen(false)}
                title={manualPrompt || "Generated Image"}
                originalPromptText={manualPrompt}
                combinedPromptText={manualPrompt}
                onAnimate={() => {
                    setLightboxOpen(false);
                    setMediaType("video");
                    setVideoSubMode("image_to_video");
                    // previewImage is already set to the result, so it will be used as source
                    // Scroll to preview/settings
                    previewRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                onShare={handleShare}
                fullQualityUrl={resultData?.full_quality_url}
            />
        </main>
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
    const base = "group relative flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition-all active:scale-[0.98] h-full";
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
            {icon && <div className={`flex-shrink-0 transition-colors ${selected ? "text-[#B7FF00]" : "text-white/40 group-hover:text-white"}`}>{icon}</div>}
            <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${selected ? "text-[#B7FF00]" : "text-white group-hover:text-white"}`}>{label}</div>
                {description && <div className={`text-[9px] mt-0.5 truncate ${selected ? "text-[#B7FF00]/70" : "text-white/30 group-hover:text-white/50"}`}>{description}</div>}
            </div>
        </button>
    );
}

export default function CreatorPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-white/50">Loading Studio...</div>}>
            <CreatorContent />
        </Suspense>
    );
}
