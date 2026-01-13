"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";
import {
    ChevronLeft, Save, Trash2, Plus, Image as ImageIcon,
    Loader2, CheckCircle, AlertCircle, ArrowUp, ArrowDown,
    Edit, Search, X, Layers, GripVertical
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

// --- UI COMPONENTS ---
const Label = ({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) => (
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
        {Icon && <Icon size={10} />}
        {children}
    </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04] ${className}`}>
        {children}
    </div>
);

const Input = (props: any) => (
    <input
        {...props}
        className={`w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#B7FF00]/50 focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-[#B7FF00]/50 transition-all ${props.className}`}
    />
);

const TextArea = (props: any) => (
    <textarea
        {...props}
        className={`w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#B7FF00]/50 focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-[#B7FF00]/50 transition-all ${props.className}`}
    />
);

export default function PackEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pack, setPack] = useState<any>(null);
    const [templates, setTemplates] = useState<any[]>([]);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [slug, setSlug] = useState("");
    const [category, setCategory] = useState("Pro");
    const [accessLevel, setAccessLevel] = useState("free");
    const [isPublished, setIsPublished] = useState(false);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

    // Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
    const [searchQ, setSearchQ] = useState("");
    const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
    const [loadingAvailable, setLoadingAvailable] = useState(false);

    // Upload
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (showAddModal) loadAvailableTemplates();
    }, [showAddModal]);

    async function loadData() {
        setLoading(true);
        try {
            const { id } = await params;
            const { data: p } = await supabase.from("template_packs").select("*").eq("id", id).single();
            if (!p) throw new Error("Pack not found");

            setPack(p);
            setName(p.pack_name);
            setDescription(p.pack_description || "");
            setSlug(p.slug || "");
            setCategory(p.category || "Pro");
            setAccessLevel(p.access_level || "free");
            setIsPublished(p.is_published || false);
            setThumbnailUrl(p.thumbnail_url);

            const { data: t } = await supabase.from("prompts").select("id, title, status, access_level, pack_order_index").eq("template_pack_id", id).order("pack_order_index", { ascending: true });
            setTemplates(t || []);
        } catch (e: any) {
            console.error(e);
            showToast("Failed to load pack", "error");
        } finally {
            setLoading(false);
        }
    }

    async function loadAvailableTemplates() {
        setLoadingAvailable(true);
        try {
            const { data } = await supabase.from("prompts").select("id, title, status, access_level").is("template_pack_id", null).order("updated_at", { ascending: false }).limit(50);
            setAvailableTemplates(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAvailable(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            const { id } = await params;
            const { error } = await supabase.from("template_packs").update({
                pack_name: name,
                pack_description: description,
                slug: slug || name.toLowerCase().replace(/ /g, '-'),
                category: category,
                access_level: accessLevel,
                is_published: isPublished,
                thumbnail_url: thumbnailUrl,
                updated_at: new Date().toISOString()
            }).eq("id", id);

            if (error) throw error;

            if (isPublished) {
                // Auto-publish all templates in this pack
                const { data: { user } } = await supabase.auth.getUser();
                const { error: promoErr } = await supabase.from("prompts").update({
                    status: 'published',
                    published_at: new Date().toISOString(),
                    approved_by: user?.id
                }).eq("template_pack_id", id);

                if (promoErr) throw promoErr;

                // Update local state
                setTemplates(prev => prev.map(t => ({ ...t, status: 'published' })));
                showToast("Pack & Templates published successfully!", "success");
            } else {
                showToast("Pack saved successfully!");
            }

        } catch (e: any) {
            console.error(e);
            showToast("Failed to save", "error");
        } finally {
            setSaving(false);
        }
    }

    async function handleAddSelected() {
        if (selectedToAdd.size === 0) return;
        try {
            const { id } = await params;
            await supabase.from("prompts").update({ template_pack_id: id, pack_order_index: 999 }).in("id", Array.from(selectedToAdd));
            showToast(`Added ${selectedToAdd.size} items`);
            setShowAddModal(false);
            setSelectedToAdd(new Set());
            loadData();
        } catch (e) {
            showToast("Failed to add", "error");
        }
    }

    async function moveTemplate(index: number, direction: 'up' | 'down') {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === templates.length - 1)) return;
        const newTemplates = [...templates];
        const swapIdx = direction === 'up' ? index - 1 : index + 1;
        [newTemplates[index], newTemplates[swapIdx]] = [newTemplates[swapIdx], newTemplates[index]];
        newTemplates.forEach((t, i) => t.pack_order_index = i);
        setTemplates(newTemplates);

        try {
            // background save all
            for (const t of newTemplates) {
                await supabase.from("prompts").update({ pack_order_index: t.pack_order_index }).eq("id", t.id);
            }
        } catch (e) { console.error(e) }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const path = `packs/cover-${pack.id}-${Date.now()}.${file.name.split(".").pop()}`;
            await supabase.storage.from("bootcamp-assets").upload(path, file);
            const { data: { publicUrl } } = supabase.storage.from("bootcamp-assets").getPublicUrl(path);
            setThumbnailUrl(publicUrl);
            showToast("Cover uploaded");
        } catch (e) { showToast("Upload failed", "error"); }
        finally { setUploading(false); }
    }

    if (loading) return <div className="flex h-screen items-center justify-center text-white/50">Loading Pack Editor...</div>;

    const filteredAvailable = availableTemplates.filter(t => t.title.toLowerCase().includes(searchQ.toLowerCase()));

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#B7FF00]/30 selection:text-[#B7FF00]">
            {/* HEADER */}
            <header className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/cms/prompts?view=packs" className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white">
                            <ChevronLeft size={16} />
                        </Link>
                        <div className="h-6 w-[1px] bg-white/10" />
                        <div>
                            <h1 className="text-sm font-bold tracking-wide text-white">Pack Editor</h1>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
                                <span className={isPublished ? 'text-[#B7FF00]' : 'text-white/40'}>{isPublished ? 'PUBLISHED' : 'DRAFT'}</span>
                                <span>•</span>
                                <span className="font-mono">{pack?.id.slice(0, 8)}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        disabled={saving}
                        onClick={() => handleSave()}
                        className="flex items-center gap-2 rounded-lg bg-[#B7FF00] px-4 py-1.5 text-xs font-bold text-black shadow-[0_0_20px_-5px_#B7FF00] hover:bg-[#a3e600] disabled:opacity-50"
                    >
                        <Save size={12} />
                        Save Changes
                    </button>
                </div>
            </header>

            {/* MAIN */}
            <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-12">

                {/* LEFT: TEMPLATES LIST (8 Cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Layers size={20} className="text-[#B7FF00]" />
                            Pack Content
                        </h2>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
                        >
                            <Plus size={14} /> Add Templates
                        </button>
                    </div>

                    <div className="flex flex-col gap-2">
                        {templates.map((t, i) => (
                            <div key={t.id} className="group relative flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-white/10 hover:bg-white/[0.04]">
                                {/* Drag Handle (Visual) */}
                                <div className="flex flex-col gap-1 text-white/10 ml-1">
                                    <button onClick={() => moveTemplate(i, 'up')} disabled={i === 0} className="hover:text-white disabled:opacity-0"><ArrowUp size={12} /></button>
                                    <button onClick={() => moveTemplate(i, 'down')} disabled={i === templates.length - 1} className="hover:text-white disabled:opacity-0"><ArrowDown size={12} /></button>
                                </div>

                                <div className="h-8 w-8 flex items-center justify-center rounded bg-white/5 text-white/30 font-mono text-xs">
                                    {i + 1}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="truncate text-sm font-medium text-white">{t.title}</div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
                                        <span>{t.status}</span>
                                        <span>•</span>
                                        <span>{t.access_level}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 pr-2">
                                    <Link href={`/dashboard/cms/${t.id}`} className="rounded p-2 text-white/50 hover:bg-white/10 hover:text-white">
                                        <Edit size={14} />
                                    </Link>
                                    <button
                                        onClick={async () => {
                                            if (confirm("Remove?")) {
                                                await supabase.from("prompts").update({ template_pack_id: null }).eq("id", t.id);
                                                loadData();
                                            }
                                        }}
                                        className="rounded p-2 text-white/50 hover:bg-red-500/20 hover:text-red-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {templates.length === 0 && (
                            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-white/30">
                                No templates in this pack yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: METADATA (4 Cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                    {/* Cover Image */}
                    <Card className="group relative aspect-square w-full overflow-hidden bg-black">
                        {thumbnailUrl ? (
                            <img src={thumbnailUrl} alt="Cover" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/20">
                                <Layers size={48} />
                                <span className="text-xs font-bold uppercase tracking-widest">No Cover</span>
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => fileRef.current?.click()} className="rounded-full bg-white px-5 py-2 text-xs font-bold text-black hover:scale-105">
                                {uploading ? "Uploading..." : "Change Cover"}
                            </button>
                        </div>
                        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept="image/*" />
                    </Card>

                    {/* Meta Fields */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <Label icon={Edit}>Pack Details</Label>
                            <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Pack Name" className="mb-2 font-bold" />
                            <div className="flex gap-2">
                                <span className="flex items-center bg-white/5 px-3 rounded-lg text-xs text-white/50">/</span>
                                <Input value={slug} onChange={(e: any) => setSlug(e.target.value)} placeholder="url-slug" className="font-mono text-xs" />
                            </div>
                        </div>

                        <TextArea value={description} onChange={(e: any) => setDescription(e.target.value)} rows={3} placeholder="Pack Description..." />
                    </div>

                    {/* Settings */}
                    <Card className="p-5">
                        <Label icon={CheckCircle}>Settings</Label>
                        <div className="mt-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/60">Published Status</span>
                                <button onClick={() => setIsPublished(!isPublished)} className={`h-5 w-9 rounded-full p-1 transition-colors ${isPublished ? 'bg-[#B7FF00]' : 'bg-white/10'}`}>
                                    <div className={`h-3 w-3 rounded-full bg-black shadow transition-transform ${isPublished ? 'translate-x-4' : ''}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/60">Access Level</span>
                                <select value={accessLevel} onChange={(e: any) => setAccessLevel(e.target.value)} className="bg-transparent text-xs font-bold uppercase text-white outline-none">
                                    <option value="free" className="bg-black">Free</option>
                                    <option value="premium" className="bg-black">Premium</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/60">Category</span>
                                <Input value={category} onChange={(e: any) => setCategory(e.target.value)} className="w-32 py-1 text-right !bg-transparent !border-none !p-0 focus:!ring-0" />
                            </div>
                        </div>
                    </Card>

                </div>
            </main>

            {/* ADD COMPONENT MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">Add Templates</h3>
                            <button onClick={() => setShowAddModal(false)}><X size={20} className="text-white/50 hover:text-white" /></button>
                        </div>
                        <div className="p-4 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-white/30" size={16} />
                                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search library..." className="w-full rounded-xl bg-white/5 py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#B7FF00]" />
                            </div>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto p-2">
                            {filteredAvailable.map(t => (
                                <div key={t.id} onClick={() => { const s = new Set(selectedToAdd); if (s.has(t.id)) s.delete(t.id); else s.add(t.id); setSelectedToAdd(s); }} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors ${selectedToAdd.has(t.id) ? 'bg-[#B7FF00]/10' : 'hover:bg-white/5'}`}>
                                    <div className={`flex h-5 w-5 items-center justify-center rounded border ${selectedToAdd.has(t.id) ? 'border-[#B7FF00] bg-[#B7FF00]' : 'border-white/20'}`}>
                                        {selectedToAdd.has(t.id) && <CheckCircle size={12} className="text-black" />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">{t.title}</div>
                                        <div className="text-[10px] text-white/40">{t.status}</div>
                                    </div>
                                </div>
                            ))}
                            {filteredAvailable.length === 0 && <div className="p-8 text-center text-xs text-white/30">No available templates found.</div>}
                        </div>
                        <div className="flex justify-end gap-3 border-t border-white/10 bg-white/[0.02] px-6 py-4">
                            <button onClick={() => setShowAddModal(false)} className="text-xs font-bold text-white/50 hover:text-white">CANCEL</button>
                            <button onClick={handleAddSelected} disabled={selectedToAdd.size === 0} className="rounded-lg bg-[#B7FF00] px-6 py-2 text-xs font-bold text-black hover:bg-[#a3e600] disabled:opacity-50">
                                ADD SELECTED ({selectedToAdd.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
