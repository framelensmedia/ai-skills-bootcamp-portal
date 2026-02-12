"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Search, Check, Plus, X, Sparkles, Upload, Loader2 } from "lucide-react";
import Image from "next/image";

export type Template = {
    id: string;
    title: string;
    slug: string;
    image_url: string | null;
    featured_image_url: string | null;
    media_url: string | null;
    visibility: string;
    access_level: string;
    category: string | null;
};

type Props = {
    selectedTemplateId: string | null;
    onSelect: (templateId: string | null, template?: Template) => void;
    visibilityFilter?: ("public" | "learning_only" | "staff_only")[];
    showUpload?: boolean;
    onUploadComplete?: (template: Template) => void;
};

export default function TemplateSelector({
    selectedTemplateId,
    onSelect,
    visibilityFilter = ["public", "learning_only"],
    showUpload = true,
    onUploadComplete,
}: Props) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    useEffect(() => {
        // Load selected template details if ID provided
        if (selectedTemplateId && !selectedTemplate) {
            loadSelectedTemplate(selectedTemplateId);
        }
    }, [selectedTemplateId]);

    async function loadTemplates() {
        try {
            // Query prompts table for templates
            const { data, error } = await supabase
                .from("prompts")
                .select("id, title, slug, image_url, featured_image_url, media_url, visibility, access_level, category")
                .in("visibility", visibilityFilter)
                .eq("status", "published")
                .order("title", { ascending: true })
                .limit(100);

            if (error) throw error;
            setTemplates(data || []);
        } catch (e) {
            console.error("Failed to load templates:", e);
        } finally {
            setLoading(false);
        }
    }

    async function loadSelectedTemplate(id: string) {
        try {
            const { data } = await supabase
                .from("prompts")
                .select("id, title, slug, image_url, featured_image_url, media_url, visibility, access_level, category")
                .eq("id", id)
                .single();

            if (data) {
                setSelectedTemplate(data);
            }
        } catch (e) {
            console.error("Failed to load selected template:", e);
        }
    }

    const filteredTemplates = useMemo(() => {
        if (!search.trim()) return templates;
        const q = search.toLowerCase();
        return templates.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.slug.toLowerCase().includes(q) ||
            t.category?.toLowerCase().includes(q)
        );
    }, [templates, search]);

    function handleSelect(template: Template) {
        setSelectedTemplate(template);
        onSelect(template.id, template);
        setIsOpen(false);
    }

    function handleClear() {
        setSelectedTemplate(null);
        onSelect(null);
    }

    // Helper to get best image
    const getTemplateImage = (t: Template) => t.featured_image_url || t.image_url || t.media_url;

    return (
        <div className="relative">
            {/* Selected Template Display */}
            {selectedTemplate ? (
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900 p-3">
                    {getTemplateImage(selectedTemplate) ? (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                            <Image
                                src={getTemplateImage(selectedTemplate)!}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                            <Sparkles size={20} className="text-white/30" />
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{selectedTemplate.title}</div>
                        <div className="text-xs text-white/40 flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selectedTemplate.visibility === "learning_only"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-green-500/20 text-green-400"
                                }`}>
                                {selectedTemplate.visibility === "learning_only" ? "Learning Only" : "Public"}
                            </span>
                            {selectedTemplate.category && <span>{selectedTemplate.category}</span>}
                        </div>
                    </div>

                    <button
                        onClick={handleClear}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-full flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900 p-3 text-left hover:border-white/20 transition"
                >
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-dashed border-white/20">
                        <Plus size={20} className="text-white/40" />
                    </div>
                    <div>
                        <div className="font-medium text-sm text-white/80">Select Template</div>
                        <div className="text-xs text-white/40">Choose a template for this Learning Flow</div>
                    </div>
                </button>
            )}

            {/* Selector Modal */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:max-h-[80vh] z-50 flex flex-col rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                            <h3 className="font-bold">Select Template</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded hover:bg-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-4 py-3 border-b border-white/10">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search templates..."
                                    className="w-full rounded-lg border border-white/10 bg-zinc-800 pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Template Grid */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-12 text-white/40">
                                    <Loader2 className="animate-spin" />
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="text-center py-12 text-white/40">
                                    <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No templates found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {filteredTemplates.map(template => {
                                        const imageUrl = getTemplateImage(template);
                                        return (
                                            <button
                                                key={template.id}
                                                onClick={() => handleSelect(template)}
                                                className={`group relative rounded-xl border p-2 text-left transition ${selectedTemplateId === template.id
                                                    ? "border-[#B7FF00] bg-[#B7FF00]/10"
                                                    : "border-white/10 hover:border-white/20 bg-zinc-800/50"
                                                    }`}
                                            >
                                                {/* Check mark */}
                                                {selectedTemplateId === template.id && (
                                                    <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-[#B7FF00] flex items-center justify-center">
                                                        <Check size={12} className="text-black" />
                                                    </div>
                                                )}

                                                {/* Image */}
                                                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-zinc-800 mb-2">
                                                    {imageUrl ? (
                                                        <Image
                                                            src={imageUrl}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Sparkles size={24} className="text-white/20" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="text-xs font-medium truncate">{template.title}</div>
                                                <div className="text-[10px] text-white/40 truncate">
                                                    {template.visibility === "learning_only" ? "Learning Only" : "Public"}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer with Upload option */}
                        {showUpload && (
                            <div className="border-t border-white/10 px-4 py-3">
                                <button
                                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 py-2 text-sm text-white/60 hover:border-white/40 hover:text-white transition"
                                    onClick={() => {
                                        // TODO: Open upload modal
                                        alert("Template upload coming soon. Use the Prompt Editor to import templates.");
                                    }}
                                >
                                    <Upload size={16} />
                                    Upload New Template
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
