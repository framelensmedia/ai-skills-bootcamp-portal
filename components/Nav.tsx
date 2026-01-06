"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setLoggedIn(!!data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoggedIn(false);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    if (mobileOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push("/login");
    router.refresh();
  }

  const linkClass = (href: string) => {
    const active = pathname === href;
    return [
      "text-sm font-medium transition-colors whitespace-nowrap",
      active ? "text-white" : "text-white/80 hover:text-white",
    ].join(" ");
  };

  // Final nav links (per your update)
  const links = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/prompts", label: "Prompts" },
    { href: "/studio", label: "Studio" },
    { href: "/library", label: "My Library" },
  ];

  if (loggedIn) links.push({ href: "/dashboard", label: "Dashboard" });

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
          <button
            onClick={handleLogout}
            className="hidden rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:inline-flex"
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            className="hidden rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:inline-flex"
          >
            Log in
          </Link>
        )}

        {/* Mobile toggle */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen ? "true" : "false"}
        >
          Menu
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
              <div className="relative rounded-2xl border border-white/10 bg-black p-4 shadow-2xl backdrop-blur-sm">
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
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Logout
                    </button>
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
