"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { GenerationFailureNotification } from "@/components/GenerationFailureNotification";
import RemixChatWizard, { RemixAnswers } from "@/components/RemixChatWizard";
import GenerationLightbox from "@/components/GenerationLightbox";
import ImageUploader from "@/components/ImageUploader";
import Loading from "@/components/Loading";
import { ArrowLeft, Sparkles, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

type MediaType = "image" | "video";
const ASPECTS = ["9:16", "16:9", "1:1", "4:5", "3:4"] as const;
type AspectRatio = (typeof ASPECTS)[number];

function normalize(v: any) {
    return typeof v === "string" ? v.trim() : "";
}

function pill(selected: boolean) {
    return selected
        ? "rounded-full px-4 py-2 text-sm font-semibold bg-[#B7FF00] text-black cursor-pointer transition"
        : "rounded-full px-4 py-2 text-sm font-semibold bg-white/10 text-white/70 hover:bg-white/20 cursor-pointer transition";
}

type Props = {
    params: Promise<{ lessonId: string }>;
};

type MissionData = {
    lesson: any;
    bootcamp: any;
    template: any;
};

export default function MissionStudioPage({ params }: Props) {
    const { lessonId } = use(params);
    const router = useRouter();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    // Mission context
    const [missionData, setMissionData] = useState<MissionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Studio state
    const [mediaType, setMediaType] = useState<MediaType>("image");
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
    const [uploads, setUploads] = useState<File[]>([]);
    const [logo, setLogo] = useState<File | null>(null);
    const [businessName, setBusinessName] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editSummary, setEditSummary] = useState("");
    const [wizardAnswers, setWizardAnswers] = useState<RemixAnswers | null>(null);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);
    const [lastImageUrl, setLastImageUrl] = useState("");
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState("");
    const previewRef = useRef<HTMLDivElement>(null);

    // Completion state
    const [completing, setCompleting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [generationId, setGenerationId] = useState<string | null>(null);

    // Load mission data
    useEffect(() => {
        async function loadMission() {
            try {
                // Get user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push("/login");
                    return;
                }

                // Get lesson with bootcamp
                const { data: lesson, error: lessonError } = await supabase
                    .from("lessons")
                    .select("*, bootcamps(id, slug, title)")
                    .eq("id", lessonId)
                    .single();

                if (lessonError || !lesson) {
                    setError("Mission not found");
                    setLoading(false);
                    return;
                }

                // Get template if specified
                let template = null;
                const templateId = lesson.create_action_payload?.template_id;
                if (templateId) {
                    // Try prompts_public first (public templates)
                    const { data: publicTemplate } = await supabase
                        .from("prompts_public")
                        .select("*")
                        .eq("id", templateId)
                        .single();

                    if (publicTemplate) {
                        template = publicTemplate;
                    } else {
                        // Try prompts table
                        const { data: privateTemplate } = await supabase
                            .from("prompts")
                            .select("*")
                            .eq("id", templateId)
                            .single();
                        template = privateTemplate;
                    }
                }

                setMissionData({
                    lesson,
                    bootcamp: lesson.bootcamps,
                    template,
                });

                // Set template preview image
                if (template?.image_url) {
                    setPreviewImageUrl(template.image_url);
                }

                // Mark mission as started
                await fetch(`/api/lessons/${lessonId}/start`, { method: "POST" });

                // Auto-open wizard for guided experience
                setWizardOpen(true);

            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        loadMission();
    }, [lessonId, router, supabase]);

    function handleWizardComplete(summary: string, ans: RemixAnswers, shouldGenerate = false) {
        setEditSummary(summary);
        setWizardAnswers(ans);
        setWizardOpen(false);

        if (shouldGenerate) {
            handleGenerate(summary);
        }
    }

    async function handleGenerate(overridePrompt?: string) {
        setGenError(null);

        if (mediaType === "video") {
            setGenError("Video generation is not available yet.");
            return;
        }

        if (generating) return;

        const promptToUse = overridePrompt || editSummary;

        if (!promptToUse) {
            setGenError("Please complete the remix wizard first.");
            return;
        }

        setGenerating(true);

        // Scroll to preview explicitly
        if (typeof window !== "undefined" && previewRef.current) {
            previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id) {
                setGenError("Please log in to generate.");
                setGenerating(false);
                return;
            }

            const form = new FormData();
            form.append("prompt", promptToUse);
            form.append("userId", user.id);
            form.append("aspectRatio", aspectRatio);
            form.append("combined_prompt_text", promptToUse);
            form.append("edit_instructions", promptToUse);
            form.append("template_reference_image", previewImageUrl);

            // Include uploads
            uploads.slice(0, 10).forEach((file) => {
                form.append("images", file, file.name);
            });

            // Include template reference
            if (missionData?.template?.id) {
                form.append("promptId", missionData.template.id);
            }
            if (missionData?.template?.slug) {
                form.append("promptSlug", missionData.template.slug);
            }

            const res = await fetch("/api/generate", {
                method: "POST",
                body: form,
            });

            const json = await res.json();

            if (!res.ok) {
                setGenError(json?.message || json?.error || "Failed to generate.");
                setGenerating(false);
                return;
            }

            const imageUrl = normalize(json?.imageUrl);
            const genId = json?.generationId || json?.id;

            if (!imageUrl) {
                setGenError("No image returned.");
                setGenerating(false);
                return;
            }

            setLastImageUrl(imageUrl);
            setGenerationId(genId);

            // Auto-complete mission after successful generation
            await completeMission(genId);

        } catch (e: any) {
            setGenError(e?.message || "Failed to generate.");
        } finally {
            setGenerating(false);
        }
    }

    async function completeMission(genId?: string) {
        if (!missionData) return;

        setCompleting(true);

        try {
            const res = await fetch(`/api/lessons/${lessonId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generation_id: genId }),
            });

            if (res.ok) {
                setCompleted(true);

                // Show success briefly then redirect
                setTimeout(() => {
                    const bootcampSlug = missionData.bootcamp?.slug;
                    const lessonSlug = missionData.lesson?.slug;
                    const redirectUrl = `/learn/${bootcampSlug}/${lessonSlug}?completed=true${genId ? `&generationId=${genId}` : ""}`;
                    router.push(redirectUrl);
                }, 1500);
            }
        } catch (e) {
            console.error("Failed to complete mission:", e);
        } finally {
            setCompleting(false);
        }
    }

    function closeLightbox() {
        setLightboxOpen(false);
    }

    if (loading) return <Loading />;

    if (error || !missionData) {
        return (
            <main className="flex min-h-screen items-center justify-center text-white">
                <div className="text-center">
                    <p className="text-xl mb-4">{error || "Mission not found"}</p>
                    <Link href="/learn" className="text-[#B7FF00] hover:underline">
                        Back to Learn
                    </Link>
                </div>
            </main>
        );
    }

    const { lesson, bootcamp, template } = missionData;

    // Completed overlay
    if (completed) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-black text-white">
                <div className="text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#B7FF00] text-black animate-bounce">
                        <CheckCircle size={40} />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Mission Complete! 🎉</h1>
                    <p className="text-white/60">Redirecting you back...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white">
            {/* Header Bar */}
            <div className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-lg px-4 py-3">
                <div className="mx-auto max-w-6xl flex items-center justify-between">
                    <Link
                        href={`/learn/${bootcamp?.slug}/${lesson?.slug}`}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition"
                    >
                        <ArrowLeft size={18} />
                        <span className="text-sm">Back to Mission</span>
                    </Link>

                    <div className="text-center">
                        <div className="text-xs text-[#B7FF00] font-semibold uppercase tracking-wider">
                            Mission Studio
                        </div>
                        <div className="text-sm font-medium truncate max-w-[200px]">
                            {lesson?.title}
                        </div>
                    </div>

                    <div className="w-24" /> {/* Spacer for centering */}
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-8">
                {/* Mission Context */}
                <div className="mb-8 rounded-xl border border-[#B7FF00]/20 bg-[#B7FF00]/5 p-4">
                    <div className="flex items-center gap-3">
                        <Sparkles className="text-[#B7FF00]" size={20} />
                        <div>
                            <div className="font-semibold">{lesson?.learning_objective || "Create your asset"}</div>
                            <div className="text-sm text-white/50">
                                Complete the wizard below to generate and save to your library
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
                    {/* Left: Studio Controls */}
                    <div className="space-y-6">
                        {/* Template Preview */}
                        {previewImageUrl && (
                            <div ref={previewRef} className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
                                <h3 className="text-sm font-semibold text-white/70 mb-3">Template Reference</h3>
                                <div className="relative aspect-square max-h-[300px] w-full overflow-hidden rounded-xl bg-black">
                                    <Image
                                        src={previewImageUrl}
                                        alt="Template"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                                {template?.title && (
                                    <p className="mt-2 text-sm text-white/50">{template.title}</p>
                                )}
                            </div>
                        )}

                        {/* Media Type */}
                        <div>
                            <h3 className="text-sm font-semibold text-white/70 mb-2">Output Type</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setMediaType("image")} className={pill(mediaType === "image")}>
                                    Image
                                </button>
                                <button onClick={() => setMediaType("video")} className={pill(mediaType === "video")} disabled>
                                    Video (Coming Soon)
                                </button>
                            </div>
                        </div>

                        {/* Aspect Ratio */}
                        <div>
                            <h3 className="text-sm font-semibold text-white/70 mb-2">Aspect Ratio</h3>
                            <div className="flex flex-wrap gap-2">
                                {ASPECTS.map((a) => (
                                    <button key={a} onClick={() => setAspectRatio(a)} className={pill(aspectRatio === a)}>
                                        {a}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Upload Images */}
                        <div>
                            <h3 className="text-sm font-semibold text-white/70 mb-2">Reference Images (Optional)</h3>
                            <ImageUploader
                                files={uploads}
                                onChange={(files: File[]) => setUploads(files)}
                                maxFiles={5}
                            />
                        </div>

                        {/* Edit Summary Display */}
                        {editSummary && (
                            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                                <h3 className="text-sm font-semibold text-white/70 mb-2">Your Remix Instructions</h3>
                                <p className="text-sm text-white/80">{editSummary}</p>
                                <button
                                    onClick={() => setWizardOpen(true)}
                                    className="mt-3 text-sm text-[#B7FF00] hover:underline"
                                >
                                    Edit Instructions
                                </button>
                            </div>
                        )}

                        {/* Error Display */}
                        {genError && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                                {genError}
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            onClick={() => handleGenerate()}
                            disabled={generating || !editSummary || completing}
                            className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#B7FF00] px-6 py-4 text-lg font-bold text-black hover:bg-[#a3e600] disabled:opacity-50 transition"
                        >
                            {generating || completing ? (
                                <>
                                    <Loader2 size={24} className="animate-spin" />
                                    {completing ? "Saving Mission..." : "Generating..."}
                                </>
                            ) : (
                                <>
                                    <Sparkles size={24} />
                                    {editSummary ? "Generate & Complete Mission" : "Complete Wizard First"}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right: Result Preview */}
                    <div className="lg:sticky lg:top-24 lg:self-start">
                        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
                            <h3 className="text-sm font-semibold text-white/70 mb-3">Your Creation</h3>
                            {lastImageUrl ? (
                                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
                                    <Image
                                        src={lastImageUrl}
                                        alt="Generated"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <div className="aspect-square w-full rounded-xl bg-zinc-800/50 flex items-center justify-center text-white/30">
                                    <div className="text-center">
                                        <Sparkles size={48} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Your creation will appear here</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Wizard Modal */}
            {wizardOpen && (
                <RemixChatWizard
                    isOpen={wizardOpen}
                    onClose={() => setWizardOpen(false)}
                    templatePreviewUrl={previewImageUrl}
                    onComplete={handleWizardComplete}
                    uploads={uploads}
                    onUploadsChange={setUploads}
                    logo={logo}
                    onLogoChange={setLogo}
                    businessName={businessName}
                    onBusinessNameChange={setBusinessName}
                />
            )}

            {/* Lightbox */}
            {lightboxOpen && lastImageUrl && (
                <GenerationLightbox
                    open={lightboxOpen}
                    url={lastImageUrl}
                    onClose={closeLightbox}
                    onShare={() => { }}
                    onRemix={() => setWizardOpen(true)}
                />
            )}
        </main>
    );
}
