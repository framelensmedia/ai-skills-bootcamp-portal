"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Loading from "@/components/Loading";
import {
    Plus, Search, MoreHorizontal, FileText, CheckCircle, Clock,
    AlertCircle, ArrowLeft, Upload, Shield, Sparkles, ChevronRight,
    Eye, EyeOff, Trash2, Edit, Layers
} from "lucide-react";

type PromptRow = {
    id: string;
    title: string;
    slug: string;
    status: string;
    access_level: string;
    category: string | null;
    created_at: string;
    updated_at: string;
    author_id: string | null;
    featured_image_url: string | null;
    preview_image_storage_path: string | null;
};

type PackRow = {
    id: string;
    pack_name: string;
    slug: string;
    is_published: boolean;
    access_level: string;
    thumbnail_url: string | null;
    category: string | null;
    created_at: string;
    template_count?: number;
};

type ProfileRow = { role: string };

function roleRank(role: string) {
    const r = String(role || "user").toLowerCase();
    const order = ["user", "staff", "instructor", "editor", "admin", "super_admin"];
    const idx = order.indexOf(r);
    return idx === -1 ? 0 : idx;
}

function normalize(s: string) {
    return String(s || "").trim().toLowerCase();
}

function slugify(input: string) {
    const s = normalize(input).replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
    return s.length ? s : "prompt";
}

function StatusBadge({ status }: { status: string }) {
    const s = normalize(status);
    let colorClass = "bg-white/10 text-white/50 border-white/10";
    let Icon = Clock;

    if (s === "published") {
        colorClass = "bg-[#B7FF00]/10 text-[#B7FF00] border-[#B7FF00]/20";
        Icon = CheckCircle;
    } else if (s === "submitted") {
        colorClass = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
        Icon = AlertCircle;
    }

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}>
            <Icon size={10} />
            {status}
        </span>
    );
}

export default function PromptsCMSPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const tab = normalize(searchParams?.get("tab") || "all");
    const action = searchParams?.get("action");

    const [loading, setLoading] = useState(true);
    const [me, setMe] = useState<any>(null);
    const [role, setRole] = useState<string>("user");

    const [viewMode, setViewMode] = useState<"templates" | "packs">("templates");

    const [rows, setRows] = useState<PromptRow[]>([]);
    const [packs, setPacks] = useState<PackRow[]>([]);
    const [rowsLoading, setRowsLoading] = useState(false);

    const [q, setQ] = useState("");
    const [accessFilter, setAccessFilter] = useState<"all" | "free" | "premium">("all");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    const isStaffPlus = useMemo(() => roleRank(role) >= roleRank("staff"), [role]);
    const isEditorPlus = useMemo(() => roleRank(role) >= roleRank("editor"), [role]);

    useEffect(() => {
        async function boot() {
            const { data } = await supabase.auth.getUser();
            const user = data?.user;

            if (!user) {
                router.push("/login");
                return;
            }

            setMe(user);

            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("user_id", user.id)
                .maybeSingle();

            if (profile) {
                setRole(String((profile as ProfileRow).role || "user"));
            }

            setLoading(false);
        }

        boot();
    }, [router, supabase]);

    useEffect(() => {
        // Clear selection when mode changes
        setSelected(new Set());
    }, [viewMode]);

    useEffect(() => {
        if (!loading && me?.id) {
            if (viewMode === "templates") {
                loadRows(me.id, role);
            } else {
                loadPacks();
            }
        }
    }, [loading, me?.id, role, tab, viewMode]);

    // Handle "new" action
    useEffect(() => {
        if (action === "new" && me?.id && !loading && viewMode === "templates") {
            handleNewPrompt();
        }
    }, [action, me?.id, loading, viewMode]);

    async function loadRows(userId: string, currentRole: string) {
        setRowsLoading(true);
        try {
            let qy = supabase
                .from("prompts")
                .select("id, title, slug, status, access_level, category, created_at, updated_at, author_id, featured_image_url, preview_image_storage_path")
                .order("updated_at", { ascending: false })
                .limit(200);

            const editorPlus = roleRank(currentRole) >= roleRank("editor");

            if (tab === "review") {
                if (!editorPlus) { setRows([]); return; }
                qy = qy.eq("status", "submitted");
            } else if (tab === "published") {
                qy = qy.eq("status", "published");
            } else if (tab === "drafts") {
                qy = qy.eq("status", "draft");
            }
            // "all" shows everything

            const { data, error } = await qy;
            if (error) throw error;
            setRows((data || []) as any);
        } catch (e: any) {
            console.error(e);
            setRows([]);
        } finally {
            setRowsLoading(false);
        }
    }

    async function loadPacks() {
        setRowsLoading(true);
        try {
            let query = supabase
                .from("template_packs")
                .select("id, pack_name, slug, is_published, access_level, thumbnail_url, category, created_at")
                .order("created_at", { ascending: false });

            // Apply pack filters if needed (simple search only for now)
            if (q) {
                query = query.ilike("pack_name", `%${q}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Fetch counts
            const packsWithCounts = await Promise.all((data || []).map(async (p) => {
                const { count } = await supabase
                    .from("prompts")
                    .select("id", { count: "exact", head: true })
                    .eq("template_pack_id", p.id);
                return { ...p, template_count: count || 0 };
            }));

            setPacks(packsWithCounts as PackRow[]);
        } catch (e: any) {
            console.error("Failed to load packs", e);
            setPacks([]);
        } finally {
            setRowsLoading(false);
        }
    }

    const filteredRows = useMemo(() => {
        const needle = normalize(q);
        if (viewMode === "templates") {
            return rows.filter((r) => {
                if (accessFilter !== "all" && normalize(r.access_level) !== accessFilter) return false;
                if (!needle) return true;
                return `${normalize(r.title)} ${normalize(r.slug)}`.includes(needle);
            });
        }
        return [];
    }, [rows, q, accessFilter, viewMode]);

    const filteredPacks = useMemo(() => {
        const needle = normalize(q);
        if (viewMode === "packs") {
            return packs.filter((p) => {
                if (accessFilter !== "all" && normalize(p.access_level) !== p.access_level) return false; // p.access_level is likely raw DB val
                // Strict check:
                if (accessFilter !== "all" && normalize(p.access_level) !== accessFilter) return false;

                if (!needle) return true;
                return `${normalize(p.pack_name)} ${normalize(p.slug)}`.includes(needle);
            });
        }
        return [];
    }, [packs, q, accessFilter, viewMode]);

    function toggleSelect(id: string) {
        const newSet = new Set(selected);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelected(newSet);
    }

    function toggleSelectAll() {
        const currentList = viewMode === "templates" ? filteredRows : filteredPacks;
        if (selected.size === currentList.length && currentList.length > 0) {
            setSelected(new Set());
        } else {
            setSelected(new Set(currentList.map((r) => r.id)));
        }
    }

    async function handleBulkDelete() {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} item(s)?`)) return;

        setDeleting(true);
        try {
            const endpoint = viewMode === "templates"
                ? "/api/admin/prompts/bulk-delete"
                : "/api/admin/packs/bulk-delete";

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selected) }),
            });

            if (!res.ok) throw new Error("Delete failed");

            setSelected(new Set());
            if (me?.id) {
                if (viewMode === "templates") loadRows(me.id, role);
                else loadPacks();
            };
        } catch (e: any) {
            alert(e.message || "Failed to delete");
        } finally {
            setDeleting(false);
        }
    }

    async function handleBulkStatusChange(newStatus: string, newIsPublished: boolean) {
        if (selected.size === 0) return;
        const action = newIsPublished ? "publish" : "send to draft";
        if (!confirm(`${action} ${selected.size} item(s)?`)) return;

        setDeleting(true);
        try {
            const endpoint = viewMode === "templates"
                ? "/api/admin/prompts/bulk-status"
                : "/api/admin/packs/bulk-status";

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selected),
                    status: newStatus,
                    is_published: newIsPublished
                }),
            });

            if (!res.ok) throw new Error("Status update failed");

            setSelected(new Set());
            if (me?.id) {
                if (viewMode === "templates") loadRows(me.id, role);
                else loadPacks();
            };
        } catch (e: any) {
            alert(e.message || "Failed to update status");
        } finally {
            setDeleting(false);
        }
    }

    function getImageUrl(row: any) {
        if (row.featured_image_url) return row.featured_image_url;
        if (row.preview_image_storage_path) {
            return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bootcamp-assets/${row.preview_image_storage_path}`;
        }
        return "/orb-neon.gif";
    }

    async function handleNewPrompt() {
        if (!me?.id) return;
        try {
            const baseTitle = "New Prompt";
            const uniqueSlug = `${slugify(baseTitle)}-${Date.now()}`;
            const { data, error } = await supabase
                .from("prompts")
                .insert({
                    title: baseTitle,
                    slug: uniqueSlug,
                    prompt_text: "",
                    prompt: "",
                    access_level: "free",
                    status: "draft",
                    author_id: me.id,
                    media_type: "image",
                })
                .select("id")
                .single();
            if (error) throw error;
            router.push(`/dashboard/cms/${data.id}`);
        } catch (e: any) {
            alert(e?.message || "Failed to create prompt");
        }
    }

    if (loading) return <Loading />;

    if (!isStaffPlus) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <div className="rounded-full bg-white/5 p-4">
                    <Shield size={32} className="text-white/20" />
                </div>
                <h2 className="text-xl font-bold text-white">Access Denied</h2>
                <p className="text-white/50">You do not have permission to manage prompts.</p>
                <Link href="/dashboard" className="text-sm font-medium text-[#B7FF00] hover:underline">
                    Return to Dashboard
                </Link>
            </div>
        );
    }

    const tabs = [
        { key: "all", label: "All" },
        { key: "drafts", label: "Drafts" },
        { key: "published", label: "Published" },
        ...(isEditorPlus ? [{ key: "review", label: "Review Queue" }] : []),
    ];

    // Helper to see if any selected are drafts (to show publish button)
    const currentList = viewMode === "templates" ? filteredRows : filteredPacks;
    const selectedItems = currentList.filter(item => selected.has(item.id));

    // For packs, is_published is boolean. For templates, status is string.
    const hasPublished = selectedItems.some(i =>
        viewMode === "templates"
            ? normalize((i as PromptRow).status) === "published"
            : (i as PackRow).is_published
    );

    const hasDrafts = selectedItems.some(i =>
        viewMode === "templates"
            ? normalize((i as PromptRow).status) !== "published"
            : !(i as PackRow).is_published
    );

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white font-sans">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
                        <Link href="/dashboard/cms" className="hover:text-white">CMS</Link>
                        <ChevronRight size={12} />
                        <span className="text-[#B7FF00]">Prompts</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Sparkles className="text-[#FF6B6B]" />
                            Prompt Manager
                        </h1>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                            CMS
                        </span>
                    </div>
                    <p className="text-white/50 mt-1">Manage single templates or full prompt packs.</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* View Toggle */}
                    <div className="flex rounded-lg bg-white/5 p-1 border border-white/10">
                        <button
                            onClick={() => setViewMode("templates")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === "templates"
                                ? "bg-[#B7FF00] text-black shadow-sm"
                                : "text-white/60 hover:text-white"
                                }`}
                        >
                            Templates
                        </button>
                        <button
                            onClick={() => setViewMode("packs")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === "packs"
                                ? "bg-[#B7FF00] text-black shadow-sm"
                                : "text-white/60 hover:text-white"
                                }`}
                        >
                            Packs
                        </button>
                    </div>

                    <Link
                        href="/dashboard/cms/prompts/import"
                        className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                        <Upload size={16} />
                        Import
                    </Link>

                    {viewMode === "templates" && (
                        <button
                            onClick={handleNewPrompt}
                            className="flex items-center gap-2 rounded-lg bg-[#B7FF00] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#a3e600]"
                        >
                            <Plus size={16} />
                            New
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Controls (Shared) */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <nav className="flex gap-1 overflow-x-auto">
                    {/* Only show tabs for Templates mode as Packs just has List */}
                    {viewMode === "templates" && tabs.map((t) => (
                        <Link
                            key={t.key}
                            href={`/dashboard/cms/prompts?tab=${t.key}`}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap ${tab === t.key
                                ? "bg-white text-black"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {t.label}
                        </Link>
                    ))}
                    {viewMode === "packs" && (
                        <div className="text-sm font-semibold text-white px-4 py-2">All Packs ({packs.length})</div>
                    )}
                </nav>

                <div className="flex items-center gap-3">
                    {/* Access Filter */}
                    <select
                        value={accessFilter}
                        onChange={(e) => setAccessFilter(e.target.value as any)}
                        className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#B7FF00] focus:outline-none"
                    >
                        <option value="all">All Access</option>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                    </select>

                    {/* Search */}
                    <div className="relative w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={viewMode === 'templates' ? "Search prompts..." : "Search packs..."}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Bulk Actions Bar (Shared Logic) */}
            {selected.size > 0 && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3">
                    <span className="text-sm text-white/70">{selected.size} selected</span>

                    {hasDrafts && (
                        <button
                            onClick={() => handleBulkStatusChange("published", true)}
                            disabled={deleting}
                            className="rounded-lg bg-[#B7FF00]/20 px-3 py-1.5 text-xs font-semibold text-[#B7FF00] hover:bg-[#B7FF00]/30 disabled:opacity-50"
                        >
                            {deleting ? "Publishing..." : "Publish"}
                        </button>
                    )}

                    {hasPublished && (
                        <button
                            onClick={() => handleBulkStatusChange("draft", false)}
                            disabled={deleting}
                            className="rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-50"
                        >
                            {deleting ? "Sending to Draft..." : "Send to Draft"}
                        </button>
                    )}

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

            {/* Pack List View */}
            {viewMode === "packs" ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/30 overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                        <div className="col-span-1 flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={selected.size === filteredPacks.length && filteredPacks.length > 0}
                                onChange={toggleSelectAll}
                                className="h-4 w-4 rounded border-white/20 bg-white/10"
                            />
                        </div>
                        <div className="col-span-4">Pack Name</div>
                        <div className="col-span-2">Items</div>
                        <div className="col-span-2">Access</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-1 text-right">Edit</div>
                    </div>

                    {rowsLoading ? (
                        <div className="p-12 text-center text-white/40">Loading packs...</div>
                    ) : filteredPacks.length === 0 ? (
                        <div className="p-12 text-center text-white/40">No prompt packs found. Upload one via Import!</div>
                    ) : (
                        filteredPacks.map((pack) => (
                            <div
                                key={pack.id}
                                className="group grid grid-cols-12 gap-4 px-6 py-4 items-center transition hover:bg-white/5 border-b border-white/5 last:border-0"
                            >
                                <div className="col-span-1 flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(pack.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => {
                                            toggleSelect(pack.id);
                                        }}
                                        className="h-4 w-4 rounded border-white/20 bg-white/10 cursor-pointer"
                                    />
                                </div>
                                <div
                                    className="col-span-4 flex items-center gap-4 cursor-pointer"
                                    onClick={() => router.push(`/dashboard/cms/packs/${pack.id}`)}
                                >
                                    <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-black/40 border border-white/10 flex-shrink-0">
                                        {pack.thumbnail_url ? (
                                            <img src={pack.thumbnail_url} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-white/20">
                                                <Layers size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-semibold text-white truncate">{pack.pack_name}</div>
                                        <div className="text-xs text-white/50 truncate font-mono">/{pack.slug}</div>
                                    </div>
                                </div>
                                <div className="col-span-2 text-sm text-white/70">
                                    {pack.template_count} templates
                                </div>
                                <div className="col-span-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pack.access_level === 'premium'
                                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                        : "bg-white/10 text-white/60 border border-white/10"
                                        }`}>
                                        {pack.access_level || 'free'}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <StatusBadge status={pack.is_published ? "published" : "draft"} />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white transition">
                                        <Edit size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <>
                    {/* Prompts Grid (Existing) */}
                    <div className="rounded-2xl border border-white/10 bg-zinc-900/30 overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                            <div className="col-span-1 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selected.size === filteredRows.length && filteredRows.length > 0}
                                    onChange={toggleSelectAll}
                                    className="h-4 w-4 rounded border-white/20 bg-white/10"
                                />
                            </div>
                            <div className="col-span-4">Title</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Access</div>
                            <div className="col-span-2">Updated</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-white/5">
                            {rowsLoading ? (
                                <div className="flex h-40 items-center justify-center text-white/40 text-sm">
                                    Loading prompts...
                                </div>
                            ) : filteredRows.length === 0 ? (
                                <div className="flex h-40 flex-col items-center justify-center gap-2 text-white/40">
                                    <FileText size={24} className="opacity-50" />
                                    <div className="text-sm">No prompts found</div>
                                </div>
                            ) : (
                                filteredRows.map((r) => (
                                    <div
                                        key={r.id}
                                        className="group grid grid-cols-12 gap-4 px-6 py-4 items-center transition hover:bg-white/5"
                                    >
                                        <div className="col-span-1 flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(r.id)}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelect(r.id);
                                                }}
                                                className="h-4 w-4 rounded border-white/20 bg-white/10"
                                            />
                                        </div>
                                        <div
                                            className="col-span-4 flex items-center gap-3 min-w-0 cursor-pointer"
                                            onClick={() => router.push(`/dashboard/cms/${r.id}`)}
                                        >
                                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
                                                <img
                                                    src={getImageUrl(r)}
                                                    alt={r.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-medium text-white truncate group-hover:text-[#B7FF00] transition">
                                                    {r.title || "Untitled"}
                                                </div>
                                                <div className="text-xs text-white/40 truncate font-mono">/{r.slug}</div>
                                            </div>
                                        </div>

                                        <div className="col-span-2">
                                            <StatusBadge status={r.status} />
                                        </div>

                                        <div className="col-span-2">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-md ${r.access_level === "premium"
                                                ? "bg-purple-500/10 text-purple-400"
                                                : "text-white/60 bg-white/5"
                                                }`}>
                                                {r.access_level === "premium" ? "Premium" : "Free"}
                                            </span>
                                        </div>

                                        <div className="col-span-2 text-xs text-white/40">
                                            {new Date(r.updated_at).toLocaleDateString()}
                                        </div>

                                        <div className="col-span-1 flex justify-end">
                                            <button className="rounded-full p-2 text-white/40 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
                                                <MoreHorizontal size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
