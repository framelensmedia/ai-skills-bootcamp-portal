"use client";

import Link from "next/link";
import Image from "next/image";
import Nav from "@/components/Nav";

export default function SiteHeader() {
  return (
    <header className="w-full border-b border-white/10 bg-black/50 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3"
          aria-label="AI Skills Bootcamp Home"
        >
          {/* Icon / mark */}
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src="/logo.png"
              alt="AI Skills Bootcamp"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Text: keep on ONE line */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-lg font-extrabold tracking-tight text-[#B7FF00]">
                AI Skills
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white">
                Bootcamp
              </span>
            </div>

            {/* Optional tagline (won't affect the logo line) */}
            {/* <div className="truncate text-xs text-white/55">Learn. Build. Profit.</div> */}
          </div>
        </Link>

        {/* Nav (links + auth + mobile menu) */}
        <div className="min-w-0">
          <Nav />
        </div>
      </div>
    </header>
  );
}
