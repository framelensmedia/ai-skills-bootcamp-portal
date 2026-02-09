import { Star } from "lucide-react";

const reviews = [
    {
        name: "Sarah Jenkins",
        role: "Agency Founder",
        content: "I launched my creative agency in just 2 weeks using these workflows. The AI skills taught here are practical and immediately applicable. Best investment I've made.",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150"
    },
    {
        name: "Michael Chen",
        role: "Content Creator",
        content: "Scaled my content production 10x without hiring a team. The remix workflows are a game changer for keeping up with social media demands.",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150"
    },
    {
        name: "Jessica Rivera",
        role: "Marketing Director",
        content: "Finally a place that teaches how to actually APPLY AI, not just theory. We've integrated these tools into our daily operations and seen a 40% boost in efficiency.",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150&h=150"
    }
];

export default function SuccessStories() {
    return (
        <section className="mx-auto max-w-6xl px-4 py-20 pb-10 md:py-32 md:pb-14">
            <div className="text-center mb-12">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">
                    Real Results
                </p>
                <h2 className="mt-2 text-3xl font-bold md:text-4xl text-white">
                    Success Stories
                </h2>
                <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                    See how our members are launching and growing their businesses with AI Skills Studio.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {reviews.map((review, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card p-6 md:p-8 hover:border-[#B7FF00]/30 transition-colors">
                        <div className="flex gap-1 mb-4 text-[#B7FF00]">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={16} fill="currentColor" />
                            ))}
                        </div>

                        <p className="text-lg text-foreground/90 leading-relaxed mb-6">
                            "{review.content}"
                        </p>

                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden relative">
                                {/* Using standard img tag for simplicity in static component, or could use Next Image if needed but external domains need config */}
                                <img src={review.image} alt={review.name} className="h-full w-full object-cover" />
                            </div>
                            <div>
                                <div className="font-semibold text-foreground text-sm">{review.name}</div>
                                <div className="text-xs text-muted-foreground">{review.role}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
