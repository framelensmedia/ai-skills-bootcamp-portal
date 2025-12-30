"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function CommunityPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email ?? "");
      setLoading(false);
    };

    run();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        Loading community…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white">Community</h1>
        <p className="mt-2 text-sm md:text-base text-white/70">
          Placeholder page. This will be the paid community hub.
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-5">
          <p className="text-sm text-white/70">
            Logged in as <span className="font-medium text-white">{email}</span>
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-semibold text-white">Announcements</h2>
            <p className="mt-1 text-sm text-white/70">
              Updates, drops, and weekly challenges.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-semibold text-white">Discussions</h2>
            <p className="mt-1 text-sm text-white/70">
              Threads, Q&A, wins, and help.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-semibold text-white">Office Hours</h2>
            <p className="mt-1 text-sm text-white/70">
              Live calls, replays, and hot seats.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-5">
          <h3 className="text-base font-semibold text-white">Coming next</h3>
          <ul className="mt-2 space-y-2 text-sm text-white/70">
            <li>• Post composer</li>
            <li>• Threads and replies</li>
            <li>• Premium-only access rules</li>
            <li>• Notifications</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
