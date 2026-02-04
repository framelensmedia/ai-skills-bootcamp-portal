"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Prompt = {
    id: string;
    title: string;
    slug: string;
    status: string;
    created_at: string;
    featured_image_url: string | null;
    preview_image_storage_path: string | null;
};

export default function PromptsTable({ prompts }: { prompts: Prompt[] }) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selected);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelected(newSet);
    };

    const toggleSelectAll = () => {
        if (selected.size === prompts.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(prompts.map((p) => p.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} prompt(s)?`)) return;

        setDeleting(true);
        try {
            const res = await fetch("/api/admin/prompts/bulk-delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selected) }),
            });

            if (!res.ok) throw new Error("Delete failed");

            setSelected(new Set());
            router.refresh();
        } catch (e: any) {
            alert(e.message || "Failed to delete");
        } finally {
            setDeleting(false);
        }
    };

    const getImageUrl = (prompt: Prompt) => {
        if (prompt.featured_image_url) return prompt.featured_image_url;
        if (prompt.preview_image_storage_path) {
            return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bootcamp-assets/${prompt.preview_image_storage_path}`;
        }
        return "/orb-neon.gif";
    };

    return (
        <>
            {selected.size > 0 && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3">
                    <span className="text-sm text-white/70">{selected.size} selected</span>
                    <button
                        onClick={handleBulkDelete}
                        disabled={deleting}
                        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                    >
                        {deleting ? "Deleting..." : "Delete Selected"}
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        className="text-xs text-white/50 hover:text-white/80"
                    >
                        Clear
                    </button>
                </div>
            )}

            <div className="grid gap-2">
                {prompts.length > 0 && (
                    <div className="mb-2 flex items-center gap-2 px-2 text-xs text-white/50">
                        <input
                            type="checkbox"
                            checked={selected.size === prompts.length && prompts.length > 0}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-white/20 bg-white/10"
                        />
                        <span>Select All</span>
                    </div>
                )}

                {prompts.map((p) => (
                    <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:bg-black/30"
                    >
                        <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="h-4 w-4 flex-shrink-0 rounded border-white/20 bg-white/10"
                        />

                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-black/40">
                            <Image
                                src={getImageUrl(p)}
                                alt={p.title}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{p.title}</div>
                            <div className="text-xs text-white/50 truncate">/{p.slug}</div>
                            <div className="mt-1 text-xs text-white/40">
                                {p.created_at ? new Date(p.created_at).toLocaleDateString() : "n/a"}
                            </div>
                        </div>

                        <div className="flex-shrink-0">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                                {p.status}
                            </span>
                        </div>

                        <a
                            href={`/prompts/${p.slug}`}
                            className="flex-shrink-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-black/45"
                        >
                            Edit
                        </a>
                    </div>
                ))}

                {prompts.length === 0 && (
                    <div className="py-8 text-center text-sm text-white/60">
                        No draft prompts. Import templates to get started.
                    </div>
                )}
            </div>
        </>
    );
}
