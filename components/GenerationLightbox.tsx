"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  url: string | null;
  onClose: () => void;

  // Standardized prompt fields (final stored text)
  originalPromptText?: string | null;
  remixPromptText?: string | null;
  combinedPromptText?: string | null;

  onShare?: (url: string) => void;

  onRemix?: (payload: {
    imgUrl: string;
    originalPromptText: string;
    remixPromptText: string;
    combinedPromptText: string;
  }) => void;
};

function normalize(v: any) {
  return String(v ?? "").trim();
}

function safeFilenameFromUrl(url: string, fallbackBase = "generation") {
  try {
    const u = new URL(url);
    const last = (u.pathname.split("/").pop() || "").trim();
    if (last && last.includes(".")) return last;
  } catch {
    // ignore
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${fallbackBase}-${ts}.png`;
}

async function downloadImageToDevice(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const filename = safeFilenameFromUrl(url);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function copyToClipboard(text: string) {
  const t = normalize(text);
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    // no-op
  }
}

export default function GenerationLightbox({
  open,
  url,
  onClose,
  originalPromptText,
  remixPromptText,
  combinedPromptText,
  onShare,
  onRemix,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [copiedCombined, setCopiedCombined] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);

  const safeUrl = useMemo(() => normalize(url), [url]);
  const canShow = open && safeUrl.length > 0;

  const o = normalize(originalPromptText);
  const r = normalize(remixPromptText);
  const c = normalize(combinedPromptText);

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!safeUrl || downloading) return;

    setDownloading(true);
    setDownloadError(null);

    try {
      await downloadImageToDevice(safeUrl);
    } catch (err: any) {
      setDownloadError(
        err?.message || "Download failed. This is often caused by the image host blocking downloads (CORS)."
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyCombined(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await copyToClipboard(c || o);
    setCopiedCombined(true);
    setTimeout(() => setCopiedCombined(false), 1200);
  }

  async function handleCopyOriginal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await copyToClipboard(o);
    setCopiedOriginal(true);
    setTimeout(() => setCopiedOriginal(false), 1200);
  }

  function handleRemix(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!onRemix || !safeUrl) return;

    onRemix({
      imgUrl: safeUrl,
      originalPromptText: o,
      remixPromptText: r,
      combinedPromptText: c || [o, r].filter(Boolean).join("\n\n"),
    });
  }

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!onShare || !safeUrl) return;
    onShare(safeUrl);
  }

  if (!canShow) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-white/10 bg-black/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-white/80">Preview</div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className={[
                "rounded-xl border px-3 py-2 text-xs text-white/85",
                downloading
                  ? "cursor-not-allowed border-white/10 bg-black/20 text-white/40"
                  : "border-white/15 bg-black/40 hover:bg-black/60",
              ].join(" ")}
              disabled={downloading}
            >
              {downloading ? "Downloading..." : "Download"}
            </button>

            <button
              type="button"
              onClick={handleCopyCombined}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/85 hover:bg-black/60"
              title="Copy combined prompt"
            >
              {copiedCombined ? "Copied" : "Copy"}
            </button>

            <button
              type="button"
              onClick={handleRemix}
              className={[
                "rounded-xl border px-3 py-2 text-xs text-white/85",
                onRemix ? "border-white/15 bg-black/40 hover:bg-black/60" : "cursor-not-allowed border-white/10 bg-black/20 text-white/40",
              ].join(" ")}
              disabled={!onRemix}
            >
              Remix
            </button>

            <button
              type="button"
              onClick={handleShare}
              className={[
                "rounded-xl border px-3 py-2 text-xs text-white/85",
                onShare ? "border-white/15 bg-black/40 hover:bg-black/60" : "cursor-not-allowed border-white/10 bg-black/20 text-white/40",
              ].join(" ")}
              disabled={!onShare}
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

        {downloadError ? (
          <div className="border-b border-white/10 bg-red-950/30 px-4 py-3 text-xs text-red-200">
            {downloadError}
          </div>
        ) : null}

        {/* Content */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
          {/* Image */}
          <div className="relative h-[55vh] w-full bg-black md:h-[80vh]">
            <Image src={safeUrl} alt="Full screen preview" fill className="object-contain" priority />
          </div>

          {/* Prompt meta */}
          <div className="h-[35vh] overflow-auto border-t border-white/10 bg-black/40 p-4 md:h-[80vh] md:border-l md:border-t-0">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white/80">Original prompt</div>
                  <button
                    type="button"
                    onClick={handleCopyOriginal}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/60"
                    disabled={!o}
                  >
                    {copiedOriginal ? "Copied" : "Copy original"}
                  </button>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-white/75">
                  {o || "Not saved yet for this generation."}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-semibold text-white/80">Remix prompt</div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-white/75">
                  {r || "None"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white/80">Combined prompt</div>
                  <div className="text-xs text-white/45">Copy copies this</div>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-white/75">
                  {c || "Nothing saved yet."}
                </div>
              </div>

              <div className="text-xs text-white/40">
                Tip: Older generations may not have these fields yet. New generations will always save them to the DB.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
