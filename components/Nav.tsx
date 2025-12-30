"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  // Create the browser Supabase client once
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1) Initial session check
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

    // 2) Live updates when auth changes (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkClass = (href: string) => {
    const active = pathname === href;
    return [
      "text-sm font-medium transition-colors",
      active ? "text-white" : "text-white/80 hover:text-white",
    ].join(" ");
  };

  return (
    <div className="w-full">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-end gap-4 px-4 py-3 sm:gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className={linkClass("/")}>
            Home
          </Link>

          <Link href="/pricing" className={linkClass("/pricing")}>
            Pricing
          </Link>

          <Link href="/prompts" className={linkClass("/prompts")}>
            Prompts
          </Link>

          <Link href="/community" className={linkClass("/community")}>
            Community
          </Link>

          {loggedIn && (
            <Link href="/dashboard" className={linkClass("/dashboard")}>
              Dashboard
            </Link>
          )}
        </div>

        {/* Right side auth button */}
        <div className="ml-2">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg border border-white/15 bg-white/5" />
          ) : loggedIn ? (
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
