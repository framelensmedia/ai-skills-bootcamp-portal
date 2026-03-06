"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type ProfileRow = {
  user_id: string;
  email: string | null;
  role: string;
  staff_pro: boolean;
  staff_approved: boolean;
  is_approved: boolean;
  created_at: string;
  credits: number;
  plan: string | null;
};

const ROLE_OPTIONS = ["user", "staff", "instructor", "editor", "admin", "super_admin"];

export default function AdminUsersPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [meRole, setMeRole] = useState<string>("user");

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  async function load() {
    setLoading(true);
    setErr(null);

    const { data: auth } = await supabase.auth.getUser();
    const myId = auth?.user?.id;

    if (myId) {
      const { data: me } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", myId)
        .maybeSingle();
      setMeRole(String(me?.role || "user"));
    }

    let query = supabase
      .from("profiles")
      .select("user_id,email,role,staff_pro,staff_approved,is_approved,created_at,credits,plan")
      .order("created_at", { ascending: false })
      .limit(200);

    if (searchTerm.trim() !== "") {
      const term = searchTerm.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
      if (isUuid) {
        query = query.or(`email.ilike.%${term}%,user_id.eq.${term}`);
      } else {
        query = query.ilike('email', `%${term}%`);
      }
    }

    if (roleFilter !== "all") {
      query = query.eq("role", roleFilter);
    }

    if (planFilter !== "all") {
      if (planFilter === "free") {
        query = query.or("plan.is.null,plan.eq.free").eq("staff_pro", false);
      } else if (planFilter === "premium") {
        query = query.or("plan.eq.premium,plan.ilike.pro,staff_pro.eq.true");
      }
    }

    const { data, error } = await query;

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as ProfileRow[]);
    }

    setLoading(false);
  }

  // Normal load on mount or search/filter
  useEffect(() => {
    // Basic debounce
    const t = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, roleFilter, planFilter]);

  async function updateRole(row: ProfileRow, nextRole: string) {
    setErr(null);

    // staff+ should always have pro
    const staffPlus = ["staff", "instructor", "editor", "admin", "super_admin"].includes(nextRole);

    const res = await fetch("/api/admin/users/update-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: row.user_id,
        role: nextRole,
        staff_pro: staffPlus ? true : row.staff_pro,
        staff_approved: staffPlus ? true : row.staff_approved,
        is_approved: staffPlus ? true : row.is_approved,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || "Failed to update role");
      return;
    }

    await load();
  }

  async function grantCredits(row: ProfileRow) {
    if (!["admin", "super_admin"].includes(meRole)) {
      alert("Only admins can grant credits directly.");
      return;
    }

    const val = prompt(`How many credits to add to ${row.email || row.user_id}?\n\nCurrent Balance: ${row.credits ?? 0}`);
    if (!val) return;

    const amount = parseInt(val.trim(), 10);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    const conf = confirm(`Add ${amount} credits to ${row.email || row.user_id}?`);
    if (!conf) return;

    setErr(null);
    try {
      const res = await fetch("/api/admin/users/add-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: row.user_id,
          amount
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || "Failed to add credits");
        return;
      }

      alert(`Successfully added ${amount} credits.`);
      await load();
    } catch (e: any) {
      setErr(e.message || "Failed to add credits");
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 text-white">
      <div>
        <h1 className="text-2xl font-semibold">Admin: Users</h1>
        <p className="mt-1 text-sm text-white/60">
          Flip roles, approve staff, and grant Pro access.
        </p>
        <p className="mt-2 text-xs text-white/45">
          Your role: {meRole}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col sm:flex-row gap-4">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search by Email or User ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="all">Role: All</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>Role: {opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="all">Plan: All</option>
              <option value="free">Plan: Free</option>
              <option value="premium">Plan: Premium</option>
            </select>
          </div>
        </div>
        <button
          onClick={load}
          className="whitespace-nowrap rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Refresh List
        </button>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        {loading ? (
          <div className="text-sm text-white/60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-white/60">No users found.</div>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <div
                key={r.user_id}
                className="rounded-xl border border-white/10 bg-black/40 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {r.email || r.user_id}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-white/60">
                      <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                        ROLE: {String(r.role).toUpperCase()}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                        PRO: {r.staff_pro || r.plan === 'premium' ? "YES" : "NO"}
                      </span>
                      {r.plan && r.plan !== 'free' && (
                        <span className="rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1 text-[#B7FF00]">
                          PLAN: {String(r.plan).toUpperCase()}
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                        CREDITS: {r.credits ?? 0}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                        STAFF APPROVED: {r.staff_approved ? "YES" : "NO"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={r.role}
                      onChange={(e) => updateRole(r, e.target.value)}
                      className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {["admin", "super_admin"].includes(meRole) && (
                      <button
                        onClick={() => grantCredits(r)}
                        className="rounded-lg border border-[#B7FF00]/50 bg-[#B7FF00]/10 px-3 py-2 text-xs font-semibold text-[#B7FF00] hover:bg-[#B7FF00]/20"
                      >
                        + Add Credits
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
