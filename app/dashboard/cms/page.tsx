"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Loading from "@/components/Loading";
import {
  GraduationCap, FileText, Star, MessageSquare, Users, Settings,
  Plus, ArrowRight, BookOpen, Sparkles, TrendingUp, Clock, CheckCircle,
  LayoutDashboard, Upload, Shield, Newspaper, FolderOpen,
  LucideIcon
} from "lucide-react";

type ProfileRow = { role: string };

type ContentType = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
  minRole: string;
  stats: { table: string; label: string };
  quickActions?: { label: string; href: string }[];
  comingSoon?: boolean;
};

function roleRank(role: string) {
  const r = String(role || "user").toLowerCase();
  const order = ["user", "staff", "instructor", "editor", "admin", "super_admin"];
  const idx = order.indexOf(r);
  return idx === -1 ? 0 : idx;
}

// Content type definitions - add new content types here
const CONTENT_TYPES: ContentType[] = [
  {
    id: "bootcamps",
    title: "Bootcamps",
    description: "Manage learning bootcamps and lessons",
    icon: GraduationCap,
    href: "/dashboard/cms/bootcamps",
    color: "#B7FF00",
    minRole: "staff",
    stats: { table: "bootcamps", label: "bootcamps" },
    quickActions: [
      { label: "New Bootcamp", href: "/dashboard/cms/bootcamps/new" },
    ],
  },
  {
    id: "prompts",
    title: "Prompts",
    description: "Create and manage prompt templates",
    icon: Sparkles,
    href: "/dashboard/cms/prompts",
    color: "#FF6B6B",
    minRole: "staff",
    stats: { table: "prompts", label: "prompts" },
    quickActions: [
      { label: "New Prompt", href: "/dashboard/cms/prompts?action=new" },
      { label: "Import Template", href: "/admin/prompts/import" },
    ],
  },
  {
    id: "blog",
    title: "Blog & News",
    description: "Manage news, updates, and articles",
    icon: Newspaper,
    href: "/dashboard/cms/blog",
    color: "#FFD93D",
    minRole: "editor",
    stats: { table: "blog_posts", label: "posts" },
    quickActions: [
      { label: "New Post", href: "/dashboard/cms/blog/new" },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    description: "Manage downloadable resources and files",
    icon: FolderOpen,
    href: "/dashboard/cms/resources",
    color: "#6BCB77",
    minRole: "editor",
    stats: { table: "resources", label: "files" },
    quickActions: [
      { label: "Upload File", href: "/dashboard/cms/resources/new" },
    ],
  },
  {
    id: "instructors",
    title: "Instructors",
    description: "Manage instructor profiles and bios",
    icon: Users,
    href: "/admin/instructors",
    color: "#4D96FF",
    minRole: "admin",
    stats: { table: "instructors", label: "instructors" },
  },
];

export default function CMSDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("user");
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    async function boot() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      // Get role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setRole(String((profile as ProfileRow).role || "user"));
      }

      // Fetch stats for each content type
      const statPromises = CONTENT_TYPES.map(async (ct) => {
        if (ct.comingSoon) return { id: ct.id, count: 0 };
        try {
          const { count } = await supabase
            .from(ct.stats.table)
            .select("*", { count: "exact", head: true });
          return { id: ct.id, count: count || 0 };
        } catch {
          return { id: ct.id, count: 0 };
        }
      });

      const results = await Promise.all(statPromises);
      const statsMap: Record<string, number> = {};
      results.forEach((r) => (statsMap[r.id] = r.count));
      setStats(statsMap);

      setLoading(false);
    }

    boot();
  }, [router, supabase]);

  const isStaffPlus = roleRank(role) >= roleRank("staff");

  if (loading) return <Loading />;

  if (!isStaffPlus) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-white/5 p-4">
          <Shield size={32} className="text-white/20" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-white/50">You do not have permission to view the CMS.</p>
        <Link href="/dashboard" className="text-sm font-medium text-[#B7FF00] hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Filter content types by role
  const visibleContentTypes = CONTENT_TYPES.filter(
    (ct) => roleRank(role) >= roleRank(ct.minRole)
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white font-sans">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B7FF00] mb-1">
            <LayoutDashboard size={14} />
            Content Management System
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            CMS Dashboard
          </h1>
          <p className="text-white/60 mt-1">
            Manage all content across your platform
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-white/10 text-white/60">
            Role: <span className="text-white font-medium capitalize">{role}</span>
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Bootcamps", value: stats.bootcamps || 0, icon: GraduationCap, color: "#B7FF00" },
          { label: "Prompts", value: stats.prompts || 0, icon: Sparkles, color: "#FF6B6B" },
          { label: "Posts", value: stats.blog || 0, icon: Newspaper, color: "#FFD93D" },
          { label: "Resources", value: stats.resources || 0, icon: FolderOpen, color: "#6BCB77" },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${stat.color}20` }}
            >
              <stat.icon size={24} style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Types Grid */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BookOpen size={20} />
          Content Types
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleContentTypes.map((ct) => {
          const IconComponent = ct.icon;
          const isDisabled = ct.comingSoon;

          return (
            <div
              key={ct.id}
              className={`group relative rounded-2xl border bg-zinc-900/50 overflow-hidden transition-all ${isDisabled
                ? "border-white/5 opacity-60"
                : "border-white/10 hover:border-white/20 hover:bg-zinc-900"
                }`}
            >
              {/* Coming Soon Badge */}
              {isDisabled && (
                <div className="absolute top-4 right-4 px-2 py-1 rounded text-xs font-medium bg-white/10 text-white/50">
                  Coming Soon
                </div>
              )}

              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${ct.color}15` }}
                  >
                    <IconComponent size={28} style={{ color: ct.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-1">{ct.title}</h3>
                    <p className="text-sm text-white/50 line-clamp-2">{ct.description}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <span className="text-white/40">
                    <span className="text-white font-semibold">{stats[ct.id] || 0}</span> {ct.stats.label}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4">
                {isDisabled ? (
                  <span className="text-sm text-white/30">Not available yet</span>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {ct.quickActions?.map((action, i) => (
                        <Link
                          key={i}
                          href={action.href}
                          className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition"
                        >
                          <Plus size={14} />
                          {action.label}
                        </Link>
                      ))}
                    </div>
                    <Link
                      href={ct.href}
                      className="flex items-center gap-1 text-sm font-medium hover:text-[#B7FF00] transition"
                      style={{ color: ct.color }}
                    >
                      Manage
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity (Placeholder) */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Recent Activity
        </h2>
        <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-8 text-center text-white/40">
          <Clock size={32} className="mx-auto mb-3 opacity-50" />
          <p>Activity feed coming soon</p>
          <p className="text-sm mt-1">Track content changes and publishing history</p>
        </div>
      </div>
    </main>
  );
}
