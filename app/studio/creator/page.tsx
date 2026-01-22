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
import { Smartphone, Monitor, Square, RectangleVertical, ChevronLeft } from "lucide-react";
import LoadingHourglass from "@/components/LoadingHourglass";
import LoadingOrb from "@/components/LoadingOrb";
import { GenerationFailureNotification } from "@/components/GenerationFailureNotification";
import PromptCard from "@/components/PromptCard";
import RemixCard from "@/components/RemixCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import GalleryBackToTop from "@/components/GalleryBackToTop";

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
        <div ref={ref} className="text-xl font-bold text-white tracking-tight mb-4 min-h-[28px]">
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

function CreatorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    // Mode state
    const [mode, setMode] = useState<"auto" | "manual" | "wizard" | null>(null);

    // Wizard State
    const [wizardOpen, setWizardOpen] = useState(false);
    const [remixAnswers, setRemixAnswers] = useState<RemixAnswers | null>(null);
    const [templateConfig, setTemplateConfig] = useState<TemplateConfig | undefined>(undefined);
    const [logo, setLogo] = useState<File | null>(null);
    const [businessName, setBusinessName] = useState<string>("");

    // User auth
    const [user, setUser] = useState<any>(null);

    // Manual mode state
    const [manualPrompt, setManualPrompt] = useState("");
    const [uploads, setUploads] = useState<File[]>([]);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:5");
    const [mediaType, setMediaType] = useState<"image" | "video">("image");

    // Generation state
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string>("/orb-neon.gif"); // Default placeholder
    const previewRef = useRef<HTMLDivElement>(null);
    const shuffledRemixIds = useRef<string[]>([]);

    // Community Feed Data
    const [communityPrompts, setCommunityPrompts] = useState<any[]>([]);
    const [communityRemixes, setCommunityRemixes] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingRemixes, setLoadingRemixes] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);

    const lastRemixRef = useCallback((node: HTMLDivElement | null) => {
        if (loadingRemixes) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore) {
                setPage((prev) => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingRemixes, hasMore]);

    const previewAspectClass = useMemo(() => {
        if (aspectRatio === "9:16") return "aspect-[9/16]";
        if (aspectRatio === "16:9") return "aspect-[16/9]";
        if (aspectRatio === "1:1") return "aspect-square";
        return "aspect-[4/5]";
    }, [aspectRatio]);

    // Fetch Prompts (Once)
    useEffect(() => {
        const fetchPrompts = async () => {
            const { data: promptsData } = await supabase
                .from("prompts_public")
                .select("id, title, slug, summary, category, access_level, image_url, featured_image_url, media_url")
                .order("created_at", { ascending: false })
                .limit(4);

            if (promptsData) setCommunityPrompts(promptsData);
        };
        fetchPrompts();
    }, [supabase]);

    // Fetch Remixes (Paginated)
    useEffect(() => {
        const fetchRemixes = async () => {
            if (!hasMore) return;
            setLoadingRemixes(true);

            const LIMIT = 6;

            // Initial Fetch & Shuffle (Client-side)
            if (page === 0 && shuffledRemixIds.current.length === 0) {
                try {
                    const { data: allIds } = await supabase
                        .from("prompt_generations")
                        .select("id")
                        .eq("is_public", true)
                        .order("created_at", { ascending: false })
                        .limit(500); // Fetch recent 500

                    if (allIds && allIds.length > 0) {
                        const ids = allIds.map((x: any) => x.id);
                        // Fisher-Yates Shuffle
                        for (let i = ids.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [ids[i], ids[j]] = [ids[j], ids[i]];
                        }
                        shuffledRemixIds.current = ids;
                    }
                } catch (e) {
                    console.error("Failed to fetch ids", e);
                }
            }

            const start = page * LIMIT;
            const end = start + LIMIT;
            const pageIds = shuffledRemixIds.current.slice(start, end);

            if (pageIds.length === 0) {
                if (shuffledRemixIds.current.length > 0) {
                    setHasMore(false);
                } else {
                    setHasMore(false);
                }
                setLoadingRemixes(false);
                return;
            }

            const { data: remixesData } = await supabase
                .from("prompt_generations")
                .select(`
                     id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text,
                     user_id, prompt_id
                  `)
                .in("id", pageIds);

            if (remixesData) {
                if (remixesData.length < LIMIT) {
                    setHasMore(false);
                }

                // Fetch profiles for remixes
                const userIds = Array.from(new Set(remixesData.map((r: any) => r.user_id)));
                let profileMap = new Map();
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", userIds);
                    profiles?.forEach((p: any) => profileMap.set(p.user_id, p));
                }

                const processedRemixes = remixesData.map((r: any) => {
                    const profile = profileMap.get(r.user_id) || {};
                    const settings = r.settings || {};
                    return {
                        id: r.id,
                        imageUrl: r.image_url,
                        title: settings.headline || "Untitled Remix",
                        username: profile.full_name || "Anonymous Creator",
                        userAvatar: profile.profile_image || null,
                        upvotesCount: r.upvotes_count || 0,
                        originalPromptText: r.original_prompt_text,
                        remixPromptText: r.remix_prompt_text,
                        combinedPromptText: r.combined_prompt_text,
                        createdAt: r.created_at,
                        promptId: r.prompt_id || null
                    };
                });

                setCommunityRemixes((prev) => {
                    // Sort processedRemixes to match pageIds (random order)
                    const sortedNew = pageIds.map(pid => processedRemixes.find((r: any) => r.id === pid)).filter(Boolean);

                    // Avoid duplicates just in case
                    const newIds = new Set(sortedNew.map((r: any) => r.id));
                    const filteredPrev = prev.filter(p => !newIds.has(p.id));
                    return [...filteredPrev, ...sortedNew];
                });
            } else {
                setHasMore(false);
            }
            setLoadingRemixes(false);
        };
        fetchRemixes();
    }, [page, supabase]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }: { data: { user: any } }) => setUser(data.user));
    }, [supabase]);

    // Handle Remix Params
    useEffect(() => {
        const remixPrompt = searchParams?.get("remix");
        const imgUrl = searchParams?.get("img");
        const promptId = searchParams?.get("promptId");

        if (remixPrompt || imgUrl) {

            // If image is present, set as preview and fetch file
            if (imgUrl) {
                setPreviewImage(imgUrl);

                const fetchImage = async () => {
                    try {
                        const res = await fetch(imgUrl);
                        const blob = await res.blob();
                        // Sanitize and Compress the reference image to prevent upload timeouts
                        let file = new File([blob], "remix_reference.jpg", { type: "image/jpeg" });
                        try {
                            file = await compressImage(file, { maxWidth: 1536, quality: 0.8 });
                        } catch (e) {
                            console.warn("Failed to compress remix ref", e);
                        }
                        setUploads((prev) => [...prev, file]);
                    } catch (err) {
                        console.error("Failed to load remix image as file:", err);
                    }
                };
                fetchImage();
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

        await generateImage(prompt, autoUploads, { subjectLock: hasSubject });
    };

    const handleManualGenerate = async () => {
        if (!handleAuthGate()) return;

        if (!manualPrompt.trim()) {
            setError("Please describe what you want to create");
            return;
        }

        await generateImage(manualPrompt, uploads);
    };

    const generateImage = async (prompt: string, imageUploads: File[], options: { subjectLock?: boolean } = {}) => {
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

            const form = new FormData();
            form.append("prompt", prompt);
            form.append("userId", user.id);
            form.append("aspectRatio", aspectRatio);
            form.append("combined_prompt_text", prompt);

            if (options.subjectLock) {
                form.append("subjectLock", "true");
            }

            // Upload images directly via FormData
            imageUploads.slice(0, 10).forEach((file) => {
                // DEFENSE IN DEPTH: Sanitize filename one last time before append
                // This prevents "Browser Security" (InvalidCharacterError) if upstream sanitization failed
                const safeName = (file.name || "image.jpg").replace(/[^a-zA-Z0-9.-]/g, "_");
                form.append("images", file, safeName);
            });

            // Note: If we need template reference or remix details, append them here.
            // For now, matching previous logic which only used prompt + uploads.

            const res = await fetch("/api/generate", {
                method: "POST",
                body: form,
            });


            const json = await res.json();

            if (!res.ok) {
                throw new Error(json?.message || json?.error || "Generation failed");
            }

            // Navigate to library to see result
            router.push("/library");

        } catch (err: any) {
            setError(err.message || "Failed to generate");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-white">Creator Studio</h1>
                <p className="mt-2 text-white/60">Generate stunning visuals in minutes</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN: Controls */}
                <div className="lg:col-span-5 space-y-6 order-2 lg:order-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white">Prompt Tool</h2>
                        {mode !== null ? (
                            <button
                                onClick={() => setMode(null)}
                                className="text-xs font-bold text-white/40 hover:text-white uppercase tracking-wider transition-colors flex items-center gap-1 group"
                            >
                                <ChevronLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                                Back to Menu
                            </button>
                        ) : (
                            <div className="text-xs font-bold text-[#B7FF00] uppercase tracking-wider">AI Studio</div>
                        )}
                    </div>

                    {/* Prompt Tool Card */}
                    <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden min-h-[300px]">
                        {/* Overlay for AUTO vs MANUAL choice */}
                        {mode === null && !generating && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-md transition-all duration-300">
                                <TypeWriter text="How do you want to start?" />
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={handleAutoModeStart}
                                        className="group flex w-36 items-center justify-center gap-2 rounded-full bg-lime-400 py-2.5 text-xs font-bold uppercase tracking-wide text-black shadow-[0_0_15px_-5px_#B7FF00] transition-all hover:scale-105 hover:bg-lime-300 hover:shadow-[0_0_20px_-5px_#B7FF00]"
                                    >
                                        <span>Auto</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-black">
                                            <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode("manual")}
                                        className="group flex w-36 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/40 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/10 hover:border-white/30 transition-all hover:scale-105"
                                    >
                                        <span>Manual</span>
                                        <span className="text-xs opacity-50 group-hover:opacity-100">✎</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <RemixChatWizard
                            isOpen={wizardOpen}
                            onClose={() => {
                                setWizardOpen(false);
                                if (mode === "wizard") setMode(null); // Cancel back to menu if pure wizard
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
                        {mode === "manual" && (
                            <div className={`relative transition-all duration-500 ${mode === null ? 'blur-sm opacity-40 scale-[0.98]' : ''}`}>
                                <textarea
                                    onChange={(e) => setManualPrompt(e.target.value)}
                                    className="w-full rounded-2xl rounded-tl-none border-0 bg-[#2A2A2A] p-5 text-sm text-white outline-none transition-all placeholder:text-white/30 leading-relaxed font-medium resize-none shadow-inner focus:ring-2 focus:ring-lime-400/30 ring-1 ring-white/5"
                                    rows={8}
                                    placeholder="Describe your image..."
                                    value={manualPrompt}
                                    onClick={handleAuthGate}
                                    onFocus={handleAuthGate}
                                />

                                <div className="mt-4">
                                    <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">Reference Images</div>
                                    <ImageUploader files={uploads} onChange={setUploads} onUploadStart={handleAuthGate} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Settings Card */}
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-white/90">Settings</div>
                            </div>
                            <div className="text-xs font-mono text-lime-400/80">
                                {mediaType.toUpperCase()} / {aspectRatio}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <SelectPill
                                label="Image"
                                selected={mediaType === "image"}
                                onClick={() => setMediaType("image")}
                                disabled={generating}
                            />
                            <SelectPill label="Video" disabled />
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5">
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
                    </div>

                    {/* Generate Button */}
                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
                            {error}
                        </div>
                    )}

                    <button
                        className={[
                            "w-full inline-flex items-center justify-center rounded-2xl px-8 py-5 text-base font-bold tracking-tight text-black transition-all transform hover:scale-[1.01] shadow-[0_0_20px_-5px_#B7FF00]",
                            generating ? "bg-lime-400/60" : "bg-lime-400 hover:bg-lime-300",
                        ].join(" ")}
                        onClick={mode === "auto" ? undefined : handleManualGenerate}
                        disabled={generating}
                    >
                        {generating ? (
                            <span className="flex items-center gap-2">
                                <LoadingHourglass className="w-5 h-5 text-black" />
                                <span>Generating...</span>
                            </span>
                        ) : "Generate Artwork"}
                    </button>



                    {/* Trending Prompts */}
                    {communityPrompts.length > 0 && (
                        <div className="pt-6 border-t border-white/10">
                            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider opacity-60">Trending Prompts</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {communityPrompts.map((p) => (
                                    <div key={p.id} className="scale-[0.85] origin-top-left -mr-[15%] -mb-[15%]">
                                        <PromptCard
                                            id={p.id}
                                            title={p.title}
                                            summary={p.summary || ""}
                                            slug={p.slug}
                                            featuredImageUrl={p.featured_image_url || p.image_url || p.media_url}
                                            category={p.category}
                                            accessLevel={p.access_level}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 flex justify-center">
                                <Link
                                    href="/prompts"
                                    className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 hover:scale-105 hover:border-lime-400/50"
                                >
                                    <span>View More Templates</span>
                                    <ArrowRight size={16} className="text-lime-400 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </div>
                        </div>
                    )}

                    <GenerationFailureNotification
                        error={error}
                        onClose={() => setError(null)}
                        onRetry={() => generateImage(manualPrompt || "", uploads)}
                    />

                    {/* Community Remixes */}
                    {communityRemixes.length > 0 && (
                        <div className="pt-6 border-t border-white/10">
                            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider opacity-60">Community Remixes</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {communityRemixes.map((r, index) => (
                                    <div key={r.id} ref={index === communityRemixes.length - 1 ? lastRemixRef : null}>
                                        <RemixCard item={r} />
                                    </div>
                                ))}
                            </div>
                            {loadingRemixes && (
                                <div className="py-4 flex justify-center w-full">
                                    <LoadingOrb />
                                </div>
                            )}

                            {/* Sticky Back To Top for Feed */}
                            <div className="sticky bottom-8 flex justify-center pointer-events-none z-50 mt-8">
                                <GalleryBackToTop />
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Preview / Results */}
                <div className="lg:col-span-7 order-1 lg:order-2" ref={previewRef}>
                    <div className={`sticky top-8 w-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden shadow-2xl transition-all duration-300 ${previewAspectClass}`}>
                        {/* Generating Overlay */}
                        {generating && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl transition-all duration-500">
                                <LoadingOrb />
                            </div>
                        )}

                        <Image
                            src={previewImage}
                            alt="Preview"
                            fill
                            className="object-cover opacity-80"
                            unoptimized
                        />

                        <div className="absolute inset-0 bg-black/35 pointer-events-none" />

                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Your Artwork</h3>
                            <p className="text-sm text-white/50">
                                Generated images will appear here. You can then edit, download, or share them.
                            </p>
                        </div>
                    </div>
                </div>
            </div >
        </main >
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
