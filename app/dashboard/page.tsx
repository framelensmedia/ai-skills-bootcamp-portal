"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type ProfileRow = {
  plan: string;
  role: string;
  staff_pro: boolean;
  staff_approved: boolean;
  is_approved: boolean;
};

function roleRank(role: string) {
  const r = String(role || "user").toLowerCase();
  const order = ["user", "staff", "instructor", "editor", "admin", "super_admin"];
  const idx = order.indexOf(r);
  return idx === -1 ? 0 : idx;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [plan, setPlan] = useState<string>("free");
  const [role, setRole] = useState<string>("user");
  const [staffPro, setStaffPro] = useState<boolean>(false);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingLoading, setPendingLoading] = useState<boolean>(false);

  const isStaffPlus = useMemo(() => roleRank(role) >= roleRank("staff"), [role]);
  const isEditorPlus = useMemo(() => roleRank(role) >= roleRank("editor"), [role]);
  const isAdminPlus = useMemo(() => roleRank(role) >= roleRank("admin"), [role]);

  const hasProAccess = useMemo(() => {
    const p = String(plan || "free").toLowerCase();
    if (p === "premium") return true;
    if (staffPro) return true;
    if (isStaffPlus) return true;
    return false;
  }, [plan, staffPro, isStaffPlus]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (cancelled) return;
      setUser(user);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan, role, staff_pro, staff_approved, is_approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!error && profile) {
        const p = profile as ProfileRow;
        setPlan(String(p.plan || "free"));
        setRole(String(p.role || "user"));
        setStaffPro(Boolean(p.staff_pro));
      } else {
        setPlan("free");
        setRole("user");
        setStaffPro(false);
      }

      setLoading(false);
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    let cancelled = false;

    async function loadPending() {
      if (!isEditorPlus) {
        setPendingCount(0);
        return;
      }

      setPendingLoading(true);

      try {
        const { count, error } = await supabase
          .from("prompts")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted");

        if (cancelled) return;

        if (error) {
          setPendingCount(0);
        } else {
          setPendingCount(Number(count || 0));
        }
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    }

    if (!loading) loadPending();

    return () => {
      cancelled = true;
    };
  }, [supabase, isEditorPlus, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10 text-white">
      {/* Dashboard Header */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-black/40 p-6 md:p-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold md:text-4xl">Dashboard</h1>

          <p className="text-sm text-white/70 md:text-base">
            Logged in as <span className="font-medium text-white">{user?.email}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2 text-sm text-white/70 md:text-base">
            <span>
              Plan: <span className="font-semibold text-white">{plan}</span>
            </span>

            <span className="text-white/40">•</span>

            <span>
              Role: <span className="font-semibold text-white">{role}</span>
            </span>

            <span className="text-white/40">•</span>

            <span>
              Pro Access:{" "}
              <span className={hasProAccess ? "font-semibold text-lime-300" : "font-semibold text-white"}>
                {hasProAccess ? "Yes" : "No"}
              </span>
            </span>

            {String(plan || "free").toLowerCase() !== "free" && (
              <>
                <span className="text-white/40">•</span>

                <button
                  onClick={async () => {
                    const res = await fetch("/api/stripe/portal", { method: "POST" });
                    const data = await res.json();
                    if (data?.url) {
                      window.open(data.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="font-medium text-indigo-400 underline underline-offset-4 hover:text-indigo-300"
                >
                  Manage billing
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Link
          href="/prompts"
          className="rounded-2xl border border-white/10 bg-black/40 p-6 hover:border-white/20"
        >
          <h2 className="mb-1 text-lg font-semibold">Prompts</h2>
          <p className="text-sm text-white/70">Browse free and premium prompts.</p>
        </Link>

        <Link
          href="/studio"
          className="rounded-2xl border border-white/10 bg-black/40 p-6 hover:border-white/20"
        >
          <h2 className="mb-1 text-lg font-semibold">Prompt Studio</h2>
          <p className="text-sm text-white/70">Create from scratch and save custom prompts.</p>
        </Link>

        <Link
          href="/library"
          className="rounded-2xl border border-white/10 bg-black/40 p-6 hover:border-white/20"
        >
          <h2 className="mb-1 text-lg font-semibold">My Library</h2>
          <p className="text-sm text-white/70">Your saved generations and inspiration.</p>
        </Link>
      </div>

      {/* Staff / Editor / Admin Panels */}
      {isStaffPlus ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Creator Tools</h2>
              <p className="mt-1 text-sm text-white/70">
                Create prompts, manage drafts, and submit for review.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/dashboard/cms"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
              >
                Open CMS
              </Link>

              {isEditorPlus ? (
                <Link
                  href="/dashboard/review"
                  className="inline-flex items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                >
                  Review Queue
                  <span className="ml-2 inline-flex items-center rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold text-black">
                    {pendingLoading ? "…" : String(pendingCount)}
                  </span>
                </Link>
              ) : null}

              {isAdminPlus ? (
                <Link
                  href="/dashboard/admin/users"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
                >
                  User Admin
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
