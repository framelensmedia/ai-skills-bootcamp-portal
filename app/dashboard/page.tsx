"use client";

import Link from "next/link";
import Loading from "@/components/Loading";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useAuth } from "@/context/AuthProvider";
import {
  CreditCard,
  DollarSign,
  LayoutGrid,
  Zap,
  Library,
  Settings,
  Users,
  FileText,
  Shield,
  Crown,
  Terminal,
  ArrowUpRight
} from "lucide-react";

type ProfileRow = {
  plan: string;
  role: string;
  staff_pro: boolean;
  staff_approved: boolean;
  is_approved: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, initialized } = useAuth();
  const supabase = createSupabaseBrowserClient(); // Singleton

  const [loadingProfile, setLoadingProfile] = useState(true);

  const [greeting, setGreeting] = useState("");

  const [plan, setPlan] = useState<string>("free");
  const [role, setRole] = useState<string>("user");
  const [staffPro, setStaffPro] = useState<boolean>(false);

  // Local user state for display (merged with profile)
  const [displayUser, setDisplayUser] = useState<any>(null);

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [managingBilling, setManagingBilling] = useState(false);

  // Role Checks
  const isStaffPlus = useMemo(() => ["staff", "instructor", "editor", "admin", "super_admin"].includes(role), [role]);
  const isEditorPlus = useMemo(() => ["editor", "admin", "super_admin"].includes(role), [role]);
  const isAdminPlus = useMemo(() => ["admin", "super_admin"].includes(role), [role]);

  const hasProAccess = useMemo(() => {
    const p = String(plan || "free").toLowerCase();
    return p === "premium" || staffPro || isStaffPlus;
  }, [plan, staffPro, isStaffPlus]);

  // Greeting Logic
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (initialized && !user) {
      router.push("/login?redirectTo=/dashboard");
    }
  }, [initialized, user, router]);

  // PAYMENT & REFERRAL CHECK
  useEffect(() => {
    if (!initialized || !user) return;

    // 1. Referral Safety Net
    // Fire and forget - ensures we capture referral if cookie exists but DB record missing
    fetch("/api/ambassador/track-referral", { method: "POST" })
      .catch(err => console.error("Referral track error:", err));

    // 2. Handle Payment Return
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === '1') {
      // Force refresh of router to clear server cache
      router.refresh();
      // Also locally trigger a reload of profile data
      setLoadingProfile(true);
      // Clear the param to avoid re-triggering
      window.history.replaceState({}, '', '/dashboard');
      // Ideally show a toast here, but simple alert or console for now is fine since UI updates
      console.log("Payment successful, refreshing profile...");
    }
  }, [initialized, user, router]);

  // Load Profile Data
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) return;

      setDisplayUser(user);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan, role, staff_pro, staff_approved, is_approved, username, full_name, profile_image")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled && !error && profile) {
        const p = profile as ProfileRow & { username?: string; full_name?: string; profile_image?: string };
        setPlan(String(p.plan || "free"));
        setRole(String(p.role || "user"));
        setStaffPro(Boolean(p.staff_pro));

        // Prioritize full_name > username > email
        const nameToUse = p.full_name || p.username;
        setDisplayUser((prev: any) => ({
          ...prev,
          displayName: nameToUse,
          avatarUrl: p.profile_image
        }));
      }

      setLoadingProfile(false);
    }

    if (initialized && user) {
      loadProfile();
    }

    return () => { cancelled = true; };
  }, [user, initialized, supabase]);

  if (!initialized || (user && loadingProfile)) {
    return <Loading />;
  }

  if (!user) return null; // Will redirect via effect

  // Use displayUser for rendering
  const finalUser = displayUser || user;



  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white font-sans">
      {/* Technical Header */}
      <div className="mb-8 border-b border-white/10 pb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#B7FF00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B7FF00] animate-pulse"></span>
            System Active • {role}
            {hasProAccess && (
              <span className="ml-2 inline-flex items-center justify-center rounded bg-[#B7FF00] px-1.5 py-0.5 text-[10px] font-bold text-black border border-[#B7FF00]">
                PRO
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="h-12 w-12 rounded-full bg-zinc-800 overflow-hidden border border-white/10 shrink-0">
              {finalUser?.avatarUrl ? (
                <img src={finalUser.avatarUrl} className="h-full w-full object-cover" alt="Profile" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/20"><Users size={20} /></div>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              {greeting}, {finalUser?.displayName || finalUser?.email?.split('@')[0]}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Column: Quick Actions */}
        <div className="lg:col-span-3 space-y-6">

          {/* Primary Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/studio/creator"
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 p-6 transition-all hover:border-[#B7FF00]/50 hover:bg-zinc-900"
            >
              <div className="mb-4">
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-[#B7FF00]/10 p-3 text-[#B7FF00]">
                  <Zap size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">Creator Studio</h3>
                <p className="mt-1 text-sm text-white/60">Create, Remix, and Share your AI creations.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#B7FF00] opacity-0 transition group-hover:opacity-100">
                Launch Tool <ArrowUpRight size={14} />
              </div>
            </Link>

            <Link
              href="/prompts"
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 p-6 transition-all hover:border-white/20 hover:bg-zinc-900"
            >
              <div className="mb-4">
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-white/5 p-3 text-white">
                  <LayoutGrid size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">Browse Templates</h3>
                <p className="mt-1 text-sm text-white/60">Explore curated templates and remix them.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                View Catalog <ArrowUpRight size={14} />
              </div>
            </Link>
          </div>

          {/* Secondary Actions Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/library" className="group flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/30 p-4 transition hover:bg-zinc-900 hover:border-white/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 group-hover:text-white transition">
                <Library size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">Library</div>
                <div className="text-xs text-white/50">Your generations</div>
              </div>
            </Link>

            <Link href="/settings" className="group flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/30 p-4 transition hover:bg-zinc-900 hover:border-white/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 group-hover:text-white transition">
                <Settings size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">Edit Profile</div>
                <div className="text-xs text-white/50">Update identity</div>
              </div>
            </Link>

            <button
              onClick={async () => {
                setManagingBilling(true);
                try {
                  const res = await fetch("/api/stripe/portal", { method: "POST" });
                  const data = await res.json();
                  if (data?.url) window.location.href = data.url;
                } catch (e) { console.error(e); }
                setManagingBilling(false);
              }}
              disabled={managingBilling}
              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/30 p-4 transition hover:bg-zinc-900 hover:border-white/20 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 group-hover:text-white transition">
                <CreditCard size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">Billing</div>
                <div className="text-xs text-white/50">{hasProAccess ? 'Pro Active' : 'Free Plan'}</div>
              </div>
            </button>
          </div>

          {/* Ambassador Program CTA */}
          {hasProAccess ? (
            <Link
              href="/ambassador"
              className="group relative flex items-center justify-between overflow-hidden rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 p-5 transition-all hover:border-purple-500/60 hover:from-purple-600/30 hover:to-pink-600/30"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20">
                  <Users size={22} />
                </div>
                <div>
                  <div className="font-bold text-white text-lg">Ambassador Program</div>
                  <div className="text-sm text-purple-200/70">Earn $10/mo for every member you refer</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-300 opacity-0 group-hover:opacity-100 transition">
                Join Now <ArrowUpRight size={16} />
              </div>
            </Link>
          ) : (
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-zinc-800/50 to-zinc-900/50 border border-white/10 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-white/40">
                  <Users size={22} />
                </div>
                <div>
                  <div className="font-bold text-white/80 text-lg">Want to Earn as an Ambassador?</div>
                  <div className="text-sm text-white/50">Upgrade to Pro to join the Ambassador Program and earn $10/mo per referral.</div>
                </div>
              </div>
              <Link
                href="/ambassador"
                className="w-full md:w-auto text-center shrink-0 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
              >
                <DollarSign size={16} className="inline mr-1" /> Start Earning
              </Link>
            </div>
          )}

          {/* Staff Section */}
          {isStaffPlus && (
            <div className="mt-8 rounded-xl border border-white/10 bg-zinc-900/20 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Shield size={16} className="text-[#B7FF00]" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">Administrative Tools ({role})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Link href="/dashboard/cms" className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/40 px-4 py-3 hover:bg-white/5 transition">
                  <FileText size={18} className="text-sky-400" />
                  <span className="text-sm font-medium text-white">CMS</span>
                </Link>
                {isEditorPlus && (
                  <Link href="/dashboard/review" className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/40 px-4 py-3 hover:bg-white/5 transition">
                    <Shield size={18} className="text-purple-400" />
                    <span className="text-sm font-medium text-white">Review Queue</span>
                  </Link>
                )}
                {isAdminPlus && (
                  <Link href="/dashboard/admin/users" className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/40 px-4 py-3 hover:bg-white/5 transition">
                    <Users size={18} className="text-orange-400" />
                    <span className="text-sm font-medium text-white">User Admin</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Status & Info */}
        <div className="space-y-6">
          {/* Upgrade Card */}
          {!hasProAccess && (
            <div className="rounded-xl bg-[#B7FF00] p-6 text-black">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-black/10">
                <Crown size={20} className="text-black" />
              </div>
              <h3 className="font-bold">Upgrade to Pro</h3>
              <p className="mt-1 text-sm text-black/70 font-medium">Unlock advanced features and premium templates.</p>
              <button
                onClick={() => router.push('/pricing')}
                className="mt-4 w-full rounded-lg bg-black py-2.5 text-sm font-bold text-white hover:bg-black/80 transition"
              >
                Get Pro Access
              </button>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-5">
            <h3 className="mb-4 text-xs font-mono uppercase tracking-widest text-white/40">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Version</span>
                <span className="font-mono text-white">v2.4.0</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Status</span>
                <span className="flex items-center gap-2 font-medium text-[#B7FF00]">
                  <span className="h-2 w-2 rounded-full bg-[#B7FF00]"></span>
                  Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
