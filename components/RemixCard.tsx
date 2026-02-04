"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { RefreshCw, User, ArrowBigUp, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import AutoplayVideo from "./AutoplayVideo";

// Define the shape of a Remix Item
export type RemixItem = {
    id: string;
    imageUrl: string;
    videoUrl?: string; // Added videoUrl
    mediaType?: "image" | "video"; // Added mediaType
    title: string;
    username: string;
    userAvatar: string | null;
    upvotesCount: number;
    originalPromptText?: string;
    remixPromptText?: string;
    combinedPromptText?: string;
    createdAt: string;
    promptId?: string;
};

type RemixCardProps = {
    item: RemixItem;
    onRemix?: (item: RemixItem) => void;
};

export default function RemixCard({ item, onRemix }: RemixCardProps) {
    const router = useRouter();
    const [imgFailed, setImgFailed] = useState(false);

    const handleRemixClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onRemix) {
            onRemix(item);
            return;
        }

        // Default behavior: Go to Studio with params
        let href = `/studio?img=${encodeURIComponent(item.imageUrl)}` +
            `&remix=${encodeURIComponent(item.remixPromptText || item.combinedPromptText || "")}`;

        if (item.promptId) {
            href += `&promptId=${encodeURIComponent(item.promptId)}`;
        }

        router.push(href);
    };

    return (
        <div className="relative group rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 hover:bg-white/10 transition-all duration-300">
            {/* Image Area - Link to Detail Page */}
            <Link href={`/remix/${item.id}`} className="block relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/40">
                {item.mediaType === "video" && item.videoUrl ? (
                    <>
                        <AutoplayVideo
                            src={item.videoUrl}
                            className="absolute inset-0 w-full h-full object-cover"
                            poster={item.imageUrl || undefined} // Use imageUrl as poster if available
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 rounded-full border-2 border-white/60 flex items-center justify-center group-hover:scale-110 group-hover:border-white transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                                <svg className="w-5 h-5 text-white/90 ml-0.5 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="absolute top-2 right-2 z-10 bg-black/70 text-lime-400 text-[10px] font-bold uppercase px-2 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />
                            Video
                        </div>
                    </>
                ) : item.imageUrl && !imgFailed ? (
                    <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 320px"
                        onError={() => setImgFailed(true)}
                        unoptimized
                    />
                ) : (
                    <div className="h-full w-full bg-white/5 flex items-center justify-center text-white/20">
                        <span className="text-xs">No Preview</span>
                    </div>
                )}

                {/* Overlay Gradient */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

                {/* Top Left: User Info */}
                <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                    <div className="relative h-6 w-6 overflow-hidden rounded-full border border-white/20 bg-zinc-800">
                        {item.userAvatar ? (
                            <Image src={item.userAvatar} fill className="object-cover" alt={item.username} unoptimized />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/50">
                                <User size={12} />
                            </div>
                        )}
                    </div>
                    <span className="text-[11px] font-semibold text-white/90 shadow-sm drop-shadow-md">
                        {item.username}
                    </span>
                </div>
            </Link>

            {/* Content Body */}
            <div className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="line-clamp-1 text-sm font-bold text-white" title={item.title}>
                        {item.title || "Untitled Remix"}
                    </h3>

                    {/* Upvote Count (Visual Only or functional if we implement) */}
                    <div className="flex items-center gap-1 text-xs text-white/50">
                        <ArrowBigUp size={14} />
                        <span>{item.upvotesCount}</span>
                    </div>
                </div>

                <div className="mt-auto pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-white/5">
                    <span className="text-xs text-white/40">
                        {new Date(item.createdAt).toLocaleDateString()}
                    </span>

                    <button
                        onClick={handleRemixClick}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1.5 text-xs font-bold text-[#B7FF00] transition hover:bg-[#B7FF00] hover:text-black"
                    >
                        <RefreshCw size={12} />
                        Remix This
                    </button>
                </div>
            </div>
        </div >
    );
}
