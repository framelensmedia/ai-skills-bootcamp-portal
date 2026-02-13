"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useMemo } from "react";
import ImageUploader from "./ImageUploader";
import SelectPill from "@/components/SelectPill";
import SubjectControls from "@/app/studio/components/SubjectControls";
import { GENERATION_MODELS, DEFAULT_MODEL_ID } from "@/lib/model-config";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export type RemixAnswers = Record<string, string>;

export type TemplateConfig = {
    editable_fields: { id: string; label: string; default: string }[];
    editable_groups?: { label: string; fields: string[] }[]; // fields are IDs
    subject_mode?: "human" | "non_human";
    force_minimal_flow?: boolean;
};

export const DEFAULT_CONFIG: TemplateConfig = {
    subject_mode: "human",
    editable_fields: [
        { id: "headline", label: "Headline", default: "" },
        { id: "subheadline", label: "Sub-Headline", default: "" },
        { id: "cta", label: "CTA Button", default: "" }
    ]
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (summary: string, answers: RemixAnswers, shouldGenerate?: boolean) => void;
    templatePreviewUrl: string;
    initialValues?: RemixAnswers | null;
    uploads: File[];
    onUploadsChange: (files: File[]) => void;
    // Legacy props (kept to prevent breakage, but unused by new logic if not in config)
    logo: File | null;
    onLogoChange: (file: File | null) => void;
    businessName: string;
    onBusinessNameChange: (name: string) => void;
    templateConfig?: TemplateConfig;
    isGuest?: boolean;
    onGuestInteraction?: () => void;
    flowMode?: "full" | "short";
};

type Message = {
    id: string;
    role: "system" | "user";
    text?: string;
    component?: React.ReactNode;
    isUploadStep?: boolean;
};

export function generateEditSummary(answers: RemixAnswers, hasUploads: boolean): string {
    const parts: string[] = [];
    // This is a rough client-side summary. Real prompt assembly happens server-side.
    // INTERNAL SETTINGS: These are handled separately by the API via dedicated fields.
    // They must NOT be included in the prompt text or they confuse the model.
    const internalKeys = new Set([
        "instructions", "subjectLock", "subjectOutfit", "subjectMode",
        "modelId", "keepOutfit", "forceCutout", "industry_intent", "business_name",
        "subject_mode"
    ]);

    Object.entries(answers).forEach(([k, v]) => {
        if (internalKeys.has(k)) return;
        if (v === "__REMOVED__") {
            parts.push(`Remove ${k} element.`);
        } else if (v) {
            parts.push(`Change ${k} to: '${v}'.`);
        }
    });

    // Instructions (Secret Sauce) go at the END for emphasis
    if (answers.instructions) {
        parts.push(answers.instructions);
    }
    return parts.join(" ") || "Edit the template image.";
}

export default function RemixChatWizard({
    isOpen,
    onClose,
    onComplete,
    templatePreviewUrl,
    initialValues,
    uploads,
    onUploadsChange,
    templateConfig,
    logo,
    onLogoChange,
    businessName,
    onBusinessNameChange,
    isGuest,
    onGuestInteraction,
    flowMode = "full"
}: Props) {
    const [answers, setAnswers] = useState<RemixAnswers>(initialValues || {});
    const [inputVal, setInputVal] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    // Toggle for Subject Lock
    const [subjectLock, setSubjectLock] = useState(true);
    const [subjectOutfit, setSubjectOutfit] = useState(""); // Default empty
    const [subjectMode, setSubjectMode] = useState<"human" | "non_human">("human"); // Default Human
    const [keepOutfit, setKeepOutfit] = useState(true);

    // Steps State
    const [stepIndex, setStepIndex] = useState(0);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);

    // Build steps derived from config
    const steps = useMemo(() => {
        if (!templateConfig) return [];

        // SHORT FLOW: Community Remixes (Fast & Simple)
        // Respect force_minimal_flow from config OR explicit flowMode prop
        if (flowMode === "short" || templateConfig.force_minimal_flow) {
            return [
                { type: "intro" },
                { type: "instructions" },
                { type: "review" }
            ] as const;
        }

        // FULL CONCISE FLOW: Default Templates
        // Combines steps to reduce clicks
        const list: { type: "intro_concise" | "intro" | "field" | "group" | "instructions" | "industry_intent" | "business_concise" | "business" | "logo" | "review", data?: any }[] = [];

        // 1. Intro + Industry (Merged)
        list.push({ type: "intro_concise" });

        // 2. Business + Logo (Merged)
        list.push({ type: "business_concise" });

        // 5. Contact Info (Group)
        // Prioritize "contact" group if it exists
        const handledFields = new Set<string>();
        let contactGroup = templateConfig.editable_groups?.find(g =>
            g.label.toLowerCase().includes("contact") ||
            g.fields.some(f => f.includes("phone") || f.includes("website"))
        );

        if (contactGroup) {
            list.push({ type: "group", data: contactGroup });
            contactGroup.fields.forEach(f => handledFields.add(f));
        }

        // 6. Text Fields (Headline, Sub, CTA) in priority order
        const priority = ["headline", "subheadline", "cta", "call_to_action", "offer"];
        const remainingFields = (templateConfig.editable_fields || []).filter(f => !handledFields.has(f.id));

        const sortedFields = [...remainingFields].sort((a, b) => {
            const ia = priority.indexOf((a.id || "").toLowerCase());
            const ib = priority.indexOf((b.id || "").toLowerCase());
            const pa = ia === -1 ? 999 : ia;
            const pb = ib === -1 ? 999 : ib;
            return pa - pb;
        });

        sortedFields.forEach(f => {
            list.push({ type: "field", data: f });
            handledFields.add(f.id);
        });

        // 7. Remaining Groups (non contact)
        (templateConfig.editable_groups || []).forEach(g => {
            if (g !== contactGroup) {
                list.push({ type: "group", data: g });
                g.fields.forEach(f => handledFields.add(f));
            }
        });

        // 8. Instructions
        list.push({ type: "instructions" });

        // 9. Review / Generate
        list.push({ type: "review" });

        return list;
    }, [templateConfig, flowMode]);


    useEffect(() => {
        if (isOpen && templateConfig) {
            setStepIndex(0);
            // Force default to human if not explicitly set to non_human
            const mode = templateConfig.subject_mode === "non_human" ? "non_human" : "human";
            setSubjectMode(mode);
            const isHuman = mode === "human";
            const introText = isHuman
                ? "This template features a human subject. Please upload a photo to replace them."
                : "You can upload a reference image if you like, or skip to keep the current subject.";

            setMessages([
                {
                    id: "intro-1",
                    role: "system",
                    text: introText,
                    isUploadStep: true
                }
            ]);
        }
    }, [isOpen, templateConfig]);

    // Fetch Credits & Role
    const [userCredits, setUserCredits] = useState<number | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const fetchCredits = async () => {
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from("profiles").select("credits, role").eq("user_id", user.id).maybeSingle();
                setUserCredits(profile?.credits ?? 0);
                const r = String(profile?.role || "").toLowerCase();
                setIsAdmin(r === "admin" || r === "super_admin");
            }
        };
        fetchCredits();
    }, [isOpen]);

    const IMAGE_COST = 3;
    const hasCredits = (userCredits ?? 0) >= IMAGE_COST || isAdmin;
    const creditError = !hasCredits && userCredits !== null ? `Insufficient credits. Need ${IMAGE_COST}, have ${userCredits}.` : null;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const navigatingRef = useRef(false);

    function advanceStep(skip = false, removed = false) {
        if (!templateConfig || navigatingRef.current) return;
        navigatingRef.current = true;
        // Release lock after short delay to allow state update to complete
        setTimeout(() => { navigatingRef.current = false; }, 500);

        const currentStep = steps[stepIndex];
        const val = inputVal.trim();
        let answerKey: string | null = null;
        let answerVal = val;

        if (removed) answerVal = "__REMOVED__";
        else if (skip) answerVal = "";

        // Save Answer
        if (currentStep.type === "field") {
            answerKey = currentStep.data.id;
        } else if (currentStep.type === "group") {
            answerKey = `group_${currentStep.data.label.replace(/\s+/g, '_')}`;
        } else if (currentStep.type === "instructions") {
            answerKey = "instructions";
        } else if (currentStep.type === "industry_intent" || currentStep.type === "intro_concise") {
            answerKey = "industry_intent";
        } else if (currentStep.type === "business" || currentStep.type === "business_concise") {
            // Also update parent prop
            if (answerVal && !removed) onBusinessNameChange(answerVal);
            // We store it in answers too for the summary
            answerKey = "business_name";
        } else if (currentStep.type === "logo") {
            // Logo is handled via component state/callback, but we might want to log user intent
            // If skipped, nothing. If uploaded, we assume onLogoChange was called.
            // We won't store file in answers.
        }

        if (answerKey && (answerVal || removed)) {
            setAnswers(prev => ({ ...prev, [answerKey!]: answerVal }));
        }


        // Add User Message
        const userText = removed ? "Remove from design" : (skip ? "Skip / Keep same" : (
            (currentStep.type === "intro_concise" || currentStep.type === "intro")
                ? (uploads.length > 0 ? `Uploaded ${uploads.length} image(s)${val ? ' + Industry: ' + val : ''}` : (val || "Skip Upload"))
                : (val || "Next")
        ));
        const newMsgs = [...messages, { id: `user-${Date.now()}`, role: "user" as const, text: userText }];
        setInputVal("");

        // Move to Next
        const nextIdx = stepIndex + 1;
        if (nextIdx >= steps.length) {
            // Should be covered by logic below but just in case
            completeWorkflow(newMsgs, { ...answers, ...(answerKey ? { [answerKey]: answerVal } : {}) }, true);
            return;
        }

        setStepIndex(nextIdx);
        const nextStep = steps[nextIdx];
        let botText = "";

        if (nextStep.type === "field") {
            const f = nextStep.data;
            const fid = f.id.toLowerCase();
            const currentVal = answers[f.id] || f.default;
            const hasCurrent = currentVal && currentVal !== "(set in template)";

            // 6th Grade Reading Level / Marketing Education
            if (fid === "headline") {
                botText = hasCurrent
                    ? `The current Headline is '${currentVal}'. Convert this to your new title? (This is the big text that grabs attention)`
                    : "What is the Main Title (Headline)? This is the big text people see first.";
            } else if (fid === "subheadline") {
                botText = hasCurrent
                    ? `The current Sub-Headline is '${currentVal}'. What should it say now? (This is the smaller text with details)`
                    : "What is the Sub-Headline? This is the smaller text that explains your title.";
            } else if (fid === "cta" || fid === "call_to_action") {
                botText = hasCurrent
                    ? `The current Button says '${currentVal}'. Change it to?`
                    : "What should the Button say (CTA)? This tells people what to do next, like 'Shop Now' or 'Learn More'.";
            } else {
                // Default fallback
                if (!hasCurrent) {
                    botText = `What would you like the ${f.label} to be?`;
                } else {
                    botText = `The current ${f.label} is '${currentVal}'. What would you like to change it to?`;
                }
            }
        } else if (nextStep.type === "group") {
            const g = nextStep.data as { label: string, fields: string[] };
            // Resolve field labels AND current values
            const lines = g.fields.map((fid, i) => {
                const ef = templateConfig.editable_fields?.find(e => e.id === fid);
                const lbl = ef?.label || fid;
                const def = answers[fid] || ef?.default || "(set in template)";
                return `${i + 1}. ${lbl}: ${def}`;
            });

            botText = `${g.label}:\n` + lines.join("\n");
        } else if (nextStep.type === "instructions") {
            botText = "🔥 THE SECRET SAUCE!\nDescribe exactly what you want to see. Add text changes, vibe details, or specific edits.";
        } else if (nextStep.type === "industry_intent") {
            botText = "What kind of business is this for? (e.g. 'Coffee Shop', 'Tree Removal')";
        } else if (nextStep.type === "business") {
            botText = "What is your Business Name?";
        } else if (nextStep.type === "intro_concise") {
            // Already handled by intro step UI? No, this is for NEXT step text if we jumped TO it? 
            // Intro is usually Step 0.
            botText = "Let's get started. Upload your photo and tell us your industry.";
        } else if (nextStep.type === "business_concise") {
            botText = "What is your Business Name? (You can upload your logo, or skip for a FREE AI design!)";
        } else if (nextStep.type === "logo") {
            botText = "Upload your logo (optional). If you don't have one, just skip — I'll design a premium new logo for you automatically!";
        } else if (nextStep.type === "review") {
            botText = "Everything looks good! Ready to generate your artwork?";
        }

        setMessages([
            ...newMsgs,
            {
                id: `bot-${nextIdx}`,
                role: "system",
                text: botText
            }
        ]);
    }

    // Skip directly to Instructions step
    function skipToInstructions() {
        const instructionsIdx = steps.findIndex(s => s.type === "instructions");
        if (instructionsIdx === -1) return;

        setStepIndex(instructionsIdx);
        setInputVal("");
        setMessages([
            ...messages,
            { id: `skip-${Date.now()}`, role: "user", text: "→ Jumping to Special Instructions" },
            { id: `bot-instructions`, role: "system", text: "🔥 THE SECRET SAUCE! Describe what you want to see in the image. Add your business info, text changes, vibe adjustments, or special effects." }
        ]);
    }

    function completeWorkflow(currentMsgs: Message[], finalAnswers: RemixAnswers, shouldGenerate = false) {
        // Include subjectLock and subjectMode in answers
        finalAnswers.subjectLock = String(subjectLock);
        if (subjectOutfit) finalAnswers.subjectOutfit = subjectOutfit;
        finalAnswers.subjectMode = subjectMode;
        finalAnswers.modelId = selectedModel;

        const sum = generateEditSummary(finalAnswers, uploads.length > 0);
        setMessages([
            ...currentMsgs,
            { id: "final", role: "system", text: shouldGenerate ? "Starting generation..." : "Great! Updating your prompt..." }
        ]);

        setTimeout(() => {
            onComplete(sum, finalAnswers, shouldGenerate);
            onClose();
        }, 800);
    }

    if (!isOpen) return null;

    // Loading State
    if (!templateConfig) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 text-white" role="dialog">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-400 border-t-transparent" />
                    <p className="text-sm font-mono opacity-50">Loading template configuration...</p>
                </div>
            </div>
        );
    }

    const activeStep = steps[stepIndex];
    const showRemove = activeStep?.type === "field" || activeStep?.type === "group";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-0 md:p-4" role="dialog">
            <div className="flex flex-col-reverse md:flex-row h-[100dvh] md:h-[90vh] w-full max-w-5xl overflow-hidden bg-black md:rounded-2xl md:border md:border-white/10">
                <div className="flex w-full flex-col md:w-2/3 h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 bg-black/60 p-4 shrink-0">
                        <div className="text-sm font-semibold text-white">Guided Remix</div>
                        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition">✕</button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-6 scroll-smooth">

                        <div className="text-center pb-4">
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">Guided Remix</p>
                            <p className="text-[10px] text-white/30 italic">AI is not perfect; it can make mistakes.</p>
                        </div>

                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    rounded-2xl p-4 text-sm
                                    ${msg.role === 'user' ? 'bg-lime-400 text-black rounded-tr-none' : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'}
                                    ${msg.isUploadStep ? 'w-full max-w-full' : 'max-w-[95%] md:max-w-[85%]'}
                                `}>
                                    {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                                    {msg.isUploadStep && (
                                        <div className="mt-3 -mx-1">
                                            <UploadStepWrapper
                                                files={uploads}
                                                setFiles={onUploadsChange}
                                                subjectLock={subjectLock}
                                                setSubjectLock={setSubjectLock}
                                                subjectOutfit={subjectOutfit}
                                                setSubjectOutfit={setSubjectOutfit}
                                                subjectMode={subjectMode}
                                                setSubjectMode={setSubjectMode}
                                                keepOutfit={keepOutfit}
                                                setKeepOutfit={setKeepOutfit}
                                            />
                                        </div>
                                    )}
                                    {/* Logo Upload UI in chat history? No, usually in input area or as a specific step component. 
                                        But since our chat maps messages to steps, if we want the Logo UI to appear "in the chat bubbles", we'd need to attach it to the Bot message.
                                        But current logic attaches UI only if `isUploadStep` is true. 
                                        We should flag the Logo message as `isLogoStep`. 
                                    */}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="border-t border-white/10 bg-black/80 backdrop-blur-xl p-4 shrink-0 z-10 pb-8 md:pb-6">
                        {activeStep?.type === "intro" ? (
                            <button
                                onClick={() => {
                                    if (isGuest && onGuestInteraction) {
                                        onGuestInteraction();
                                        return;
                                    }
                                    advanceStep();
                                }}
                                className="w-full rounded-xl bg-lime-400 py-4 text-sm font-bold text-black hover:bg-lime-300 md:py-3">
                                {uploads.length > 0 ? "Use these images" : "Skip Upload"}
                            </button>
                        ) : activeStep?.type === "intro_concise" ? (
                            <div className="flex flex-col gap-2">
                                {/* Industry Input + Next Button */}
                                <div className="flex gap-2">
                                    <input
                                        autoFocus={!isGuest}
                                        className="flex-1 rounded-xl border border-white/20 bg-neutral-800 px-4 py-4 text-base text-white placeholder:text-white/40 focus:border-lime-400/50 focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                        placeholder="Industry (e.g. Coffee Shop)..."
                                        value={inputVal}
                                        onChange={(e) => setInputVal(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); advanceStep(); }
                                        }}
                                    />
                                    <button
                                        onClick={() => advanceStep()}
                                        className="rounded-xl bg-lime-400 px-8 py-4 text-base font-bold text-black hover:bg-lime-300 whitespace-nowrap shadow-lg shadow-lime-400/10">
                                        Next
                                    </button>
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={() => advanceStep(true)} className="px-4 py-2 text-xs font-semibold text-white/40 hover:text-white transition">
                                        Skip Industry
                                    </button>
                                </div>
                            </div>
                        ) : activeStep?.type === "business_concise" ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex gap-2">
                                    <input
                                        autoFocus={!isGuest}
                                        className="flex-1 rounded-xl border border-white/20 bg-neutral-800 px-4 py-4 text-base text-white placeholder:text-white/40 focus:border-lime-400/50 focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                        placeholder="Business Name..."
                                        value={inputVal}
                                        onChange={(e) => setInputVal(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); advanceStep(); }
                                        }}
                                    />
                                    <button
                                        onClick={() => advanceStep()}
                                        className="rounded-xl bg-lime-400 px-8 py-4 text-base font-bold text-black hover:bg-lime-300 whitespace-nowrap shadow-lg shadow-lime-400/10">
                                        Next
                                    </button>
                                </div>

                                {/* Inline Logo Uploader */}
                                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                    <p className="text-xs text-white/50 mb-2 uppercase tracking-wide font-semibold">Brand Logo (Skip = Auto-Generate)</p>
                                    <ImageUploader files={logo ? [logo] : []} onChange={(fs) => onLogoChange(fs[0] || null)} maxFiles={1} />
                                </div>

                                <div className="flex justify-end">
                                    <button onClick={() => advanceStep(true)} className="px-4 py-2 text-xs font-semibold text-white/40 hover:text-white transition">
                                        Skip Business Info
                                    </button>
                                </div>
                            </div>
                        ) : activeStep?.type === "logo" ? (
                            <div className="flex flex-col gap-3">
                                <ImageUploader
                                    files={logo ? [logo] : []}
                                    onChange={(fs) => onLogoChange(fs[0] || null)}
                                    maxFiles={1}
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => advanceStep(true)} className="px-4 py-3 text-sm font-semibold text-white/50 hover:text-white transition">
                                        {logo ? "Confirm Logo" : "I don't have a logo (Skip)"}
                                    </button>
                                </div>
                            </div>
                        ) : activeStep?.type === "review" ? (
                            <div className="space-y-3">
                                {creditError && (
                                    <div className="text-xs text-red-400 text-center">{creditError}</div>
                                )}
                                <button
                                    onClick={() => completeWorkflow(messages, answers, true)}
                                    disabled={!hasCredits}
                                    className={`w-full rounded-xl py-4 text-base font-bold text-black md:py-4 shadow-lg transition-all ${!hasCredits ? "bg-white/10 text-white/20 cursor-not-allowed" : "bg-lime-400 hover:bg-lime-300 shadow-lime-400/20 transform hover:scale-[1.02]"}`}
                                >
                                    ✨ Generate Artwork ({isAdmin ? "∞" : IMAGE_COST} Cr)
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <input
                                        autoFocus={!isGuest}
                                        onClick={() => {
                                            if (isGuest && onGuestInteraction) onGuestInteraction();
                                        }}
                                        onFocus={(e) => {
                                            if (isGuest && onGuestInteraction) {
                                                onGuestInteraction();
                                                e.target.blur();
                                            }
                                        }}
                                        className="flex-1 rounded-xl border border-white/20 bg-neutral-800 px-4 py-4 text-base text-white placeholder:text-white/40 focus:border-lime-400/50 focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                        placeholder={activeStep?.type === "group" ? "Enter numbered answers..." : "Enter new value..."}
                                        value={inputVal}
                                        onChange={(e) => setInputVal(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                advanceStep();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (isGuest && onGuestInteraction) {
                                                onGuestInteraction();
                                                return;
                                            }
                                            advanceStep();
                                        }}
                                        className="hidden md:block rounded-xl bg-lime-400 px-8 py-4 text-base font-bold text-black hover:bg-lime-300 whitespace-nowrap shadow-lg shadow-lime-400/10">
                                        Next
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        if (isGuest && onGuestInteraction) {
                                            onGuestInteraction();
                                            return;
                                        }
                                        advanceStep();
                                    }}
                                    className="md:hidden w-full rounded-xl bg-lime-400 py-4 text-base font-bold text-black hover:bg-lime-300 shadow-lg shadow-lime-400/10">
                                    Next
                                </button>
                                <div className="flex gap-2 justify-between items-center">
                                    <div>
                                        {/* Skip to Instructions - Only show before instructions step */}
                                        {activeStep?.type !== "instructions" && (
                                            <button
                                                onClick={() => {
                                                    if (isGuest && onGuestInteraction) {
                                                        onGuestInteraction();
                                                        return;
                                                    }
                                                    skipToInstructions();
                                                }}
                                                className="px-4 py-3 text-sm font-semibold text-lime-400/80 hover:text-lime-400 transition"
                                            >
                                                🔥 Skip to Secret Sauce
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (isGuest && onGuestInteraction) {
                                                    onGuestInteraction();
                                                    return;
                                                }
                                                advanceStep(true);
                                            }}
                                            className="px-4 py-3 text-sm font-semibold text-white/50 hover:text-white transition">
                                            Skip / Keep Original
                                        </button>
                                        {showRemove && (
                                            <button onClick={() => advanceStep(false, true)} className="px-4 py-3 text-sm font-semibold text-red-400/60 hover:text-red-400 transition">
                                                Remove from design
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel (Template Preview) */}
                <div className="relative flex h-32 w-full shrink-0 flex-row items-center border-b border-white/10 bg-black/40 p-4 md:h-auto md:w-1/3 md:flex-col md:border-b-0 md:border-l md:p-6">
                    <div className="mr-4 text-xs font-semibold text-white/80 md:mb-4 md:mr-0 md:text-sm">Template</div>
                    <div className="relative h-full aspect-[9/16] md:w-full md:max-w-[280px] md:h-auto overflow-hidden rounded-lg border border-white/10 bg-black">
                        {templatePreviewUrl ? (
                            <Image src={templatePreviewUrl} alt="Template" fill className="object-cover" unoptimized />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/20">
                                <span className="text-xs">No Preview</span>
                            </div>
                        )}
                    </div>

                    {/* Model Selector (Always visible in side panel) */}
                    {GENERATION_MODELS.length > 1 && (
                        <div className="hidden md:block w-full mt-6">
                            <div className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wide">Model</div>
                            <div className="flex flex-col gap-2">
                                {GENERATION_MODELS.map((model) => (
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
            </div>
        </div>
    );
}

// Mobile Model Selector (Inject into Review Step or Footer? Let's put it in the Review Step for mobile)
// Actually, let's just leave it desktop only for now or inject it into the review step logic if we want to be fancy.
// For now, let's keep it simple. If we need mobile support, we can add it to the Review Step component logic.


function UploadStepWrapper({
    files,
    setFiles,
    subjectLock,
    setSubjectLock,
    subjectOutfit,
    setSubjectOutfit,
    subjectMode,
    setSubjectMode,
    keepOutfit,
    setKeepOutfit
}: {
    files: File[],
    setFiles: (f: File[]) => void,
    subjectLock: boolean,
    setSubjectLock: (v: boolean) => void,
    subjectOutfit: string,
    setSubjectOutfit: (v: string) => void,
    subjectMode: "human" | "non_human",
    setSubjectMode: (v: "human" | "non_human") => void,
    keepOutfit: boolean,
    setKeepOutfit: (v: boolean) => void
}) {
    return (
        <div className="w-full min-w-0">
            <ImageUploader files={files} onChange={setFiles} maxFiles={10} />
            {files.length > 0 && (
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
    );
}
