// components/GenerationLightbox.tsx
"use client";

import Image from "next/image";

function downloadUrl(url: string, filename = "remix.png") {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    // no-op
  }
}

function safeFilenameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "remix.png";
    return last.includes(".") ? last : `${last}.png`;
  } catch {
    return "remix.png";
  }
}

async function copyToClipboard(text: string) {
  const t = (text || "").trim();
  if (!t.length) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    // no-op
  }
}

type Props = {
  open: boolean;
  url: string | null;
  promptText?: string;
  onClose: () => void;

  // optional hooks
  onRemix?: (promptText: string, url: string) => void;
  onShare?: (url: string) => void;
};

export default function GenerationLightbox({
  open,
  url,
  promptText = "",
  onClose,
  onRemix,
  onShare,
}: Props) {
  if (!open || !url) return null;

  const hasPrompt = (promptText || "").trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2 border-b border-white/10 bg-black/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-white/80">Preview</div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Always show Download */}
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
              onClick={() => downloadUrl(url, safeFilenameFromUrl(url))}
            >
              Download
            </button>

            {/* Always show Copy, but disable if no prompt */}
            <button
              type="button"
              disabled={!hasPrompt}
              className={[
                "rounded-xl border px-3 py-2 text-xs",
                hasPrompt
                  ? "border-white/15 bg-black/40 text-white/80 hover:bg-black/60"
                  : "cursor-not-allowed border-white/10 bg-black/20 text-white/30",
              ].join(" ")}
              onClick={() => copyToClipboard(promptText)}
              title={hasPrompt ? "Copy prompt used to generate" : "No prompt text saved for this item yet"}
            >
              Copy
            </button>

            {/* Always show Remix, but disable if no prompt */}
            <button
              type="button"
              disabled={!hasPrompt || !onRemix}
              className={[
                "rounded-xl border px-3 py-2 text-xs",
                hasPrompt && onRemix
                  ? "border-white/15 bg-black/40 text-white/80 hover:bg-black/60"
                  : "cursor-not-allowed border-white/10 bg-black/20 text-white/30",
              ].join(" ")}
              onClick={() => {
                if (!hasPrompt || !onRemix) return;
                onRemix(promptText, url);
              }}
              title={hasPrompt ? "Open in Studio with this prompt" : "No prompt text saved for this item yet"}
            >
              Remix
            </button>

            {/* Always show Share (UI only for now) */}
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
              onClick={() => onShare?.(url)}
            >
              Share
            </button>

            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="relative h-[80vh] w-full bg-black">
          <Image src={url} alt="Full screen preview" fill className="object-contain" priority />
        </div>
      </div>
    </div>
  );
}
