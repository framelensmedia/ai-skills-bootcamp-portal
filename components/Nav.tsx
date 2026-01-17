"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useAuth } from "@/context/AuthProvider";
import { Menu } from "lucide-react";

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  const { user, session, initialized, signOut } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loggedIn = !!user;
  const loading = !initialized;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      if (!user) {
        setAvatarUrl(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_image")
        .eq("user_id", user.id)
        .maybeSingle();

      if (mounted && profile) {
        setAvatarUrl(profile.profile_image);
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [user, supabase]);

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
      active ? "text-white" : "text-white/80 hover:text-white",
    ].join(" ");
  };

  const links = [
    { href: "/", label: "Home" },
    { href: "/learn", label: "Learn" },
    { href: "/pricing", label: "Pricing" },
    { href: "/prompts", label: "Prompts" },
    { href: "/studio/creator", label: "Studio" },
    { href: "/library", label: "My Library" },
  ];

  if (loggedIn) {
    links.push({ href: "/feed", label: "Community" });
    links.push({ href: "/dashboard", label: "Dashboard" });
  }

  // Visual component for the avatar circle (no longer a link itself)
  const UserAvatar = () => (
    <div className="relative h-8 w-8 rounded-full bg-zinc-800 overflow-hidden border border-white/20 hover:border-[#B7FF00] transition cursor-pointer">
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
                className="outline-none focus:ring-2 focus:ring-[#B7FF00]/50 rounded-full"
              >
                <UserAvatar />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-zinc-900 shadow-xl z-50 overflow-hidden">
                    <Link
                      href="/settings"
                      className="block px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition border-b border-white/5"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Edit Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white transition"
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
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
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
          className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 h-9 w-9 text-white hover:bg-white/10 sm:hidden"
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
              <div className="relative rounded-2xl border border-white/10 bg-black/90 p-4 backdrop-blur">
                {/* X Close */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
                  aria-label="Close menu"
                >
                  ✕
                </button>

                <div className="pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
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
                          ? "border-lime-400/30 bg-lime-400/10 text-white"
                          : "border-white/10 bg-black/40 text-white/85 hover:bg-black/60 hover:text-white",
                      ].join(" ")}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>

                {/* Auth (mobile) */}
                <div className="mt-4 border-t border-white/10 pt-4">
                  {loading ? (
                    <div className="h-10 w-full animate-pulse rounded-xl border border-white/15 bg-white/5" />
                  ) : loggedIn ? (
                    <div className="flex items-center gap-4">
                      <Link href="/settings" className="flex items-center gap-3 flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 hover:bg-white/10">
                        <div className="h-8 w-8 rounded-full bg-zinc-800 overflow-hidden border border-white/10">
                          {avatarUrl ? <img src={avatarUrl} className="h-full w-full object-cover" /> : null}
                        </div>
                        <span className="text-sm font-semibold text-white">Edit Profile</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Log in
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
