"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Download, Sparkles, Share2, X, Copy, Check, Loader2, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

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

  title?: string;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  fullQualityUrl?: string | null;
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
  title = "Untitled",
  onRename,
  onDelete,
  fullQualityUrl,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [copiedCombined, setCopiedCombined] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);

  // Update tempTitle when prop changes
  useMemo(() => setTempTitle(title), [title]);

  const safeUrl = useMemo(() => normalize(url), [url]);
  const canShow = open && safeUrl.length > 0;

  const o = normalize(originalPromptText);
  const r = normalize(remixPromptText);
  const c = normalize(combinedPromptText);

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const downloadUrl = fullQualityUrl || safeUrl;
    if (!downloadUrl || downloading) return;

    setDownloading(true);
    setDownloadError(null);

    try {
      await downloadImageToDevice(downloadUrl);
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

  // Full Screen Overlay
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black animate-in fade-in duration-200">
        <div className="relative h-full w-full" onClick={() => setIsFullScreen(false)}>
          <Image src={safeUrl} alt="Full Screen" fill className="object-contain cursor-zoom-out" priority unoptimized />
        </div>
        <button
          onClick={() => setIsFullScreen(false)}
          className="absolute top-4 right-4 z-[210] rounded-full bg-black/40 p-2 text-white/60 backdrop-blur-md hover:bg-white/20 hover:text-white transition-all"
          title="Close Full Screen"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[95dvh] w-full max-w-5xl flex-col bg-black md:max-h-[90vh] md:rounded-3xl md:border md:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header ... */}
        {/* ... */}

        {/* ... (inside header or content) ... */}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden md:grid md:grid-cols-2 md:overflow-hidden">
          {/* Image Column */}
          <div className="relative min-h-[50vh] w-full bg-black md:h-full md:border-r md:border-white/10">
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(to_bottom,transparent,black)]">
              <div
                className="relative h-full w-full cursor-zoom-in transition-transform hover:scale-[1.01] active:scale-[0.99]"
                onClick={() => setIsFullScreen(true)}
              >
                <Image src={safeUrl} alt="Preview" fill className="object-contain drop-shadow-2xl" priority />
              </div>
            </div>
          </div>

          {/* Prompt Column (Scrolls on Desktop, stacks on mobile) */}
          {/* Prompt Column */}
          <div className="flex flex-col gap-6 p-6 md:h-full md:overflow-y-auto bg-black/40">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/[0.07]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white">1</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">Prompt</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCombined}
                    className="text-white/40 hover:text-white transition-colors"
                    title="Copy"
                  >
                    {copiedCombined ? <Check className="w-5 h-5 text-lime-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="relative">
                <div
                  className={`whitespace-pre-wrap text-sm leading-relaxed text-white/90 font-mono opacity-80 overflow-hidden transition-all duration-300 ${isExpanded ? '' : 'max-h-[150px] mask-linear-fade-bottom'}`}
                >
                  {(c || o) || <span className="text-white/30 italic">Waiting for generation...</span>}
                </div>

                {/* Accordion Toggle */}
                {(c || o || "").length > 150 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors w-full justify-center pt-2 border-t border-white/5"
                  >
                    {isExpanded ? (
                      <>
                        Show less <ChevronUp className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
