"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, Play, Clock, X, ChevronUp, ChevronDown } from "lucide-react";
import VideoUploader from "./VideoUploader";

type Video = {
    id?: string;
    video_url: string;
    title: string;
    description?: string;
    order_index: number;
    duration_seconds: number;
    thumbnail_url?: string;
    is_published?: boolean;
};

type Props = {
    videos: Video[];
    onChange: (videos: Video[]) => void;
    maxVideos?: number;
    minVideos?: number;
};

export default function VideoManager({
    videos,
    onChange,
    maxVideos = 5,
    minVideos = 2,
}: Props) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    function addVideo() {
        if (videos.length >= maxVideos) return;

        const newVideo: Video = {
            video_url: "",
            title: `Micro-Video ${videos.length + 1}`,
            order_index: videos.length,
            duration_seconds: 60,
            is_published: true,
        };

        onChange([...videos, newVideo]);
        setExpandedIndex(videos.length);
    }

    function removeVideo(index: number) {
        const updated = videos.filter((_, i) => i !== index);
        // Reindex order
        const reindexed = updated.map((v, i) => ({ ...v, order_index: i }));
        onChange(reindexed);
        setExpandedIndex(null);
    }

    function updateVideo(index: number, field: keyof Video, value: any) {
        const updated = videos.map((v, i) =>
            i === index ? { ...v, [field]: value } : v
        );
        onChange(updated);
    }

    function moveVideo(index: number, direction: "up" | "down") {
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= videos.length) return;

        const updated = [...videos];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

        // Update order indexes
        const reindexed = updated.map((v, i) => ({ ...v, order_index: i }));
        onChange(reindexed);
        setExpandedIndex(newIndex);
    }

    // Calculate total duration
    const totalDuration = videos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
    const totalMinutes = Math.ceil(totalDuration / 60);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <Play size={16} className="text-[#B7FF00]" />
                        Micro-Videos
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                        Add 2–5 short AI avatar videos (45–75 sec each)
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-medium">{videos.length}/{maxVideos}</div>
                    <div className="text-xs text-white/50 flex items-center gap-1">
                        <Clock size={10} />
                        ~{totalMinutes} min total
                    </div>
                </div>
            </div>

            {/* Video List */}
            <div className="space-y-2">
                {videos.map((video, index) => (
                    <div
                        key={index}
                        className={`rounded-xl border bg-zinc-900/50 overflow-hidden transition ${expandedIndex === index
                            ? "border-[#B7FF00]/30"
                            : "border-white/10"
                            }`}
                    >
                        {/* Video Header Row */}
                        <div className="flex items-center gap-3 p-3">
                            {/* Order Number */}
                            <div className="flex items-center justify-center w-6 h-6 rounded bg-white/10 text-xs font-bold text-white/60">
                                {index + 1}
                            </div>

                            {/* Move Buttons */}
                            <div className="flex flex-col">
                                <button
                                    onClick={() => moveVideo(index, "up")}
                                    disabled={index === 0}
                                    className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    onClick={() => moveVideo(index, "down")}
                                    disabled={index === videos.length - 1}
                                    className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30"
                                >
                                    <ChevronDown size={14} />
                                </button>
                            </div>

                            {/* Title & URL Preview */}
                            <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                            >
                                <div className="font-medium text-sm truncate">
                                    {video.title || `Video ${index + 1}`}
                                </div>
                                <div className="text-xs text-white/40 truncate">
                                    {video.video_url || "No URL set"}
                                </div>
                            </div>

                            {/* Duration */}
                            <div className="text-xs text-white/50 flex items-center gap-1">
                                <Clock size={12} />
                                {video.duration_seconds}s
                            </div>

                            {/* Delete */}
                            <button
                                onClick={() => removeVideo(index)}
                                className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400 transition"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Expanded Editor */}
                        {expandedIndex === index && (
                            <div className="border-t border-white/10 p-4 space-y-4 bg-black/20">
                                <div className="space-y-4">
                                    {/* Title */}
                                    <div>
                                        <label className="block text-xs font-medium text-white/60 mb-1">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            value={video.title}
                                            onChange={(e) => updateVideo(index, "title", e.target.value)}
                                            placeholder="e.g., Introduction to AI Prompting"
                                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                                        />
                                    </div>

                                    {/* Video Source Selection */}
                                    <div>
                                        <label className="block text-xs font-medium text-white/60 mb-2">
                                            Video Source
                                        </label>

                                        <div className="space-y-3">
                                            {/* Upload Option */}
                                            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                                <div className="mb-2 text-xs font-medium text-white/80">Upload File</div>
                                                <VideoUploader
                                                    currentUrl={video.video_url && !video.video_url.includes("youtube") && !video.video_url.includes("vimeo") ? video.video_url : undefined}
                                                    onUpload={(url, duration) => {
                                                        const updated = videos.map((v, i) =>
                                                            i === index
                                                                ? { ...v, video_url: url, duration_seconds: duration || v.duration_seconds }
                                                                : v
                                                        );
                                                        onChange(updated);
                                                    }}
                                                />
                                            </div>

                                            <div className="relative flex items-center py-2">
                                                <div className="grow border-t border-white/10"></div>
                                                <span className="shrink-0 px-3 text-xs text-white/40">OR USE URL</span>
                                                <div className="grow border-t border-white/10"></div>
                                            </div>

                                            {/* URL Input */}
                                            <div>
                                                <input
                                                    type="url"
                                                    value={video.video_url}
                                                    onChange={(e) => updateVideo(index, "video_url", e.target.value)}
                                                    placeholder="https://youtube.com/watch?v=..."
                                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                                                />
                                                <p className="mt-1 text-[10px] text-white/40">
                                                    YouTube, Vimeo, or direct links
                                                </p>
                                            </div>
                                        </div>
                                    </div>


                                    {/* Duration */}
                                    <div className="w-32">
                                        <label className="block text-xs font-medium text-white/60 mb-1">
                                            Duration (seconds)
                                        </label>
                                        <input
                                            type="number"
                                            min={30}
                                            max={90}
                                            value={video.duration_seconds}
                                            onChange={(e) => updateVideo(index, "duration_seconds", parseInt(e.target.value) || 60)}
                                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#B7FF00] focus:outline-none"
                                        />
                                        <p className="mt-1 text-[10px] text-white/40">
                                            Target: 45–75 seconds
                                        </p>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-xs font-medium text-white/60 mb-1">
                                            Description (optional)
                                        </label>
                                        <textarea
                                            value={video.description || ""}
                                            onChange={(e) => updateVideo(index, "description", e.target.value)}
                                            placeholder="Brief description of what this video covers..."
                                            rows={2}
                                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Button */}
            {
                videos.length < maxVideos && (
                    <button
                        onClick={addVideo}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm text-white/60 hover:border-[#B7FF00]/50 hover:text-[#B7FF00] transition"
                    >
                        <Plus size={16} />
                        Add Micro-Video
                        <span className="text-white/30">({videos.length}/{maxVideos})</span>
                    </button>
                )
            }

            {/* Warning if below minimum */}
            {
                videos.length < minVideos && (
                    <p className="text-xs text-amber-400 flex items-center gap-1">
                        ⚠️ Add at least {minVideos} videos for a complete Learning Flow
                    </p>
                )
            }
        </div>
    );
}
