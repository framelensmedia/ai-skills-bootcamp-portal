"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
    files: File[];
    onChange: (files: File[]) => void;
    maxFiles?: number;
    disabled?: boolean;
    onUploadStart?: (e: React.MouseEvent) => void;
};

export default function ImageUploader({ files, onChange, maxFiles = 10, disabled, onUploadStart }: Props) {
    const [previews, setPreviews] = useState<string[]>([]);

    useEffect(() => {
        // create object URLs
        const urls = files.map((f) => URL.createObjectURL(f));
        setPreviews(urls);

        // cleanup
        return () => {
            urls.forEach((u) => URL.revokeObjectURL(u));
        };
    }, [files]);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (disabled) return;
        const newFiles = Array.from(e.target.files || []);
        if (!newFiles.length) return;

        // Filter images
        const imagesOnly = newFiles.filter((f) => f.type.startsWith("image/"));

        // Append to existing
        const merged = [...files, ...imagesOnly].slice(0, maxFiles);
        onChange(merged);

        // Reset input
        e.target.value = "";
    }

    function handleRemove(idx: number) {
        if (disabled) return;
        const next = files.filter((_, i) => i !== idx);
        onChange(next);
    }

    function handleClear() {
        if (disabled) return;
        onChange([]);
    }

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/90">Upload images</div>
                <div className="text-xs text-white/45">
                    {files.length}/{maxFiles}
                </div>
            </div>

            <p className="mt-2 text-sm text-white/55">
                Upload up to {maxFiles} reference images (subjects, examples).
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label
                    onClick={(e) => {
                        if (onUploadStart) {
                            onUploadStart(e);
                        }
                    }}
                    className={[
                        "inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-black/60",
                        disabled ? "cursor-not-allowed opacity-50" : "",
                    ].join(" ")}
                >
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={disabled}
                    />
                    Upload images
                </label>

                <button
                    type="button"
                    onClick={handleClear}
                    className={[
                        "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition",
                        files.length && !disabled
                            ? "border-white/15 bg-black/40 text-white/80 hover:bg-black/60"
                            : "cursor-not-allowed border-white/10 bg-black/20 text-white/35",
                    ].join(" ")}
                    disabled={!files.length || disabled}
                >
                    Clear
                </button>
            </div>

            {previews.length > 0 ? (
                <div className="mt-4 grid grid-cols-5 gap-2">
                    {previews.map((src, idx) => (
                        <div
                            key={src}
                            className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/40"
                            title={files[idx]?.name}
                        >
                            <div className="relative aspect-square w-full">
                                <Image src={src} alt={`Upload ${idx + 1}`} fill className="object-cover" unoptimized />
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemove(idx)}
                                disabled={disabled}
                                className="absolute right-1 top-1 rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-[11px] text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mt-4 text-xs text-white/45">No images uploaded.</div>
            )}
        </div>
    );
}
