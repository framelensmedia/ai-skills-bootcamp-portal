"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useAuth } from "@/context/AuthProvider";
import { Menu, Coins } from "lucide-react";
import GamificationStatus from "./GamificationStatus";


export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  const { user, session, initialized, signOut } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loggedIn = !!user;
  const loading = !initialized;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      if (!user) {
        setAvatarUrl(null);
        setCredits(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_image, credits, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (mounted && profile) {
        setAvatarUrl(profile.profile_image);
        setCredits(profile.credits ?? 0);
        setIsAdmin(profile.role === "admin" || profile.role === "super_admin");
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [user, supabase, pathname]); // Refresh on navigation

  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setDropdownOpen(false);
      }
    }
    if (mobileOpen || dropdownOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, dropdownOpen]);

  async function handleLogout() {
    await signOut();
    setMobileOpen(false);
    setDropdownOpen(false);
    router.push("/login");
  }

  const linkClass = (href: string) => {
    const active = pathname === href;
    return [
      "text-sm font-medium transition-colors whitespace-nowrap",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    ].join(" ");
  };

  const links = [
    { href: "/learn", label: "Learn" },
    { href: "/studio/creator", label: "Studio" },
    { href: "/prompts", label: "Prompts" },
    { href: "/library", label: "My Library" },
    { href: "/pricing", label: "Pricing" },
  ];

  if (loggedIn) {
    links.push({ href: "/feed", label: "Community" });
    links.push({ href: "/dashboard", label: "Dashboard" });
  }

  // Visual component for the avatar circle (no longer a link itself)
  const UserAvatar = () => (
    <div className="relative h-8 w-8 rounded-full bg-muted overflow-hidden border border-border hover:border-[#B7FF00] transition cursor-pointer">
      {avatarUrl ? (
        <img src={avatarUrl} alt="User" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/50"><div className="h-4 w-4 rounded-full bg-white/20" /></div>
      )}
    </div>
  );

  return (
    <div className="relative">
      <nav className="flex items-center justify-end gap-3">
        {/* Desktop links */}
        <div className="hidden items-center gap-5 sm:flex">

          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Auth button (desktop) */}
        {loading ? (
          <div className="hidden h-9 w-24 animate-pulse rounded-lg border border-white/15 bg-white/5 sm:block" />
        ) : loggedIn ? (
          <div className="hidden sm:flex items-center relative gap-4 top-[1px]">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 outline-none focus:ring-2 focus:ring-[#B7FF00]/50 rounded-full pr-1"
              >
                <div className="hidden md:block">
                  <GamificationStatus />
                </div>
                {credits !== null && (
                  <div className="hidden md:flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-1 text-xs font-semibold text-primary">
                    <Coins size={12} />
                    <span>{isAdmin ? "∞" : credits}</span>
                  </div>
                )}
                <UserAvatar />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden">
                    <Link
                      href="/settings"
                      className="block px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition border-b border-border"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Edit Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition"
                    >
                      Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
            >
              Sign Up
            </Link>
          </div>
        )}

        {/* Mobile toggle */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary h-9 w-9 text-foreground hover:bg-accent sm:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen ? "true" : "false"}
        >
          <Menu size={20} />
        </button>
      </nav>

      {/* Mobile menu overlay + dropdown */}
      {mobileOpen ? (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50 sm:hidden"
            aria-label="Close menu backdrop"
            onClick={() => setMobileOpen(false)}
          />


          {/* Dropdown panel */}
          <div className="fixed inset-x-0 top-[73px] z-[70] sm:hidden">
            <div className="mx-auto w-full max-w-6xl px-4">
              <div className="relative rounded-2xl border border-border bg-popover p-4 shadow-2xl backdrop-blur-sm max-h-[80vh] overflow-y-auto">
                {/* X Close */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary text-foreground hover:bg-accent"
                  aria-label="Close menu"
                >
                  ✕
                </button>

                <div className="absolute left-4 top-4">

                </div>

                <div className="pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Menu
                  </div>
                </div>

                {/* Links */}
                <div className="mt-4 flex flex-col gap-2">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={[
                        "rounded-xl border px-4 py-3 text-sm font-medium transition",
                        pathname === l.href
                          ? "border-primary/30 bg-primary/10 text-primary-foreground"
                          : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                      ].join(" ")}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>

                {/* Auth (mobile) */}
                <div className="mt-4 border-t border-border pt-4">
                  {loading ? (
                    <div className="h-10 w-full animate-pulse rounded-xl border border-border bg-secondary" />
                  ) : loggedIn ? (
                    <div className="flex items-center gap-4">
                      <Link href="/settings" className="flex items-center gap-3 flex-1 rounded-xl border border-border bg-secondary px-4 py-3 hover:bg-accent">
                        <div className="h-8 w-8 rounded-full bg-muted overflow-hidden border border-border">
                          {avatarUrl ? <img src={avatarUrl} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">Edit Profile</span>
                          {credits !== null && <span className="text-xs text-primary font-mono">{isAdmin ? "∞" : credits} Credits</span>}
                        </div>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/login"
                        className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/signup"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300"
                      >
                        Sign Up
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null
      }
    </div >
  );
}
