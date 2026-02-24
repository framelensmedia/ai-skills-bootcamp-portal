import Link from "next/link";
import { ArrowRight, Wand2, LayoutTemplate, Send, Users, GraduationCap } from "lucide-react";

export const metadata = {
    title: "How It Works | AI Skills Studio",
    description: "Learn how to use AI Skills Studio to create marketing content in 3 clicks.",
};

export default function HowItWorksPage() {
    const steps = [
        {
            icon: <LayoutTemplate className="h-8 w-8 text-[#B7FF00]" />,
            title: "1. Pick Your Template",
            description: "Choose from hundreds of proven templates designed by marketing experts specifically for your business type. Whether you need a Facebook ad, Instagram story, or a local flyer, we have a starting point that works."
        },
        {
            icon: <Wand2 className="h-8 w-8 text-[#B7FF00]" />,
            title: "2. Customize with AI",
            description: "Just tell our AI what your business is and what you want to say. The AI will instantly rewrite the copy, adjust the layout, and swap the images to match your brand and offer. No design skills required."
        },
        {
            icon: <Send className="h-8 w-8 text-[#B7FF00]" />,
            title: "3. Download & Post",
            description: "Review your stunning new marketing asset. With one click, download it in high resolution or post it directly to your social media channels. It's ready to start bringing customers through the door."
        }
    ];

    return (
        <div className="flex flex-col min-h-[80vh] items-center py-12 px-4 my-auto">
            <div className="text-center max-w-3xl mb-16">
                <div className="inline-flex items-center justify-center rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1 mb-6">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B7FF00]">3 Simple Steps</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight mb-6">
                    From Idea to Published in <span className="text-[#B7FF00]">3&nbsp;Clicks</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                    Stop paying expensive agencies or spending hours struggling with complicated design tools. Here is how easy it is to grow your business with AI.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16 relative">
                {steps.map((step, i) => (
                    <div key={i} className="flex flex-col items-center text-center p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-[#B7FF00]/30 transition-colors">
                        <div className="flex shrink-0 items-center justify-center rounded-2xl bg-[#B7FF00]/10 border border-[#B7FF00]/20 h-20 w-20 mb-6">
                            {step.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">{step.title}</h3>
                        <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-12 max-w-5xl mx-auto mb-16 p-10 md:p-12 rounded-3xl bg-zinc-950 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#B7FF00]/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="flex-1 relative z-10">
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight">
                        Become the <span className="text-[#B7FF00]">1%.</span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                        AI is your <span className="text-white font-bold">unfair advantage</span>. Upgrade to a <span className="text-white font-bold">PRO membership</span> to dominate the competition that's still lagging behind. Master AI to grow your business with exclusive resources designed for entrepreneurs.
                    </p>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-start gap-3">
                            <div className="mt-1 rounded-full bg-[#B7FF00]/10 p-1.5"><GraduationCap className="h-4 w-4 text-[#B7FF00]" /></div>
                            <span className="text-white/90">Access to comprehensive training and step-by-step <span className="font-bold text-white">courses</span>.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 rounded-full bg-[#B7FF00]/10 p-1.5"><Users className="h-4 w-4 text-[#B7FF00]" /></div>
                            <span className="text-white/90"><span className="font-bold text-white">Exclusive access</span> to the <span className="font-bold text-[#B7FF00]">Small Business AI Mastermind Group</span> to share strategies and win together.</span>
                        </li>
                    </ul>
                </div>
                <div className="w-full md:w-5/12 relative z-10 flex justify-center">
                    <div className="relative h-48 w-48 sm:h-64 sm:w-64 rounded-full border border-white/10 bg-zinc-900 flex items-center justify-center p-6 shadow-2xl">
                        <div className="absolute inset-0 rounded-full border border-[#B7FF00]/20 animate-[spin_10s_linear_infinite]"></div>
                        <div className="text-center">
                            <h3 className="text-2xl font-black text-white">PRO</h3>
                            <p className="text-xs text-[#B7FF00] font-mono tracking-widest mt-1">MEMBERSHIP</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center mt-8 p-12 rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black w-full max-w-4xl">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight max-w-[200px] md:max-w-none mx-auto leading-tight">
                    Ready to Make Your First Post?
                </h2>
                <div className="flex flex-col items-center gap-3">
                    <Link
                        href="/signup"
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#B7FF00] px-10 py-4 text-lg font-bold text-black hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                        Grow My Business <ArrowRight size={20} />
                    </Link>
                    <span className="text-sm text-[#B7FF00] font-medium opacity-80">No credit card required</span>
                </div>
            </div>
        </div>
    );
}
