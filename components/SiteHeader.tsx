"use client";

import Link from "next/link";
import { useState } from "react";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#B7FF00] text-black font-black">
            ⚡
          </span>
          <span className="text-sm font-semibold tracking-wide text-white">
            AI SKILLS BOOTCAMP
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm text-white/80 hover:text-white">
            Explore
          </Link>
          <Link href="/prompts" className="text-sm text-white/80 hover:text-white">
            Resources
          </Link>
          <Link href="/community" className="text-sm text-white/80 hover:text-white">
            Community
          </Link>
          <Link href="/login" className="text-sm text-white/80 hover:text-white">
            Log in
          </Link>

          <Link
            href="/pricing"
            className="rounded-md bg-[#B7FF00] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
          >
            Get Started
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white md:hidden"
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-white/10 bg-black/90 md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex flex-col gap-3">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="text-sm text-white/80 hover:text-white"
              >
                Explore
              </Link>
              <Link
                href="/prompts"
                onClick={() => setOpen(false)}
                className="text-sm text-white/80 hover:text-white"
              >
                Resources
              </Link>
              <Link
                href="/community"
                onClick={() => setOpen(false)}
                className="text-sm text-white/80 hover:text-white"
              >
                Community
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-sm text-white/80 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/pricing"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex justify-center rounded-md bg-[#B7FF00] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
