"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useMemo } from "react";
import ImageUploader from "./ImageUploader";

export type RemixAnswers = Record<string, string>;

export type TemplateConfig = {
    editable_fields: { id: string; label: string; default: string }[];
    editable_groups?: { label: string; fields: string[] }[]; // fields are IDs
    subject_mode?: "human" | "non_human";
};

const DEFAULT_CONFIG: TemplateConfig = {
    subject_mode: "non_human",
    editable_fields: [
        { id: "headline", label: "Headline", default: "" },
        { id: "subheadline", label: "Sub-Headline", default: "" },
        { id: "cta", label: "CTA Button", default: "" }
    ]
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (summary: string, answers: RemixAnswers) => void;
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
};

type Message = {
    id: string;
    role: "system" | "user";
    text?: string;
    component?: React.ReactNode;
    isUploadStep?: boolean;
};

export function generateEditSummary(answers: RemixAnswers, hasUploads: boolean): string {
    const parts = ["Edit the template image."];
    // This is a rough client-side summary. Real prompt assembly happens server-side.
    if (hasUploads) {
        parts.push("Use uploaded image as reference.");
    }

    Object.entries(answers).forEach(([k, v]) => {
        if (k === "instructions") return;
        if (v === "__REMOVED__") {
            parts.push(`Remove ${k} element.`);
        } else if (v) {
            parts.push(`Change ${k} to: '${v}'.`);
        }
    });

    if (answers.instructions) {
        parts.push(`Instructions: ${answers.instructions}`);
    }
    return parts.join(" ");
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
    onBusinessNameChange
}: Props) {
    const [answers, setAnswers] = useState<RemixAnswers>(initialValues || {});
    const [inputVal, setInputVal] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    // Toggle for Subject Lock
    const [subjectLock, setSubjectLock] = useState(true);

    // Steps State
    const [stepIndex, setStepIndex] = useState(0);

    // Build steps derived from config
    const steps = useMemo(() => {
        if (!templateConfig) return [];

        const list: { type: "intro" | "field" | "group" | "instructions" | "industry_intent" | "business" | "logo", data?: any }[] = [];

        // 1. Intro (Photo Upload)
        list.push({ type: "intro" });

        // 2. Industry Intent
        list.push({ type: "industry_intent" });

        // 3. Business Name
        list.push({ type: "business" });

        // 4. Logo
        list.push({ type: "logo" });

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

        return list;
    }, [templateConfig]);

    useEffect(() => {
        if (isOpen && templateConfig) {
            setStepIndex(0);
            const isHuman = templateConfig.subject_mode === "human";
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    function advanceStep(skip = false, removed = false) {
        if (!templateConfig) return;

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
        } else if (currentStep.type === "industry_intent") {
            answerKey = "industry_intent";
        } else if (currentStep.type === "business") {
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
        const userText = removed ? "Remove from design" : (skip ? "Skip / Keep same" : (val || "Next"));
        const newMsgs = [...messages, { id: `user-${Date.now()}`, role: "user" as const, text: userText }];
        setInputVal("");

        // Move to Next
        const nextIdx = stepIndex + 1;
        if (nextIdx >= steps.length) {
            completeWorkflow(newMsgs, { ...answers, ...(answerKey ? { [answerKey]: answerVal } : {}) });
            return;
        }

        setStepIndex(nextIdx);
        const nextStep = steps[nextIdx];
        let botText = "";

        if (nextStep.type === "field") {
            const f = nextStep.data;
            // 1) Logic: User Answer -> Default -> Fallback
            const currentVal = answers[f.id] || f.default || "(set in template)";
            botText = `The current ${f.label} is '${currentVal}'. What would you like to change it to?`;
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
            botText = "Any SPECIAL INSTRUCTIONS? (e.g. 'Make it dark mode', 'Add fire effects')";
        } else if (nextStep.type === "industry_intent") {
            botText = "What kind of business is this for? (e.g. 'Coffee Shop', 'Tree Removal')";
        } else if (nextStep.type === "business") {
            botText = "What is your Business Name?";
        } else if (nextStep.type === "logo") {
            botText = "Upload your logo/brand mark (optional). We will remove the background automatically.";
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

    function completeWorkflow(currentMsgs: Message[], finalAnswers: RemixAnswers) {
        // Include subjectLock in answers
        finalAnswers.subjectLock = String(subjectLock);

        const sum = generateEditSummary(finalAnswers, uploads.length > 0);
        setMessages([
            ...currentMsgs,
            { id: "final", role: "system", text: "Great! Updating your prompt..." }
        ]);

        setTimeout(() => {
            onComplete(sum, finalAnswers);
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
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 md:p-4">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    rounded-2xl p-4 text-sm
                                    ${m.role === 'user' ? 'bg-lime-400 text-black rounded-tr-none' : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'}
                                    ${m.isUploadStep ? 'w-full max-w-full' : 'max-w-[95%] md:max-w-[85%]'}
                                `}>
                                    {m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                                    {m.isUploadStep && (
                                        <div className="mt-3 -mx-1">
                                            <UploadStepWrapper
                                                files={uploads}
                                                setFiles={onUploadsChange}
                                                subjectLock={subjectLock}
                                                setSubjectLock={setSubjectLock}
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
                            <button onClick={() => advanceStep()} className="w-full rounded-xl bg-lime-400 py-4 text-sm font-bold text-black hover:bg-lime-300 md:py-3">
                                {uploads.length > 0 ? "Use these images" : "Skip Upload"}
                            </button>
                        ) : activeStep?.type === "logo" ? (
                            <div className="flex flex-col gap-3">
                                <ImageUploader
                                    files={logo ? [logo] : []}
                                    onChange={(fs) => onLogoChange(fs[0] || null)}
                                    maxFiles={1}
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => advanceStep(true)} className="px-3 py-2 text-xs font-semibold text-white/40 hover:text-white transition">
                                        {logo ? "Confirm Logo" : "Skip / Text Fallback"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        className="flex-1 rounded-xl border border-white/20 bg-neutral-800 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-lime-400/50 focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
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
                                    <button onClick={() => advanceStep()} className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black hover:bg-lime-300 whitespace-nowrap">
                                        Next
                                    </button>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => advanceStep(true)} className="px-3 py-2 text-xs font-semibold text-white/40 hover:text-white transition">
                                        Skip / Keep Original
                                    </button>
                                    {showRemove && (
                                        <button onClick={() => advanceStep(false, true)} className="px-3 py-2 text-xs font-semibold text-red-400/60 hover:text-red-400 transition">
                                            Remove from design
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel (Template Preview) */}
                <div className="relative flex h-32 w-full shrink-0 flex-row items-center border-b border-white/10 bg-black/40 p-4 md:h-auto md:w-1/3 md:flex-col md:border-b-0 md:border-l md:p-6">
                    <div className="mr-4 text-xs font-semibold text-white/80 md:mb-4 md:mr-0 md:text-sm">Template</div>
                    <div className="relative h-full aspect-[9/16] md:w-full md:max-w-[280px] md:h-auto overflow-hidden rounded-lg border border-white/10 bg-black">
                        <Image src={templatePreviewUrl} alt="Template" fill className="object-contain" unoptimized />
                    </div>
                </div>
            </div>
        </div>
    );
}

function UploadStepWrapper({
    files,
    setFiles,
    subjectLock,
    setSubjectLock
}: {
    files: File[],
    setFiles: (f: File[]) => void,
    subjectLock: boolean,
    setSubjectLock: (v: boolean) => void
}) {
    return (
        <div className="w-full min-w-0">
            <ImageUploader files={files} onChange={setFiles} maxFiles={10} />
            {files.length > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <input
                        type="checkbox"
                        checked={subjectLock}
                        onChange={(e) => setSubjectLock(e.target.checked)}
                        className="h-5 w-5 rounded border-lime-400 bg-transparent text-lime-400 focus:ring-lime-400"
                        id="subject-lock"
                    />
                    <label htmlFor="subject-lock" className="flex-1 cursor-pointer select-none text-sm text-white">
                        <span className="block font-semibold">Keep exact outfit and body</span>
                        <span className="block text-xs text-white/50">Prevents the AI from changing clothes or pose.</span>
                    </label>
                </div>
            )}
        </div>
    );
}
