// app/admin/_components/AdminGuard.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer"; // you likely have this; if not, tell me and I’ll drop it in

export default async function AdminGuard({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) redirect("/login?redirectTo=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, staff_approved")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = String(profile?.role || "user").toLowerCase();
  const isAdmin = role === "admin" || role === "super_admin";

  if (!isAdmin) redirect("/dashboard");

  return <>{children}</>;
}
