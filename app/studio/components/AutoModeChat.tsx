"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ChipSelector from "./ChipSelector";
import CopyBlockInput from "./CopyBlockInput";
import ImageUploader from "@/components/ImageUploader";
import type { AutoModeData } from "@/lib/autoModeTransformer";

const ASSET_TYPES = [
    "Social flyer",
    "Ad / promo",
    "Logo",
    "Album cover",
    "Movie poster",
    "Book cover",
    "YouTube thumbnail",
    "Product mockup",
    "Other",
];

const VIBES = [
    "Clean & premium",
    "Bold & hype",
    "Warm & friendly",
    "Luxury",
    "Minimal",
    "Cinematic",
    "Fun / playful",
    "Other",
];

interface AutoModeChatProps {
    onComplete: (data: AutoModeData) => void;
    disabled?: boolean;
    initialReferenceImage?: File | null;
}

export default function AutoModeChat({ onComplete, disabled, initialReferenceImage }: AutoModeChatProps) {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<Partial<AutoModeData>>({
        copy_block: {},
        assets: initialReferenceImage ? { subject_photo: initialReferenceImage } : {},
    });

    const canProceed = () => {
        switch (step) {
            case 1:
                return !!data.asset_type;
            case 2:
                return !!data.project_name?.trim();
            case 3:
                return !!data.copy_block?.headline?.trim();
            default:
                return true; // Steps 4-7 are optional
        }
    };

    const handleNext = () => {
        if (step < 7) {
            setStep(step + 1);
        } else {
            // Final step - submit
            onComplete(data as AutoModeData);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Progress Indicator */}
            <div className="mb-8">
                <div className="flex items-center justify-between text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                    <span>Step {step} of 7</span>
                    <span>{Math.round((step / 7) * 100)}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#B7FF00] transition-all duration-300"
                        style={{ width: `${(step / 7) * 100}%` }}
                    />
                </div>
            </div>

            {/* Question Area */}
            <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-8 mb-6">
                {/* Step 1: Asset Type */}
                {step === 1 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">What are you making?</h2>
                        <p className="text-white/60 mb-6">Choose the type of asset you want to create.</p>
                        <ChipSelector
                            options={ASSET_TYPES}
                            selected={data.asset_type}
                            onSelect={(val) => setData({ ...data, asset_type: val })}
                            disabled={disabled}
                        />
                    </div>
                )}

                {/* Step 2: Project Name */}
                {step === 2 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">What's this for?</h2>
                        <p className="text-white/60 mb-6">Enter your business or project name.</p>
                        <input
                            type="text"
                            value={data.project_name || ""}
                            onChange={(e) => setData({ ...data, project_name: e.target.value })}
                            disabled={disabled}
                            placeholder="e.g., Acme Coffee, My Brand, Event Name"
                            className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                            autoFocus
                        />
                    </div>
                )}

                {/* Step 3: Copy Block */}
                {step === 3 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">What should it say?</h2>
                        <p className="text-white/60 mb-6">Add the text for your {data.asset_type?.toLowerCase() || "asset"}.</p>
                        <CopyBlockInput
                            value={data.copy_block || {}}
                            onChange={(val) => setData({ ...data, copy_block: val })}
                            disabled={disabled}
                        />
                    </div>
                )}

                {/* Step 4: Uploads */}
                {step === 4 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Got photos, logos, or product shots?</h2>
                        <p className="text-white/60 mb-6">Upload images to include (optional).</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">Subject Photo</label>
                                <ImageUploader
                                    files={data.assets?.subject_photo ? [data.assets.subject_photo] : []}
                                    onChange={(files) => {
                                        const assets = data.assets || {};
                                        setData({ ...data, assets: { ...assets, subject_photo: files[0] } });
                                    }}
                                    maxFiles={1}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">Logo</label>
                                <ImageUploader
                                    files={data.assets?.logo ? [data.assets.logo] : []}
                                    onChange={(files) => {
                                        const assets = data.assets || {};
                                        setData({ ...data, assets: { ...assets, logo: files[0] } });
                                    }}
                                    maxFiles={1}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">Product Image</label>
                                <ImageUploader
                                    files={data.assets?.product ? [data.assets.product] : []}
                                    onChange={(files) => {
                                        const assets = data.assets || {};
                                        setData({ ...data, assets: { ...assets, product: files[0] } });
                                    }}
                                    maxFiles={1}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 5: Vibe */}
                {step === 5 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">What's the vibe?</h2>
                        <p className="text-white/60 mb-6">Choose the overall style and feel.</p>
                        <ChipSelector
                            options={VIBES}
                            selected={data.style_vibe}
                            onSelect={(val) => setData({ ...data, style_vibe: val })}
                            disabled={disabled}
                        />
                    </div>
                )}

                {/* Step 6: Colors */}
                {step === 6 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Color preferences?</h2>
                        <p className="text-white/60 mb-6">Specify colors or let the AI choose.</p>
                        <input
                            type="text"
                            value={data.color_preferences || ""}
                            onChange={(e) => setData({ ...data, color_preferences: e.target.value })}
                            disabled={disabled}
                            placeholder="e.g., Use logo colors, Blue and gold, Warm earth tones..."
                            className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                        />
                        <p className="text-xs text-white/40 mt-2">Leave blank to let the AI choose based on your vibe.</p>
                    </div>
                )}

                {/* Step 7: Special Instructions */}
                {step === 7 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Anything else we should know?</h2>
                        <p className="text-white/60 mb-6">Add any special requests or creative ideas.</p>
                        <textarea
                            value={data.special_instructions || ""}
                            onChange={(e) => setData({ ...data, special_instructions: e.target.value })}
                            disabled={disabled}
                            placeholder="e.g., Include a QR code, Make it look retro, Add sparkles..."
                            rows={4}
                            className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors resize-none"
                        />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={disabled || step === 1}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={20} />
                    Back
                </button>

                <button
                    type="button"
                    onClick={handleNext}
                    disabled={disabled || !canProceed()}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-[#B7FF00] text-black font-bold hover:bg-[#a8e600] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_#B7FF00]"
                >
                    {step === 7 ? "Generate" : "Continue"}
                    {step < 7 && <ChevronRight size={20} />}
                </button>
            </div>
        </div>
    );
}
