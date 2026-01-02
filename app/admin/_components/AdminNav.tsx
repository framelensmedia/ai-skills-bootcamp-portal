// app/admin/_components/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav() {
  const pathname = usePathname();

  const link = (href: string) => {
    const active = pathname === href;
    return [
      "rounded-lg border px-3 py-2 text-sm font-semibold transition",
      active
        ? "border-lime-400/40 bg-lime-400/10 text-white"
        : "border-white/10 bg-black/20 text-white/80 hover:bg-black/35 hover:text-white",
    ].join(" ");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Link className={link("/admin")} href="/admin">
        Overview
      </Link>
      <Link className={link("/admin/prompts")} href="/admin/prompts">
        Prompt Queue
      </Link>
      <Link className={link("/admin/users")} href="/admin/users">
        Users and Roles
      </Link>
      <Link className={link("/admin/instructors")} href="/admin/instructors">
        Instructors
      </Link>
    </div>
  );
}
