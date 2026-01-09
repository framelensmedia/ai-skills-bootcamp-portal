"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  Upload,
  Shield,
  Sparkles
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

type ProfileRow = {
  role: string;
};

// ... helper functions ...
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

export default function CmsHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const tab = normalize(searchParams.get("tab") || "drafts");

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [role, setRole] = useState<string>("user");

  const [rows, setRows] = useState<PromptRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // local filters
  const [q, setQ] = useState("");
  const [accessFilter, setAccessFilter] = useState<"all" | "free" | "premium">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const isStaffPlus = useMemo(() => roleRank(role) >= roleRank("staff"), [role]);
  const isEditorPlus = useMemo(() => roleRank(role) >= roleRank("editor"), [role]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      if (cancelled) return;
      setMe(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled && profile) {
        setRole(String((profile as ProfileRow).role || "user"));
      }

      setLoading(false);
    }

    boot();
    return () => { cancelled = true; };
  }, [router, supabase]);

  async function loadRows(userId: string, currentRole: string) {
    setRowsLoading(true);
    setRowsError(null);

    try {
      let qy = supabase
        .from("prompts")
        .select("id, title, slug, status, access_level, category, created_at, updated_at, author_id")
        .order("updated_at", { ascending: false })
        .limit(200);

      const editorPlus = roleRank(currentRole) >= roleRank("editor");

      if (tab === "review") {
        if (!editorPlus) {
          setRows([]); return;
        }
        qy = qy.eq("status", "submitted");
      } else if (tab === "published") {
        if (editorPlus) qy = qy.eq("status", "published");
        else qy = qy.eq("status", "published").eq("author_id", userId);
      } else if (tab === "submitted") {
        qy = qy.eq("status", "submitted").eq("author_id", userId);
      } else {
        qy = qy.eq("status", "draft").eq("author_id", userId);
      }

      const { data, error } = await qy;
      if (error) throw error;
      setRows((data || []) as PromptRow[]);
    } catch (e: any) {
      setRowsError(e?.message || "Failed to load prompts");
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }

  useEffect(() => {
    if (!loading && me?.id) {
      loadRows(me.id, role);
    }
  }, [loading, me?.id, role, tab]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.category) set.add(r.category); });
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = normalize(q);
    return rows.filter((r) => {
      if (accessFilter !== "all" && normalize(r.access_level) !== accessFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!needle) return true;
      return `${normalize(r.title)} ${normalize(r.slug)}`.includes(needle);
    });
  }, [rows, q, accessFilter, categoryFilter]);

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

  if (loading) return <div className="flex min-h-screen items-center justify-center text-white">Loading...</div>;

  if (!isStaffPlus) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-white/5 p-4">
          <Shield size={32} className="text-white/20" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-white/50">You do not have permission to view the CMS.</p>
        <Link href="/dashboard" className="text-sm font-medium text-[#B7FF00] hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  const tabs = [
    { key: "drafts", label: "My Drafts" },
    { key: "submitted", label: "Submitted" },
    ...(isEditorPlus ? [{ key: "review", label: "Queue" }] : []),
    ...(isEditorPlus ? [{ key: "published", label: "Published" }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/dashboard" className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/40 hover:text-white transition">
            <ArrowLeft size={12} />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">Content Management</h1>
          <p className="text-white/60">Manage your prompts, templates, and drafts.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/prompts/import" className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 hover:shadow-lg">
            <Upload size={16} />
            Import Template
          </Link>
          <button onClick={handleNewPrompt} className="flex items-center gap-2 rounded-xl bg-[#B7FF00] px-4 py-2.5 text-sm font-bold text-black transition hover:scale-105 hover:bg-[#c4ff33] hover:shadow-[0_0_20px_rgba(183,255,0,0.3)]">
            <Plus size={16} />
            Create New
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[600px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl">
        {/* Tabs & Filters Bar */}
        <div className="border-b border-white/10 bg-white/5 px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Tabs */}
            <nav className="flex gap-1 overflow-x-auto pb-2 md:pb-0">
              {tabs.map((t) => {
                const active = tab === t.key;
                return (
                  <Link
                    key={t.key}
                    href={`/dashboard/cms?tab=${encodeURIComponent(t.key)}`}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap ${active ? "bg-white text-black" : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>

            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by title..."
                className="w-full rounded-xl border border-white/5 bg-black/20 pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00]/50 focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Grid Header */}
        <div className="grid grid-cols-12 gap-4 border-b border-white/5 bg-white/[0.02] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          <div className="col-span-6 md:col-span-5">Title</div>
          <div className="col-span-3 hidden md:block">Status</div>
          <div className="col-span-3 hidden md:block">Access</div>
          <div className="col-span-6 md:col-span-1 text-right">Action</div>
        </div>

        {/* Grid Rows */}
        <div className="divide-y divide-white/5">
          {rowsLoading ? (
            <div className="flex h-40 items-center justify-center text-white/40 text-sm">Loading tracks...</div>
          ) : filteredRows.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-white/40">
              <FileText size={24} className="opacity-50" />
              <div className="text-sm">No items found</div>
            </div>
          ) : (
            filteredRows.map((r, i) => (
              <div
                key={r.id}
                className="group grid grid-cols-12 gap-4 px-6 py-4 items-center transition hover:bg-white/5 cursor-default"
                onClick={() => router.push(`/dashboard/cms/${r.id}`)}
              >
                <div className="col-span-6 md:col-span-5 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 text-white/30 font-bold border border-white/5 group-hover:border-white/20 transition">
                    {i + 1}
                  </div>
                  <div className="overflow-hidden">
                    <div className="truncate font-medium text-white group-hover:text-[#B7FF00] transition">{r.title || "Untitled Prompt"}</div>
                    <div className="text-xs text-white/40 truncate font-mono">/{r.slug}</div>
                  </div>
                </div>

                <div className="col-span-3 hidden md:flex items-center">
                  <StatusBadge status={r.status} />
                </div>

                <div className="col-span-3 hidden md:flex items-center">
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${r.access_level === 'premium' ? 'bg-purple-500/10 text-purple-400' : 'text-white/60 bg-white/5'
                    }`}>
                    {r.access_level === 'premium' ? 'Premium' : 'Free'}
                  </span>
                </div>

                <div className="col-span-6 md:col-span-1 flex justify-end">
                  <button className="rounded-full p-2 text-white/40 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
