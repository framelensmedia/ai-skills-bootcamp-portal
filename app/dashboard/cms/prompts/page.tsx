"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Loading from "@/components/Loading";
import {
    Plus, Search, MoreHorizontal, FileText, CheckCircle, Clock,
    AlertCircle, ArrowLeft, Upload, Shield, Sparkles, ChevronRight,
    Eye, EyeOff, Trash2, Edit
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

    const [rows, setRows] = useState<PromptRow[]>([]);
    const [rowsLoading, setRowsLoading] = useState(false);
    const [q, setQ] = useState("");
    const [accessFilter, setAccessFilter] = useState<"all" | "free" | "premium">("all");

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
        if (!loading && me?.id) {
            loadRows(me.id, role);
        }
    }, [loading, me?.id, role, tab]);

    // Handle "new" action
    useEffect(() => {
        if (action === "new" && me?.id && !loading) {
            handleNewPrompt();
        }
    }, [action, me?.id, loading]);

    async function loadRows(userId: string, currentRole: string) {
        setRowsLoading(true);

        try {
            let qy = supabase
                .from("prompts")
                .select("id, title, slug, status, access_level, category, created_at, updated_at, author_id")
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
            setRows((data || []) as PromptRow[]);
        } catch (e: any) {
            console.error(e);
            setRows([]);
        } finally {
            setRowsLoading(false);
        }
    }

    const filteredRows = useMemo(() => {
        const needle = normalize(q);
        return rows.filter((r) => {
            if (accessFilter !== "all" && normalize(r.access_level) !== accessFilter) return false;
            if (!needle) return true;
            return `${normalize(r.title)} ${normalize(r.slug)}`.includes(needle);
        });
    }, [rows, q, accessFilter]);

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

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white font-sans">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
                    <Link href="/dashboard/cms" className="hover:text-white">CMS</Link>
                    <ChevronRight size={12} />
                    <span className="text-[#B7FF00]">Prompts</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Sparkles className="text-[#FF6B6B]" />
                            Prompt Manager
                        </h1>
                        <p className="text-white/50 mt-1">Create and manage prompt templates</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/prompts/import"
                            className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                        >
                            <Upload size={16} />
                            Import
                        </Link>
                        <button
                            onClick={handleNewPrompt}
                            className="flex items-center gap-2 rounded-lg bg-[#B7FF00] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#a3e600]"
                        >
                            <Plus size={16} />
                            New Prompt
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <nav className="flex gap-1 overflow-x-auto">
                    {tabs.map((t) => (
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
                            placeholder="Search prompts..."
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Prompts Grid */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/30 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                    <div className="col-span-5">Title</div>
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
                                className="group grid grid-cols-12 gap-4 px-6 py-4 items-center transition hover:bg-white/5 cursor-pointer"
                                onClick={() => router.push(`/dashboard/cms/${r.id}`)}
                            >
                                <div className="col-span-5 flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/10">
                                        <Sparkles size={16} className="text-white/30" />
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
        </main>
    );
}
