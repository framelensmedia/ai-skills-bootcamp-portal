// app/admin/prompts/page.tsx
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function AdminPromptsPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("cms_prompt_queue")
    .select("id, title, slug, status, created_at, submitted_at, author_id")
    .order("submitted_at", { ascending: false })
    .limit(50);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="mb-4 text-lg font-semibold">Prompt Queue</div>

      <div className="grid gap-3">
        {(data ?? []).map((p) => (
          <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{p.title}</div>
                <div className="text-xs text-white/50">/{p.slug}</div>
              </div>
              <div className="text-xs text-white/60">{p.status}</div>
            </div>

            <div className="mt-3 text-xs text-white/50">
              Submitted: {p.submitted_at ? new Date(p.submitted_at).toLocaleString() : "n/a"}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-black/45"
                href={`/prompts/${p.slug}`}
              >
                View
              </a>

              {/* Next step: wire Approve/Reject with server actions or API routes */}
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                Approve/Reject buttons next
              </span>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 ? (
          <div className="text-sm text-white/60">No submitted prompts right now.</div>
        ) : null}
      </div>
    </div>
  );
}
