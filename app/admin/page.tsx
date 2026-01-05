// app/admin/page.tsx
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function AdminOverviewPage() {
  const supabase = await createSupabaseServerClient();

  const { count: pendingCount } = await supabase
    .from("cms_prompt_queue")
    .select("*", { count: "exact", head: true });

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-sm text-white/60">Pending approvals</div>
      <div className="mt-1 text-3xl font-semibold">{pendingCount ?? 0}</div>

      <div className="mt-4 text-sm text-white/70">
        Editors and admins should review submitted prompts and publish or reject them.
      </div>
    </div>
  );
}
