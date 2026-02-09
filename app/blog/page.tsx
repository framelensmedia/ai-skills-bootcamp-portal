import Link from "next/link";
import Image from "next/image";

const blogPosts = [
    {
        title: "Getting Started with AI Image Generation",
        excerpt: "Learn the basics of prompt engineering and how to create stunning visuals in seconds.",
        date: "Feb 8, 2026",
        category: "Tutorial",
        image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=600&h=400"
    },
    {
        title: "Top 10 Prompts for Marketing Assets",
        excerpt: "Boost your conversion rates with these proven visual styles for ads and social media.",
        date: "Feb 5, 2026",
        category: "Marketing",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600&h=400"
    },
    {
        title: "New Feature: Video Generation with Veo",
        excerpt: "Explore the possibilities of our latest video generation tool powered by Google Veo.",
        date: "Feb 1, 2026",
        category: "Product Update",
        image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=600&h=400"
    }
];

export default function BlogPage() {
    return (
        <div className="mx-auto max-w-6xl px-4 py-16 text-white/80">
            <Link href="/" className="text-sm text-[#B7FF00] hover:underline mb-8 block">← Back to Home</Link>

            <h1 className="text-4xl font-bold text-white mb-12">Latest from Our Blog</h1>

            <div className="grid gap-8 md:grid-cols-3">
                {blogPosts.map((post, i) => (
                    <div key={i} className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-all">
                        <div className="aspect-video relative bg-black/50">
                            {/* Using img for simplicity in placeholder */}
                            <img src={post.image} alt={post.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="p-6">
                            <div className="flex items-center gap-3 text-xs mb-3">
                                <span className="text-[#B7FF00] font-semibold uppercase tracking-wide">{post.category}</span>
                                <span className="text-white/40">•</span>
                                <span className="text-white/40">{post.date}</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#B7FF00] transition-colors">{post.title}</h3>
                            <p className="text-sm text-white/60 line-clamp-2">{post.excerpt}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
