"use client";

interface CopyBlockInputProps {
    value: {
        headline?: string;
        subheadline?: string;
        cta?: string;
        offer?: string;
    };
    onChange: (value: CopyBlockInputProps["value"]) => void;
    disabled?: boolean;
    labels?: {
        headline?: string;
        subheadline?: string;
        cta?: string;
        offer?: string;
    };
    placeholders?: {
        headline?: string;
        subheadline?: string;
        cta?: string;
        offer?: string;
    };
}

export default function CopyBlockInput({ value, onChange, disabled, labels = {}, placeholders = {} }: CopyBlockInputProps) {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                    1. {labels.headline || "Headline"} <span className="text-[#B7FF00]">*</span>
                </label>
                <input
                    type="text"
                    value={value.headline || ""}
                    onChange={(e) => onChange({ ...value, headline: e.target.value })}
                    disabled={disabled}
                    placeholder={placeholders.headline || "Main message or title"}
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                    2. {labels.subheadline || "Subheadline"}
                </label>
                <input
                    type="text"
                    value={value.subheadline || ""}
                    onChange={(e) => onChange({ ...value, subheadline: e.target.value })}
                    disabled={disabled}
                    placeholder={placeholders.subheadline || "Supporting text or description"}
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                    3. {labels.cta || "Call-to-Action (CTA)"}
                </label>
                <input
                    type="text"
                    value={value.cta || ""}
                    onChange={(e) => onChange({ ...value, cta: e.target.value })}
                    disabled={disabled}
                    placeholder={placeholders.cta || "e.g., Shop Now, Learn More, Get Started"}
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                    4. {labels.offer || "Offer / Tagline"}
                </label>
                <input
                    type="text"
                    value={value.offer || ""}
                    onChange={(e) => onChange({ ...value, offer: e.target.value })}
                    disabled={disabled}
                    placeholder={placeholders.offer || "e.g., 50% Off, Limited Time, Free Shipping"}
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>
        </div>
    );
}
