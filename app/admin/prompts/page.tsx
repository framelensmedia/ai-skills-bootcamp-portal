// app/admin/prompts/page.tsx
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import PromptsTable from "./PromptsTable";

export default async function AdminPromptsPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("prompts")
    .select("id, title, slug, status, created_at, featured_image_url, preview_image_storage_path")
    .eq("is_published", false)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Drafts & Queue</div>
        <a
          href="/admin/prompts/import"
          className="rounded-xl bg-[#B7FF00] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Import Template
        </a>
      </div>

      <PromptsTable prompts={data ?? []} />
    </div>
  );
}
