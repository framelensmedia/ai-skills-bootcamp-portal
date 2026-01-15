import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#B7FF00] text-black font-black">
                ⚡
              </span>
              <span className="text-sm font-semibold tracking-wide text-white">
                AI SKILLS STUDIO
              </span>
            </div>
            <p className="mt-3 text-sm text-white/60">
              Learn practical AI skills that help you create, market, and earn.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Platform
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/pricing" className="text-white/60 hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-white/60 hover:text-white">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/prompts" className="text-white/60 hover:text-white">
                  Prompts
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Resources
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/prompts" className="text-white/60 hover:text-white">
                  Library
                </Link>
              </li>
              <li>
                <Link href="/community" className="text-white/60 hover:text-white">
                  Community
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Contact
            </p>
            <p className="mt-3 text-sm text-white/60">
              support@aiskills.studio
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} AI Skills Studio</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
