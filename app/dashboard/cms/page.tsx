"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

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
  const s = normalize(input)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.length ? s : "prompt";
}

function StatusBadge({ status }: { status: string }) {
  const s = normalize(status);

  const cls =
    s === "published"
      ? "border-lime-400/30 bg-lime-400/10 text-lime-200"
      : s === "submitted"
      ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
      : "border-white/10 bg-black/40 text-white/70";

  return (
    <span className={["rounded-full border px-3 py-1 text-[11px]", cls].join(" ")}>
      {String(status || "").toUpperCase()}
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

  // local filters (client-side so we do not fight RLS or need extra indexes yet)
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

      if (cancelled) return;
      setRole(String((profile as ProfileRow | null)?.role || "user"));

      setLoading(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
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
          setRows([]);
          setRowsLoading(false);
          return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, me?.id, role, tab]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const c = String(r.category || "").trim();
      if (c) set.add(c);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = normalize(q);

    return rows.filter((r) => {
      if (accessFilter !== "all") {
        if (normalize(r.access_level) !== accessFilter) return false;
      }

      if (categoryFilter !== "all") {
        if (String(r.category || "").trim() !== categoryFilter) return false;
      }

      if (!needle) return true;

      const hay = `${normalize(r.title)} ${normalize(r.slug)}`;
      return hay.includes(needle);
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white">
        Loading CMS…
      </div>
    );
  }

  if (!isStaffPlus) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 text-white">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h1 className="text-xl font-semibold">CMS</h1>
          <p className="mt-2 text-sm text-white/70">You do not have staff access yet.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "drafts", label: "My Drafts" },
    { key: "submitted", label: "My Submitted" },
    ...(isEditorPlus ? [{ key: "review", label: "Review Queue" }] : []),
    ...(isEditorPlus ? [{ key: "published", label: "Published" }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10 text-white">
      <div className="mb-6 rounded-2xl border border-white/10 bg-black/40 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">CMS</h1>
            <p className="mt-1 text-sm text-white/70">
              Create prompts, submit for review, and publish.
            </p>
          </div>

          <button
            onClick={handleNewPrompt}
            className="inline-flex items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
          >
            New Prompt
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/dashboard/cms?tab=${encodeURIComponent(t.key)}`}
                className={[
                  "rounded-xl border px-3 py-2 text-sm transition",
                  active
                    ? "border-lime-400/40 bg-lime-400/10 text-white"
                    : "border-white/10 bg-black/30 text-white/75 hover:border-white/20 hover:text-white",
                ].join(" ")}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="text-[11px] text-white/50">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title or slug..."
              className="mt-1 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="text-[11px] text-white/50">Access</div>
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value as any)}
              className="mt-1 w-full bg-transparent text-sm text-white outline-none"
            >
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="text-[11px] text-white/50">Category</div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm text-white outline-none"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All" : c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 text-xs text-white/50">
          Showing {filteredRows.length} of {rows.length}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        {rowsError ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
            {rowsError}
          </div>
        ) : null}

        {rowsLoading ? (
          <div className="text-sm text-white/70">Loading…</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-sm text-white/70">No items found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredRows.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/cms/${r.id}`}
                className="rounded-xl border border-white/10 bg-black/30 p-4 hover:border-white/20 hover:bg-black/40"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{r.title || "(untitled)"}</div>
                    <div className="mt-1 text-xs text-white/50">slug: {r.slug}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />

                    <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
                      {String(r.access_level || "free").toUpperCase()}
                    </span>

                    {r.category ? (
                      <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/50">
                        {r.category}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
