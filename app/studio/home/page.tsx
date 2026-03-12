"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Image as ImageIcon,
    Video,
    Activity,
    AudioWaveform,
    Music,
    Scissors,
    Plus,
    Folder,
    Clock,
    MoreVertical,
    Clapperboard,
    Wand2
} from "lucide-react";
import { useRouter } from "next/navigation";

interface NLEProject {
    id: string;
    name: string;
    is_draft: boolean;
    updated_at: string;
}

export default function StudioHomePage() {
    const router = useRouter();
    const [projects, setProjects] = useState<NLEProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
    };

    const formatDateTime = (dateString: string) => {
        const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
        const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(dateString));
        return `${date} at ${time}`;
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/nle-projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data.projects || []);
            }
        } catch (error) {
            console.error("Failed to fetch projects:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const quickTools = [
        { name: "Image", icon: ImageIcon, href: "/studio/tools", color: "text-amber-400 group-hover:text-amber-300" },
        { name: "Video", icon: Video, href: "/studio/tools?tab=video", color: "text-blue-400 group-hover:text-blue-300" },
        { name: "Magic Video", icon: Wand2, href: "/studio/reference-video", color: "text-violet-400 group-hover:text-violet-300" },
        { name: "Music", icon: Music, href: "/studio/tools?tab=music", color: "text-emerald-400 group-hover:text-emerald-300" },
        { name: "Voice", icon: AudioWaveform, href: "/studio/tools?tab=voice", color: "text-violet-400 group-hover:text-violet-300" },
        { name: "Sound FX", icon: Activity, href: "/studio/soundfx", color: "text-rose-400 group-hover:text-rose-300" },
        { name: "Editor", icon: Scissors, href: "/studio/edit", color: "text-lime-400 group-hover:text-lime-300" },
    ];

    return (
        <main className="min-h-[calc(100vh-64px)] w-full bg-black text-white flex flex-col items-center justify-start overflow-y-auto">
            <div className="w-full max-w-6xl px-6 py-12 flex flex-col gap-12 z-10">

                {/* Header & Primary CTA */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                            <Clapperboard className="text-lime-400" size={28} />
                            Creator Studio
                        </h1>
                        <p className="text-sm text-white/50 font-medium">
                            Choose a tool to start creating, or open a recent project.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/studio/edit')}
                        className="h-12 px-6 bg-lime-400 hover:bg-lime-300 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(183,255,0,0.15)] active:scale-95 shrink-0"
                    >
                        <Plus size={20} />
                        New Project
                    </button>
                </div>

                {/* Quick Tools Row */}
                <div>
                    <h2 className="text-xs font-bold text-white/40 uppercase tracking-[0.15em] mb-6 pl-2">Quick Tools</h2>
                    <div className="flex flex-wrap gap-4 sm:gap-8">
                        {quickTools.map((tool) => (
                            <Link
                                key={tool.name}
                                href={tool.href}
                                className="group flex flex-col items-center justify-center transition-all hover:-translate-y-1 cursor-pointer w-[80px] sm:w-[100px]"
                            >
                                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#111] border border-white/5 flex items-center justify-center mb-4 transition-all group-hover:bg-[#161616] group-hover:border-white/10 shadow-lg`}>
                                    <tool.icon size={28} className={`transition-colors ${tool.color}`} />
                                </div>
                                <span className="text-[10px] font-bold text-white/50 text-center tracking-widest group-hover:text-white transition-colors uppercase leading-tight">
                                    {tool.name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Recent Projects */}
                <div className="flex-1 flex flex-col mt-4">
                    <h2 className="text-xs font-bold text-white/40 uppercase tracking-[0.15em] mb-6 pl-2">Recent Projects</h2>

                    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden flex-1 min-h-[300px]">

                        {/* List Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 text-[10px] font-extrabold text-white/40 uppercase tracking-widest border-b border-white/5 bg-[#161616]">
                            <div className="col-span-6 flex items-center gap-2">Name</div>
                            <div className="col-span-3 hidden sm:flex items-center gap-2">Status</div>
                            <div className="col-span-3 hidden sm:flex items-center gap-2 justify-end">Last Modified</div>
                        </div>

                        {/* Loading State */}
                        {isLoading && (
                            <div className="p-12 flex flex-col items-center justify-center text-white/30 gap-4">
                                <div className="w-6 h-6 border-2 border-white/20 border-t-lime-400 rounded-full animate-spin" />
                                <span className="text-sm font-medium">Loading projects...</span>
                            </div>
                        )}

                        {/* Empty State */}
                        {!isLoading && projects.length === 0 && (
                            <div className="p-16 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-white/20">
                                    <Folder size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-white/80 mb-2">No recent projects</h3>
                                <p className="text-sm text-white/40 max-w-sm mb-6">
                                    Create a new project in the NLE Editor to see your work appear here.
                                </p>
                                <button
                                    onClick={() => router.push('/studio/edit')}
                                    className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-lg text-sm transition-colors"
                                >
                                    Start Editing
                                </button>
                            </div>
                        )}

                        {/* Project List */}
                        {!isLoading && projects.length > 0 && (
                            <div className="divide-y divide-white/5">
                                {projects.map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => router.push(`/studio/edit?project=${project.id}`)}
                                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center group cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <div className="col-span-12 sm:col-span-6 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-lime-400 group-hover:scale-105 transition-transform">
                                                <Scissors size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white/90 group-hover:text-white transition-colors">{project.name || 'Untitled Project'}</span>
                                                <span className="text-[10px] text-white/40 sm:hidden mt-0.5 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {formatDate(project.updated_at)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="col-span-3 hidden sm:flex items-center">
                                            {project.is_draft ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/50">Draft</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-lime-400/10 text-lime-400">Saved</span>
                                            )}
                                        </div>

                                        <div className="col-span-3 hidden sm:flex items-center justify-end text-xs text-white/40 font-medium whitespace-nowrap gap-4">
                                            <span>{formatDateTime(project.updated_at)}</span>
                                            <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0">
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </main>
    );
}
