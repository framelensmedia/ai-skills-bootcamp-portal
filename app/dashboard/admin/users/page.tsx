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
};

const ROLE_OPTIONS = ["user","staff","instructor","editor","admin","super_admin"];

export default function AdminUsersPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [meRole, setMeRole] = useState<string>("user");

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,email,role,staff_pro,staff_approved,is_approved,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as ProfileRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRole(row: ProfileRow, nextRole: string) {
    setErr(null);

    // staff+ should always have pro
    const staffPlus = ["staff","instructor","editor","admin","super_admin"].includes(nextRole);

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
                        PRO: {r.staff_pro ? "YES" : "NO"}
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
