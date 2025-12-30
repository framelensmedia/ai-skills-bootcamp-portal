"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function DashboardPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", user.id)
        .single();

      if (profile?.plan) {
        setPlan(profile.plan);
      }

      setLoading(false);
    };

    loadUser();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Dashboard Header */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 md:p-8 mb-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Dashboard
          </h1>

          <p className="text-sm md:text-base text-white/70">
            Logged in as{" "}
            <span className="font-medium text-white">
              {user.email}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2 text-sm md:text-base text-white/70">
            <span>
              Plan:{" "}
              <span className="font-semibold text-white">
                {plan}
              </span>
            </span>

            {plan !== "free" && (
              <>
                <span className="text-white/40">•</span>

                <button
                  onClick={async () => {
                    const res = await fetch("/api/stripe/portal", {
                      method: "POST",
                    });
                    const data = await res.json();
                    if (data?.url) {
                      window.open(data.url, "_blank", "noopener,noreferrer");

                    }
                  }}
                  className="font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                >
                  Manage billing
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Prompts
          </h2>
          <p className="text-sm text-white/70">
            Browse free and premium prompts.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Courses
          </h2>
          <p className="text-sm text-white/70">
            Self-paced modules inside Premium.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Community
          </h2>
          <p className="text-sm text-white/70">
            Private member area inside Premium.
          </p>
        </div>
      </div>
    </div>
  );
}
