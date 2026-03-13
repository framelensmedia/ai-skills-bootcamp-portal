"use client";

import { useState } from "react";
import { Upload, Clapperboard, Image as ImageIcon, AudioLines, X, Link } from "lucide-react";
import LibraryImagePickerModal from "./LibraryImagePickerModal";
import LibraryVideoPickerModal from "./LibraryVideoPickerModal";
import LibraryAudioPickerModal from "./LibraryAudioPickerModal";

export type MediaType = "image" | "video" | "audio";

interface MediaPickerProps {
    type: MediaType;
    label: string;
    description: string;
    value: string | null;
    onChange: (url: string | null) => void;
    placeholderIcon?: React.ReactNode;
}

export default function MediaPicker({
    type,
    label,
    description,
    value,
    onChange,
    placeholderIcon
}: MediaPickerProps) {
    const [modalOpen, setModalOpen] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onChange(URL.createObjectURL(e.target.files[0]));
        }
    };

    const getIcon = () => {
        if (placeholderIcon) return placeholderIcon;
        if (type === "video") return <Clapperboard className="text-white/20" size={32} />;
        if (type === "audio") return <AudioLines className="text-white/20" size={32} />;
        return <ImageIcon className="text-white/20" size={32} />;
    };

    const getAcceptTypes = () => {
        if (type === "video") return "video/mp4,video/webm,video/quicktime";
        if (type === "audio") return "audio/mp3,audio/wav,audio/mpeg";
        return "image/*";
    };

    return (
        <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
                {type === "video" && <Clapperboard size={16} className="text-primary" />}
                {type === "image" && <ImageIcon size={16} className="text-primary" />}
                {type === "audio" && <AudioLines size={16} className="text-primary" />}
                {label}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}

            {value ? (
                <div className="relative w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-white/10 group bg-[#111] flex flex-col items-center justify-center p-2 min-h-[120px]">
                    {type === "video" && (
                        <video src={value} className="w-full h-full object-contain max-h-[300px] rounded-lg" muted autoPlay loop playsInline 
                        // @ts-ignore
                        webkit-playsinline="true"
                        />
                    )}
                    {type === "image" && (
                        <img src={value} alt="Selected media" className="w-full h-full object-contain max-h-[300px] rounded-lg" />
                    )}
                    {type === "audio" && (
                        <div className="flex flex-col items-center justify-center py-6 w-full px-4 rounded-lg bg-black/50">
                            <AudioLines size={32} className="text-primary mb-4" />
                            <audio src={value} controls className="w-full h-10" />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-sm z-10">
                        <button
                            onClick={() => onChange(null)}
                            className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-200 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                        >
                            <X size={16} /> Remove Media
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => setModalOpen(true)}
                        className="group relative w-full py-4 px-4 bg-[#B7FF00]/5 hover:bg-[#B7FF00]/10 border border-[#B7FF00]/20 hover:border-[#B7FF00]/40 rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                        <Link size={16} className="text-[#B7FF00]/80 group-hover:text-[#B7FF00] transition-colors" />
                        <span className="text-[11px] font-extrabold text-[#B7FF00]/80 group-hover:text-[#B7FF00] transition-colors uppercase tracking-[0.1em]">
                            MY LIBRARY
                        </span>
                    </button>

                    <label className="group w-full py-4 px-4 bg-[#111] hover:bg-[#1a1a1a] border border-white/5 hover:border-white/10 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-inner">
                        <input
                            type="file"
                            accept={getAcceptTypes()}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Upload size={16} className="text-white/40 group-hover:text-white transition-colors" />
                        <span className="text-[11px] font-extrabold text-white/50 group-hover:text-white transition-colors uppercase tracking-[0.1em]">
                            UPLOAD {type === 'image' ? 'IMAGE' : type === 'video' ? 'VIDEO' : 'AUDIO'}
                        </span>
                    </label>
                </div>
            )}

            {/* Modals */}
            {type === "image" && modalOpen && (
                <LibraryImagePickerModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSelect={(url) => {
                        onChange(url);
                        setModalOpen(false);
                    }}
                />
            )}
            {type === "video" && modalOpen && (
                <LibraryVideoPickerModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSelect={(url) => {
                        onChange(url);
                        setModalOpen(false);
                    }}
                />
            )}
            {type === "audio" && modalOpen && (
                <LibraryAudioPickerModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSelect={(url: string) => {
                        onChange(url);
                        setModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
