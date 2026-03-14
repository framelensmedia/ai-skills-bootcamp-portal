"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import {
    Upload, ArrowRight, ArrowLeft, Zap, CheckCircle2,
    Download, Library, RotateCcw, User, Loader2, X,
    ChevronRight, Sparkles
} from "lucide-react";

type Step = "intro" | "front" | "left" | "right" | "body" | "details" | "generate" | "result";

interface UploadSlot {
    file: File | null;
    preview: string | null;
    url: string | null;
}

const STEPS: Step[] = ["intro", "front", "left", "right", "body", "details", "generate", "result"];

const STEP_META: Record<Step, { label: string; hint: string }> = {
    intro: { label: "Start", hint: "" },
    front: { label: "Front View", hint: "A clear, straight-on photo of the front of the face/body." },
    left: { label: "Left Profile", hint: "Side profile from the left. Can be a 3/4 or full side shot." },
    right: { label: "Right Profile", hint: "Side profile from the right." },
    body: { label: "Full Body", hint: "Optional. A full-length shot showing the entire figure." },
    details: { label: "Details", hint: "Give your character a name and any notes for the AI." },
    generate: { label: "Generate", hint: "Review your uploads and generate the character sheet." },
    result: { label: "Done", hint: "" },
};

type CharacterTabProps = {
    userCredits: number | null;
    isAdmin: boolean;
    onCreditsUsed?: (amount: number) => void;
};

export default function CharacterTab({ userCredits, isAdmin, onCreditsUsed }: CharacterTabProps) {
    const [step, setStep] = useState<Step>("intro");
    const [front, setFront] = useState<UploadSlot>({ file: null, preview: null, url: null });
    const [left, setLeft] = useState<UploadSlot>({ file: null, preview: null, url: null });
    const [right, setRight] = useState<UploadSlot>({ file: null, preview: null, url: null });
    const [body, setBody] = useState<UploadSlot>({ file: null, preview: null, url: null });
    const [charName, setCharName] = useState("");
    const [charNotes, setCharNotes] = useState("");
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const frontRef = useRef<HTMLInputElement>(null);
    const leftRef = useRef<HTMLInputElement>(null);
    const rightRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLInputElement>(null);

    const stepIndex = STEPS.indexOf(step);

    const handleFile = useCallback((slot: "front" | "left" | "right" | "body", file: File) => {
        const preview = URL.createObjectURL(file);
        const setter = { front: setFront, left: setLeft, right: setRight, body: setBody }[slot];
        setter({ file, preview, url: null });
    }, []);

    const uploadToStorage = async (file: File): Promise<string> => {
        // Compress first
        const form = new FormData();
        form.append("file", file);

        const signRes = await fetch("/api/sign-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, fileType: file.type }),
        });
        if (!signRes.ok) throw new Error("Upload sign failed");
        const { signedUrl, publicUrl } = await signRes.json();

        const putRes = await fetch(signedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error("File upload failed");
        return publicUrl;
    };

    const handleGenerate = async () => {
        if (!front.file || !left.file || !right.file) {
            setError("Please upload the front, left, and right profile photos first.");
            return;
        }

        setGenerating(true);
        setUploading(true);
        setError(null);

        try {
            // Upload all photos
            const [frontUrl, leftUrl, rightUrl] = await Promise.all([
                front.url ?? uploadToStorage(front.file),
                left.url ?? uploadToStorage(left.file),
                right.url ?? uploadToStorage(right.file),
            ]);
            // Update slot URLs for next time
            setFront(s => ({ ...s, url: frontUrl }));
            setLeft(s => ({ ...s, url: leftUrl }));
            setRight(s => ({ ...s, url: rightUrl }));

            let bodyUrl: string | null = null;
            if (body.file) {
                bodyUrl = body.url ?? await uploadToStorage(body.file);
                setBody(s => ({ ...s, url: bodyUrl as string }));
            }

            setUploading(false);

            // Call character sheet API
            const res = await fetch("/api/generate-character-sheet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    frontUrl, leftUrl, rightUrl,
                    fullBodyUrl: bodyUrl,
                    characterName: charName.trim() || undefined,
                    description: charNotes.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Generation failed");

            setResultUrl(data.imageUrl);
            if (data.remainingCredits !== undefined && onCreditsUsed) {
                onCreditsUsed(0); // credits deducted server-side
            }
            setStep("result");
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setGenerating(false);
            setUploading(false);
        }
    };

    const reset = () => {
        setStep("intro");
        setFront({ file: null, preview: null, url: null });
        setLeft({ file: null, preview: null, url: null });
        setRight({ file: null, preview: null, url: null });
        setBody({ file: null, preview: null, url: null });
        setCharName("");
        setCharNotes("");
        setResultUrl(null);
        setError(null);
    };

    // ──────────────────────────────────────────────────────────
    // Photo upload card used for steps 2-5
    // ──────────────────────────────────────────────────────────
    const PhotoCard = ({
        slot, inputRef, label, optional = false,
    }: {
        slot: UploadSlot;
        inputRef: React.RefObject<HTMLInputElement | null>;
        label: string;
        optional?: boolean;
    }) => (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto">
            <button
                onClick={() => inputRef.current?.click()}
                className={`relative w-full aspect-[3/4] rounded-2xl border-2 border-dashed transition-all overflow-hidden group
                    ${slot.preview
                        ? "border-lime-400/40 bg-black"
                        : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                    }`}
            >
                {slot.preview ? (
                    <>
                        <Image src={slot.preview} alt={label} fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Upload size={28} className="text-white" />
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                        <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center">
                            <Upload size={22} className="text-white/40" />
                        </div>
                        <p className="text-sm font-semibold text-white/40 text-center">
                            Tap to upload
                            {optional && <span className="block text-xs text-white/25 mt-0.5">Optional</span>}
                        </p>
                    </div>
                )}
            </button>
            {slot.preview && (
                <button
                    onClick={() => {
                        const setter = label.includes("Front") ? setFront : label.includes("Left") ? setLeft : label.includes("Right") ? setRight : setBody;
                        setter({ file: null, preview: null, url: null });
                    }}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                    <X size={12} /> Remove
                </button>
            )}
        </div>
    );

    // ──────────────────────────────────────────────────────────
    // Step content renderer
    // ──────────────────────────────────────────────────────────
    const renderStep = () => {
        switch (step) {
            case "intro":
                return (
                    <div className="flex flex-col items-center text-center gap-8 py-8">
                        <div className="w-24 h-24 bg-lime-400/10 rounded-full flex items-center justify-center border border-lime-400/20">
                            <User size={44} className="text-lime-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-3">Build Your Character</h2>
                            <p className="text-white/50 text-sm max-w-md leading-relaxed">
                                Upload reference photos from 3 angles and our AI will generate a professional
                                character sheet — your character's "passport" for consistent use across every tool.
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 w-full max-w-sm text-center">
                            {["Front", "Profiles", "Sheet"].map((label, i) => (
                                <div key={label} className="flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-lime-400 font-bold text-sm border border-white/10">
                                        {i + 1}
                                    </div>
                                    <span className="text-xs text-white/40 font-medium">{label}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setStep("front")}
                            className="h-12 px-8 bg-lime-400 hover:bg-lime-300 text-black font-bold rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(183,255,0,0.2)] active:scale-95"
                        >
                            Let&apos;s Go <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case "front":
                return (
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white mb-2">Front View</h2>
                            <p className="text-sm text-white/40">{STEP_META.front.hint}</p>
                        </div>
                        <PhotoCard slot={front} inputRef={frontRef} label="Front" />
                        <input ref={frontRef} type="file" accept="image/*" className="hidden"
                            onChange={e => e.target.files?.[0] && handleFile("front", e.target.files[0])} />
                    </div>
                );

            case "left":
                return (
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white mb-2">Left Profile</h2>
                            <p className="text-sm text-white/40">{STEP_META.left.hint}</p>
                        </div>
                        <PhotoCard slot={left} inputRef={leftRef} label="Left" />
                        <input ref={leftRef} type="file" accept="image/*" className="hidden"
                            onChange={e => e.target.files?.[0] && handleFile("left", e.target.files[0])} />
                    </div>
                );

            case "right":
                return (
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white mb-2">Right Profile</h2>
                            <p className="text-sm text-white/40">{STEP_META.right.hint}</p>
                        </div>
                        <PhotoCard slot={right} inputRef={rightRef} label="Right" />
                        <input ref={rightRef} type="file" accept="image/*" className="hidden"
                            onChange={e => e.target.files?.[0] && handleFile("right", e.target.files[0])} />
                    </div>
                );

            case "body":
                return (
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white mb-2">Full Body <span className="text-white/30 font-normal">(Optional)</span></h2>
                            <p className="text-sm text-white/40">{STEP_META.body.hint}</p>
                        </div>
                        <PhotoCard slot={body} inputRef={bodyRef} label="Body" optional />
                        <input ref={bodyRef} type="file" accept="image/*" className="hidden"
                            onChange={e => e.target.files?.[0] && handleFile("body", e.target.files[0])} />
                    </div>
                );

            case "details":
                return (
                    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white mb-2">Character Details</h2>
                            <p className="text-sm text-white/40">Optional — help the AI understand your character.</p>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">Character Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Marcus, Agent K, The Warrior..."
                                    value={charName}
                                    onChange={e => setCharName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-lime-400/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">Notes <span className="normal-case font-normal text-white/30">(optional)</span></label>
                                <textarea
                                    placeholder="e.g. Mid 30s, athletic build, intense expression, streetwear style..."
                                    value={charNotes}
                                    onChange={e => setCharNotes(e.target.value)}
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-lime-400/50 transition-colors resize-none"
                                />
                            </div>
                        </div>
                    </div>
                );

            case "generate":
                return (
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white mb-2">Ready to Generate</h2>
                            <p className="text-sm text-white/40">Review your uploads then hit Generate.</p>
                        </div>

                        {/* Photo thumbnails */}
                        <div className="grid grid-cols-4 gap-3 w-full max-w-md">
                            {[
                                { slot: front, label: "Front" },
                                { slot: left, label: "Left" },
                                { slot: right, label: "Right" },
                                { slot: body, label: "Body" },
                            ].map(({ slot, label }) => (
                                <div key={label} className="flex flex-col items-center gap-1.5">
                                    <div className={`w-full aspect-square rounded-xl overflow-hidden border relative
                                        ${slot.preview ? "border-lime-400/30" : "border-white/10 bg-white/5"}`}>
                                        {slot.preview
                                            ? <Image src={slot.preview} alt={label} fill className="object-cover" />
                                            : <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">None</div>
                                        }
                                        {slot.preview && (
                                            <div className="absolute top-1 right-1 w-4 h-4 bg-lime-400 rounded-full flex items-center justify-center">
                                                <CheckCircle2 size={10} className="text-black" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wide">{label}</span>
                                </div>
                            ))}
                        </div>

                        {charName && (
                            <div className="text-center text-sm text-white/50">
                                Character: <span className="text-white font-semibold">{charName}</span>
                            </div>
                        )}

                        {error && (
                            <div className="w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={generating || !front.file || !left.file || !right.file}
                            className="h-14 px-10 bg-lime-400 hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl flex items-center gap-3 transition-all shadow-[0_0_30px_rgba(183,255,0,0.25)] active:scale-95 text-lg"
                        >
                            {generating ? (
                                <>
                                    <Loader2 size={22} className="animate-spin" />
                                    {uploading ? "Uploading..." : "Generating..."}
                                </>
                            ) : (
                                <>
                                    <Sparkles size={22} />
                                    Generate Character Sheet
                                </>
                            )}
                        </button>

                        {generating && (
                            <p className="text-xs text-white/30 text-center">
                                This takes 20–35 seconds. Your sheet will be saved to your library.
                            </p>
                        )}
                    </div>
                );

            case "result":
                return (
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 bg-lime-400/10 border border-lime-400/20 rounded-full px-4 py-1.5 text-lime-400 text-xs font-bold mb-4">
                                <CheckCircle2 size={14} /> Character Sheet Generated
                            </div>
                            <h2 className="text-xl font-bold text-white">
                                {charName ? `${charName}'s Sheet` : "Your Character Sheet"}
                            </h2>
                        </div>

                        {resultUrl && (
                            <div className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                <Image
                                    src={resultUrl}
                                    alt="Character Sheet"
                                    width={1024}
                                    height={1024}
                                    className="w-full h-auto"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3 flex-wrap justify-center">
                            <a
                                href={resultUrl || "#"}
                                download={`character-sheet-${Date.now()}.png`}
                                className="h-11 px-6 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl flex items-center gap-2 transition-all text-sm"
                            >
                                <Download size={16} /> Download
                            </a>
                            <a
                                href="/library"
                                className="h-11 px-6 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl flex items-center gap-2 transition-all text-sm"
                            >
                                <Library size={16} /> View in Library
                            </a>
                            <button
                                onClick={reset}
                                className="h-11 px-6 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-xl flex items-center gap-2 transition-all text-sm"
                            >
                                <RotateCcw size={16} /> New Character
                            </button>
                        </div>
                    </div>
                );
        }
    };

    // ──────────────────────────────────────────────────────────
    // Navigation — which step can we go to?
    // ──────────────────────────────────────────────────────────
    const canAdvance = () => {
        switch (step) {
            case "front": return !!front.file;
            case "left": return !!left.file;
            case "right": return !!right.file;
            default: return true;
        }
    };

    const nextStep = () => {
        const idx = STEPS.indexOf(step);
        if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
    };

    const prevStep = () => {
        const idx = STEPS.indexOf(step);
        if (idx > 0) setStep(STEPS[idx - 1]);
    };

    // ──────────────────────────────────────────────────────────
    // Progress bar (visible on steps 2-7)
    // ──────────────────────────────────────────────────────────
    const progressSteps = STEPS.filter(s => s !== "intro" && s !== "result");
    const progressIdx = progressSteps.indexOf(step as typeof progressSteps[number]);

    return (
        <div className="flex flex-col items-center min-h-[600px] py-8">
            {/* Progress indicator */}
            {step !== "intro" && step !== "result" && (
                <div className="flex items-center gap-1.5 mb-10">
                    {progressSteps.map((s, i) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full transition-all duration-300
                                ${i < progressIdx ? "bg-lime-400 w-8"
                                    : i === progressIdx ? "bg-lime-400 w-12"
                                        : "bg-white/15 w-8"
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Step label */}
            {step !== "intro" && step !== "result" && (
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-6">
                    Step {progressIdx + 1} of {progressSteps.length} · {STEP_META[step].label}
                </p>
            )}

            {/* Step content */}
            <div className="w-full max-w-xl">
                {renderStep()}
            </div>

            {/* Nav buttons */}
            {step !== "intro" && step !== "generate" && step !== "result" && (
                <div className="flex items-center justify-between w-full max-w-xl mt-10">
                    <button
                        onClick={prevStep}
                        className="h-11 px-5 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-xl flex items-center gap-2 transition-all text-sm"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>

                    <button
                        onClick={nextStep}
                        disabled={!canAdvance()}
                        className="h-11 px-6 bg-lime-400 hover:bg-lime-300 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold rounded-xl flex items-center gap-2 transition-all text-sm active:scale-95"
                    >
                        {step === "details" ? (
                            <>Review <ChevronRight size={16} /></>
                        ) : step === "body" ? (
                            <>Continue <ChevronRight size={16} /></>
                        ) : (
                            <>Next <ArrowRight size={16} /></>
                        )}
                    </button>
                </div>
            )}

            {/* Back button on generate step */}
            {step === "generate" && !generating && (
                <button
                    onClick={prevStep}
                    className="mt-6 h-10 px-5 bg-white/5 hover:bg-white/10 text-white/50 font-bold rounded-xl flex items-center gap-2 transition-all text-sm"
                >
                    <ArrowLeft size={14} /> Back
                </button>
            )}
        </div>
    );
}
