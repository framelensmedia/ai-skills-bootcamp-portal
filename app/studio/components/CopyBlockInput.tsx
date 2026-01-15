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
}

export default function CopyBlockInput({ value, onChange, disabled }: CopyBlockInputProps) {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                    1. Headline <span className="text-[#B7FF00]">*</span>
                </label>
                <input
                    type="text"
                    value={value.headline || ""}
                    onChange={(e) => onChange({ ...value, headline: e.target.value })}
                    disabled={disabled}
                    placeholder="Main message or title"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                    2. Subheadline
                </label>
                <input
                    type="text"
                    value={value.subheadline || ""}
                    onChange={(e) => onChange({ ...value, subheadline: e.target.value })}
                    disabled={disabled}
                    placeholder="Supporting text or description"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                    3. Call-to-Action (CTA)
                </label>
                <input
                    type="text"
                    value={value.cta || ""}
                    onChange={(e) => onChange({ ...value, cta: e.target.value })}
                    disabled={disabled}
                    placeholder="e.g., Shop Now, Learn More, Get Started"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                    4. Offer / Tagline
                </label>
                <input
                    type="text"
                    value={value.offer || ""}
                    onChange={(e) => onChange({ ...value, offer: e.target.value })}
                    disabled={disabled}
                    placeholder="e.g., 50% Off, Limited Time, Free Shipping"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00] transition-colors"
                />
            </div>
        </div>
    );
}
