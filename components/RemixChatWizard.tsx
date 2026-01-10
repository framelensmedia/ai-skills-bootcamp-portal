"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import ImageUploader from "./ImageUploader";

export type RemixAnswers = {
    headline: string;
    subheadline: string;
    cta: string;
    instructions: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (
        summary: string,
        answers: RemixAnswers
    ) => void;
    templatePreviewUrl: string;
    initialValues?: RemixAnswers | null;
    uploads: File[];
    onUploadsChange: (files: File[]) => void;
    logo: File | null;
    onLogoChange: (file: File | null) => void;
    businessName: string;
    onBusinessNameChange: (name: string) => void;
};

type Step = "intro" | "logo" | "headline" | "subheadline" | "cta" | "instructions" | "summary";

type Message = {
    id: string;
    role: "system" | "user";
    text?: string;
    component?: React.ReactNode;
    isUploadStep?: boolean;
    isLogoStep?: boolean;
};

export function generateEditSummary(answers: RemixAnswers, hasUploads: boolean, hasLogo: boolean, businessName: string): string {
    const parts = ["Edit the template image."];
    if (hasUploads) {
        parts.push("Replace the main subject with the uploaded photo(s).");
    }
    if (hasLogo) {
        parts.push("Replace the template logo with the provided Logo.");
    } else if (businessName) {
        parts.push(`Create a logo for '${businessName}' and place it in the logo area.`);
    }
    if (answers.headline) {
        parts.push(`Change the headline to: '${answers.headline}'.`);
    }
    if (answers.subheadline) {
        parts.push(`Change the sub-headline to: '${answers.subheadline}'.`);
    }
    if (answers.cta) {
        parts.push(`Change the CTA button text to: '${answers.cta}'.`);
    }
    if (answers.instructions) {
        parts.push(`Special instructions: ${answers.instructions}`);
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
    logo,
    onLogoChange,
    businessName,
    onBusinessNameChange,
}: Props) {
    const [currentStep, setCurrentStep] = useState<Step>("intro");

    const [answers, setAnswers] = useState<RemixAnswers>({
        headline: initialValues?.headline || "",
        subheadline: initialValues?.subheadline || "",
        cta: initialValues?.cta || "",
        instructions: initialValues?.instructions || "",
    });

    const [inputVal, setInputVal] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        if (isOpen) {
            setMessages([
                {
                    id: "intro-1",
                    role: "system",
                    text: "You can upload a new image to replace the main subject, then tweak what’s below.",
                    isUploadStep: true
                }
            ]);
            setCurrentStep("intro");
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    function advanceStep(skip = false) {
        const val = inputVal.trim();

        // Save answer if not skipped
        if (!skip && val) {
            if (currentStep === "headline") setAnswers(prev => ({ ...prev, headline: val }));
            if (currentStep === "subheadline") setAnswers(prev => ({ ...prev, subheadline: val }));
            if (currentStep === "cta") setAnswers(prev => ({ ...prev, cta: val }));
            if (currentStep === "instructions") setAnswers(prev => ({ ...prev, instructions: val }));
            if (currentStep === "logo") onBusinessNameChange(val);
        }

        const userMsg: Message = { id: `user-${Date.now()}`, role: "user", text: skip ? "Skip / Keep same" : val || "Uploaded/Next" };
        const newMsgs = [...messages, userMsg];
        setInputVal("");

        let nextStep: Step | null = null;
        let botText = "";
        let isLogoStep = false;

        if (currentStep === "intro") {
            nextStep = "logo";
            botText = "Do you have a specific logo? Upload it below, or type your business name to generate one.";
            isLogoStep = true;
        } else if (currentStep === "logo") {
            nextStep = "headline";
            botText = "Got it. What should the HEADLINE say?";
        } else if (currentStep === "headline") {
            nextStep = "subheadline";
            botText = "And the SUB-HEADLINE?";
        } else if (currentStep === "subheadline") {
            nextStep = "cta";
            botText = "What label for the CTA BUTTON? (e.g. 'Order Now')";
        } else if (currentStep === "cta") {
            nextStep = "instructions";
            botText = "Any SPECIAL INSTRUCTIONS? (e.g. 'Make it dark mode', 'Add fire effects')";
        } else if (currentStep === "instructions") {
            nextStep = "summary";
            completeWorkflow(newMsgs);
            return;
        }

        if (nextStep) {
            setCurrentStep(nextStep);
            setMessages([
                ...newMsgs,
                {
                    id: `bot-${nextStep}`,
                    role: "system",
                    text: botText,
                    isLogoStep
                }
            ]);
        }
    }

    function completeWorkflow(currentMsgs: Message[]) {
        const finalAnswers = { ...answers };
        if (currentStep === "instructions" && inputVal.trim()) {
            finalAnswers.instructions = inputVal.trim();
        }

        const sum = generateEditSummary(finalAnswers, uploads.length > 0, !!logo, businessName);

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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-0 md:p-4" role="dialog">
            <div className="flex flex-col-reverse md:flex-row h-[100dvh] md:h-[90vh] w-full max-w-5xl overflow-hidden bg-black md:rounded-2xl md:border md:border-white/10">
                <div className="flex w-full flex-col md:w-2/3 h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 bg-black/60 p-4 shrink-0">
                        <div className="text-sm font-semibold text-white">Guided Remix</div>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 md:p-4">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    rounded-2xl p-4 text-sm
                                    ${m.role === 'user' ? 'bg-lime-400 text-black rounded-tr-none' : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'}
                                    ${(m.isUploadStep || m.isLogoStep) ? 'w-full max-w-full' : 'max-w-[95%] md:max-w-[85%]'}
                                `}>
                                    {m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                                    {m.isUploadStep && (
                                        <div className="mt-3 -mx-1">
                                            <UploadStepWrapper files={uploads} setFiles={onUploadsChange} />
                                        </div>
                                    )}
                                    {m.isLogoStep && (
                                        <div className="mt-3 -mx-1">
                                            <LogoStepWrapper logo={logo} setLogo={onLogoChange} />
                                        </div>
                                    )}
                                    {m.component && <div className="mt-3">{m.component}</div>}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="border-t border-white/10 bg-black/80 backdrop-blur-xl p-4 shrink-0 z-10 pb-8 md:pb-6">
                        {currentStep === "intro" ? (
                            <button onClick={() => advanceStep()} className="w-full rounded-xl bg-lime-400 py-4 text-sm font-bold text-black hover:bg-lime-300 md:py-3">
                                Looks good, start editing
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    className="flex-1 rounded-xl border border-white/20 bg-neutral-800 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-lime-400/50 focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                    placeholder={
                                        currentStep === "logo" ? "If no logo, enter Business Name..." :
                                            currentStep === "instructions" ? "E.g. Make it dark & moody..." :
                                                `Enter new ${currentStep} or leave empty to keep same`
                                    }
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
                                <button onClick={() => advanceStep(true)} className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white/60 hover:bg-black/60 whitespace-nowrap">
                                    Skip
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel (Template Preview) - Top on Mobile via flex-col-reverse */}
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

function LogoStepWrapper({ logo, setLogo }: { logo: File | null, setLogo: (f: File | null) => void }) {
    // Simplified single-file uploader for logo
    return (
        <div className="w-full min-w-0">
            <ImageUploader files={logo ? [logo] : []} onChange={(files) => setLogo(files[0] || null)} maxFiles={1} />
        </div>
    );
}
// UploadStepWrapper definition should remain at bottom (not replacing it here if avoiding full replace).
// But I am replacing almost everything. I should include UploadStepWrapper.
function UploadStepWrapper({ files, setFiles }: { files: File[], setFiles: (f: File[]) => void }) {
    return (
        <div className="w-full min-w-0">
            <ImageUploader files={files} onChange={setFiles} maxFiles={10} />
        </div>
    );
}
