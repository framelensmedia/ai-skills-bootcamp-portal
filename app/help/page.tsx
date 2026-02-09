import Link from "next/link";

export default function HelpCenterPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-16 text-white/80">
            <Link href="/" className="text-sm text-[#B7FF00] hover:underline mb-8 block">← Back to Home</Link>

            <h1 className="text-4xl font-bold text-white mb-8">Help Center</h1>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">Getting Started</h2>
                    <p className="text-sm opacity-70 mb-4">Learn the basics of navigation, credit system, and generating your first image.</p>
                    <span className="text-xs text-[#B7FF00]">View Articles →</span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">Billing & Credits</h2>
                    <p className="text-sm opacity-70 mb-4">Questions about plans, credit packs, or auto-recharge settings.</p>
                    <span className="text-xs text-[#B7FF00]">View Articles →</span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">Troubleshooting</h2>
                    <p className="text-sm opacity-70 mb-4">Fix common issues with image generation or account access.</p>
                    <span className="text-xs text-[#B7FF00]">View Articles →</span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">Contact Support</h2>
                    <p className="text-sm opacity-70 mb-4">Need personalized help? Reach out to our support team.</p>
                    <span className="text-xs text-[#B7FF00]">Contact Us →</span>
                </div>
            </div>
        </div>
    );
}
