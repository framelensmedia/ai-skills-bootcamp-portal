import { Star } from "lucide-react";

const reviews = [
    {
        name: "Marcus T.",
        role: "Retail Store Owner",
        content: "I'm 52 and barely know how to use Instagram. In my first week using these templates, I ran a weekend promo flyer that brought in 15 new customers to my boutique. It took me three minutes to make.",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150"
    },
    {
        name: "David R.",
        role: "Small Business Service Operator",
        content: "I used to spend my Sunday nights stressing over what to post for my landscaping business. Now I use the AI templates, schedule my week in 15 minutes, and get back to my family.",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150"
    },
    {
        name: "Sarah M.",
        role: "Restaurant Manager",
        content: "We couldn't afford a marketing agency for the restaurant. This platform gave us the exact tools to create daily specials that look like we paid a professional thousands of dollars.",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150&h=150"
    }
];

export default function SuccessStories() {
    return (
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-20 md:pb-24">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold md:text-4xl text-white mb-4">
                    Success Stories
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    See how our members are launching and growing their businesses with <span className="whitespace-nowrap">AI Skills Studio</span>.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {reviews.map((review, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card p-6 md:p-8 hover:border-[#B7FF00]/30 transition-colors flex flex-col h-full">
                        <div className="flex gap-1 mb-4 text-[#B7FF00]">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={16} fill="currentColor" />
                            ))}
                        </div>

                        <p className="text-lg text-foreground/90 leading-relaxed mb-6">
                            "{review.content}"
                        </p>

                        <div className="flex items-center gap-3 mt-auto">
                            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden relative shrink-0">
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
