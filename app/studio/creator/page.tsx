"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { transformAutoModeToPrompt, type AutoModeData } from "@/lib/autoModeTransformer";
import AutoModeChat from "../components/AutoModeChat";
import RemixChatWizard, { RemixAnswers, TemplateConfig } from "@/components/RemixChatWizard";
import ImageUploader from "@/components/ImageUploader";
import { Smartphone, Monitor, Square, RectangleVertical, ChevronLeft } from "lucide-react";

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
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
    const [mediaType, setMediaType] = useState<"image" | "video">("image");

    // Generation state
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string>("/orb-neon.gif"); // Default placeholder

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
                        const file = new File([blob], "remix_reference.png", { type: blob.type || "image/png" });
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
        await generateImage(prompt, autoUploads);
    };

    const handleManualGenerate = async () => {
        if (!handleAuthGate()) return;

        if (!manualPrompt.trim()) {
            setError("Please describe what you want to create");
            return;
        }

        await generateImage(manualPrompt, uploads);
    };

    const generateImage = async (prompt: string, imageUploads: File[]) => {
        setGenerating(true);
        setError(null);

        try {
            const form = new FormData();
            form.append("userId", user.id);
            form.append("prompt", prompt);
            form.append("combined_prompt_text", prompt);
            form.append("aspectRatio", aspectRatio);

            // Add uploads
            imageUploads.forEach((file) => {
                form.append("images", file);
            });

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
                                />

                                <div className="mt-4">
                                    <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">Reference Images</div>
                                    <ImageUploader files={uploads} onChange={setUploads} />
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
                        {generating ? "Generating..." : "Generate Artwork"}
                    </button>
                </div>

                {/* RIGHT COLUMN: Preview / Results */}
                <div className="lg:col-span-7 order-1 lg:order-2">
                    <div className="sticky top-8 aspect-[4/5] w-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden shadow-2xl">
                        {/* Generating Overlay */}
                        {generating && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-lime-400"></div>
                                <div className="mt-4 text-sm font-medium text-lime-400 animate-pulse">Creating masterpiece...</div>
                            </div>
                        )}

                        <Image
                            src={previewImage}
                            alt="Preview"
                            fill
                            className="object-cover opacity-80"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                        <div className="absolute bottom-8 left-8 right-8 text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Your Artwork</h3>
                            <p className="text-sm text-white/50">
                                Generated images will appear here. You can then edit, download, or share them.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
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
