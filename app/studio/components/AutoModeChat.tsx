"use client";

import { useState, useMemo } from "react";
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

type NicheConfig = {
    step2_title: string;
    step2_desc: string;
    step2_placeholder: string;
    step3_title: string;
    step3_desc: string;
    copy_labels?: { headline?: string; subheadline?: string; cta?: string; offer?: string };
    copy_placeholders?: { headline?: string; subheadline?: string; cta?: string; offer?: string };
    step4_title: string;
    step4_desc: string;
    assets_labels?: { subject?: string; logo?: string; product?: string };
};

const NICHE_CONFIGS: Record<string, NicheConfig> = {
    "Album cover": {
        step2_title: "Who is the artist?",
        step2_desc: "Enter the artist or band name.",
        step2_placeholder: "e.g., The Midnight, Drake, Taylor Swift",
        step3_title: "Album details?",
        step3_desc: "Add the title and track info.",
        copy_labels: {
            headline: "Album Title",
            subheadline: "Credits / Tracklist",
            cta: "Advisory Label",
            offer: "Release Year / Label",
        },
        copy_placeholders: {
            headline: "Album Name",
            subheadline: "Feat. Artists or Producers",
            cta: "Parental Advisory (Optional)",
            offer: "2024 • Record Label",
        },
        step4_title: "Artist photos or logos?",
        step4_desc: "Upload artist portraits or band logos.",
        assets_labels: {
            subject: "Artist Photo",
            logo: "Band Logo (Optional)",
            product: "Texture / Background",
        },
    },
    "Movie poster": {
        step2_title: "What is the movie called?",
        step2_desc: "Enter the film title.",
        step2_placeholder: "e.g., Inception, The Matrix",
        step3_title: "Credits & Tagline",
        step3_desc: "Add the core text elements.",
        copy_labels: {
            headline: "Movie Title",
            subheadline: "Tagline",
            cta: "Billing Block / Credits",
            offer: "Release Date",
        },
        copy_placeholders: {
            headline: "Main Title",
            subheadline: "The catchphrase or hook",
            cta: "Directed by... Starring...",
            offer: "Coming Soon / Summer 2024",
        },
        step4_title: "Key visuals?",
        step4_desc: "Upload character shots or title treatments.",
        assets_labels: {
            subject: "Main Character / Scene",
            logo: "Studio Logo",
            product: "Title Treatment (Optional)",
        },
    },
    "Book cover": {
        step2_title: "Who is the author?",
        step2_desc: "Enter the author's name.",
        step2_placeholder: "e.g., Stephen King, J.K. Rowling",
        step3_title: "Book details?",
        step3_desc: "Add the title and blurb.",
        copy_labels: {
            headline: "Book Title",
            subheadline: "Subtitle / Tagline",
            cta: "Bestseller Tag",
            offer: "Publisher",
        },
        copy_placeholders: {
            headline: "The Great Gatsby",
            subheadline: "A Novel of the Jazz Age",
            cta: "#1 New York Times Bestseller",
            offer: "Penguin Classics",
        },
        step4_title: "Cover art elements?",
        step4_desc: "Upload imagery or author photo.",
        assets_labels: {
            subject: "Cover Illustration / Photo",
            logo: "Publisher Logo",
            product: "Author Photo (Back Cover)",
        },
    },
    "YouTube thumbnail": {
        step2_title: "Channel Name?",
        step2_desc: "Enter your channel name.",
        step2_placeholder: "e.g., MrBeast, Veritaseum",
        step3_title: "Video Hook",
        step3_desc: "Make it click-worthy.",
        copy_labels: {
            headline: "Video Title / Hook",
            subheadline: "Secondary Text",
            cta: "Badge / Label",
            offer: "Episode Number",
        },
        copy_placeholders: {
            headline: "I Spent 50 Hours...",
            subheadline: "You Won't Believe This",
            cta: "LIVE / 4K",
            offer: "Ep. 42",
        },
        step4_title: "Thumbnail assets?",
        step4_desc: "Upload reaction faces or key frames.",
        assets_labels: {
            subject: "Face / Reaction Shot",
            logo: "Channel Icon",
            product: "Gameplay / Product Shot",
        },
    },
    "Product mockup": {
        step2_title: "Brand Name?",
        step2_desc: "Enter the product brand.",
        step2_placeholder: "e.g., Apple, Nike",
        step3_title: "Product Copy",
        step3_desc: "Highlight features and benefits.",
        copy_labels: {
            headline: "Product Name",
            subheadline: "Feature List",
            cta: "Shop Now Button",
            offer: "Price / Discount",
        },
        copy_placeholders: {
            headline: "Air Max 90",
            subheadline: "Comfort re-imagined.",
            cta: "Shop Now",
            offer: "$129.99",
        },
        step4_title: "Reference photos?",
        step4_desc: "Upload your product shots.",
        assets_labels: {
            subject: "Main Product Shot",
            logo: "Brand Logo",
            product: "Packaging / Box",
        },
    },
    "Social flyer": {
        step2_title: "Event or Brand Name?",
        step2_desc: "Who is hosting this?",
        step2_placeholder: "e.g., Summer Fest, TechConf 2024",
        step3_title: "Flyer Details",
        step3_desc: "What do people need to know?",
        copy_labels: {
            headline: "Main Headline",
            subheadline: "Description",
            cta: "Call to Action",
            offer: "Date / Location",
        },
        copy_placeholders: {
            headline: "Summer Sale / Grand Opening",
            subheadline: "Join us for music and food",
            cta: "Get Tickets / RSVP",
            offer: "July 4th • Central Park",
        },
        step4_title: "Visual Assets?",
        step4_desc: "Photos of guests, performers, or products.",
        assets_labels: {
            subject: "Hero Image",
            logo: "Event Logo",
            product: "Sponsor Logos",
        },
    },
    "default": {
        step2_title: "What's this for?",
        step2_desc: "Enter your business or project name.",
        step2_placeholder: "e.g., Acme Coffee, My Brand, Event Name",
        step3_title: "What should it say?",
        step3_desc: "Add the text for your asset.",
        step4_title: "Got photos, logos, or product shots?",
        step4_desc: "Upload images to include (optional).",
        assets_labels: {
            subject: "Subject Photo",
            logo: "Logo",
            product: "Product Image",
        },
    },
};

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

    const activeConfig = useMemo(() => {
        if (!data.asset_type) return NICHE_CONFIGS["default"];
        return NICHE_CONFIGS[data.asset_type] || NICHE_CONFIGS["default"];
    }, [data.asset_type]);

    const canProceed = () => {
        switch (step) {
            case 1:
                return !!data.asset_type;
            case 2:
                // Relaxed validation: allow empty project name
                return true;
            case 3:
                // Relaxed validation: allow empty headline
                return true;
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
            <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-8 mb-6 min-h-[420px]">
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

                {/* Step 2: Project Name (Dynamic) */}
                {step === 2 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">{activeConfig.step2_title}</h2>
                        <p className="text-white/60 mb-6">{activeConfig.step2_desc}</p>
                        <input
                            type="text"
                            value={data.project_name || ""}
                            onChange={(e) => setData({ ...data, project_name: e.target.value })}
                            disabled={disabled}
                            placeholder={activeConfig.step2_placeholder}
                            className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                            autoFocus
                        />
                    </div>
                )}

                {/* Step 3: Copy Block (Dynamic) */}
                {step === 3 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">{activeConfig.step3_title}</h2>
                        <p className="text-white/60 mb-6">{activeConfig.step3_desc}</p>
                        <CopyBlockInput
                            value={data.copy_block || {}}
                            onChange={(val) => setData({ ...data, copy_block: val })}
                            disabled={disabled}
                            labels={activeConfig.copy_labels}
                            placeholders={activeConfig.copy_placeholders}
                        />
                    </div>
                )}

                {/* Step 4: Uploads (Dynamic) */}
                {step === 4 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">{activeConfig.step4_title}</h2>
                        <p className="text-white/60 mb-6">{activeConfig.step4_desc}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    {activeConfig.assets_labels?.subject || "Subject Photo"}
                                </label>
                                <ImageUploader
                                    files={data.assets?.subject_photo ? [data.assets.subject_photo] : []}
                                    onChange={async (files) => {
                                        let file = files[0];
                                        if (file) {
                                            try {
                                                file = await compressImage(file, { maxWidth: 1024, quality: 0.8 });
                                            } catch (e) {
                                                console.error("Subject compression failed", e);
                                            }
                                        }
                                        const assets = data.assets || {};
                                        setData({ ...data, assets: { ...assets, subject_photo: file } });
                                    }}
                                    maxFiles={1}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    {activeConfig.assets_labels?.logo || "Logo"}
                                </label>
                                <ImageUploader
                                    files={data.assets?.logo ? [data.assets.logo] : []}
                                    onChange={async (files) => {
                                        let file = files[0];
                                        if (file) {
                                            try {
                                                file = await compressImage(file, { maxWidth: 800, quality: 0.8 });
                                            } catch (e) {
                                                console.error("Logo compression failed", e);
                                            }
                                        }
                                        const assets = data.assets || {};
                                        setData({ ...data, assets: { ...assets, logo: file } });
                                    }}
                                    maxFiles={1}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/60 mb-2">
                                    {activeConfig.assets_labels?.product || "Product / Secondary Image"}
                                </label>
                                <ImageUploader
                                    files={data.assets?.product ? [data.assets.product] : []}
                                    onChange={async (files) => {
                                        let file = files[0];
                                        if (file) {
                                            try {
                                                file = await compressImage(file, { maxWidth: 1024, quality: 0.8 });
                                            } catch (e) {
                                                console.error("Product compression failed", e);
                                            }
                                        }
                                        const assets = data.assets || {};
                                        setData({ ...data, assets: { ...assets, product: file } });
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
