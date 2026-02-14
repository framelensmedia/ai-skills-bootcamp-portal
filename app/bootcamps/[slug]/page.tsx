import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import BootcampInterestForm from "./BootcampInterestForm"; // Client component

export const dynamic = "force-dynamic";

export default async function InstructorBootcampPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: bootcamp } = await supabase
        .from("instructor_bootcamps")
        .select("*")
        .eq("slug", slug)
        .single();

    if (!bootcamp) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <div className="mx-auto max-w-5xl px-4 py-10 md:py-20">

                {/* Back Link */}
                <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
                    <ArrowLeft size={16} />
                    Back to Home
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">

                    {/* Left: Image (4:5 Aspect Ratio) */}
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl">
                        {bootcamp.featured_image_url ? (
                            <Image
                                src={bootcamp.featured_image_url}
                                alt={bootcamp.title}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-white/20">
                                No Image
                            </div>
                        )}

                        {/* Status Overlay */}
                        <div className="absolute top-4 right-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B7FF00] opacity-75"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B7FF00]"></span>
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-white">
                                    Coming Soon
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Content */}
                    <div>
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-[#B7FF00] border border-[#B7FF00]/20">
                            Instructor Led Bootcamp
                        </div>

                        <h1 className="mb-6 text-4xl md:text-5xl font-bold leading-tight tracking-tight">
                            {bootcamp.title}
                        </h1>

                        <p className="mb-10 text-lg leading-relaxed text-white/60">
                            {bootcamp.description}
                        </p>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
                            <h3 className="mb-2 text-lg font-semibold flex items-center gap-2">
                                <Bell size={20} className="text-[#B7FF00]" />
                                Get Notified When We Launch
                            </h3>
                            <p className="mb-6 text-sm text-white/50">
                                Be the first to know when spots open up. Early access members get priority.
                            </p>

                            {/* Client Component for interactivity */}
                            <BootcampInterestForm bootcampId={bootcamp.id} slug={bootcamp.slug} bootcampTitle={bootcamp.title} />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
