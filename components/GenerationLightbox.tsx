"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useRef } from "react";
import { Download, Sparkles, Share2, X, Copy, Check, Loader2, ChevronDown, ChevronUp, Pencil, Trash2, Film, Play, Pause, Volume2, VolumeX, Maximize, ExternalLink } from "lucide-react";
import { cleanPrompt } from "@/lib/stringUtils";

type Props = {
  open: boolean;
  url: string | null;
  videoUrl?: string | null;
  mediaType?: "image" | "video";
  onClose: () => void;

  // Standardized prompt fields (final stored text)
  originalPromptText?: string | null;
  remixPromptText?: string | null;
  combinedPromptText?: string | null;

  id?: string;
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
  onEdit?: () => void;
  onAnimate?: () => void;
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
  const filename = safeFilenameFromUrl(url);

  // Try Web Share API Level 2 (Mobile "Save to Photos" support)
  // We explicitly check for mobile UA because some desktop browsers support share
  // but we want to force direct download for desktop users.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile && typeof navigator !== "undefined" && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return;
      } catch (err: any) {
        // If user aborted, just return. If real error, fall through to anchor download.
        if (err.name === 'AbortError') return;
        console.warn("Share API failed, falling back to download:", err);
      }
    }
  }

  // Fallback: Anchor tag download
  const objectUrl = URL.createObjectURL(blob);

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
  videoUrl,
  mediaType = "image",
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
  onEdit,
  onAnimate,
  id
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

  // Video controls
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Update tempTitle when prop changes
  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  const safeUrl = useMemo(() => normalize(url), [url]);
  const safeVideoUrl = useMemo(() => normalize(videoUrl), [videoUrl]);
  const isVideo = mediaType === "video" && safeVideoUrl.length > 0;
  const canShow = open && (safeUrl.length > 0 || safeVideoUrl.length > 0);

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
        <div className="relative h-full w-full flex items-center justify-center" onClick={() => setIsFullScreen(false)}>
          {isVideo ? (
            <video
              src={safeVideoUrl}
              className="max-h-full max-w-full object-contain cursor-pointer"
              autoPlay
              loop
              playsInline
              controls
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Image src={safeUrl} alt="Full Screen" fill className="object-contain cursor-zoom-out" priority unoptimized />
          )}
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
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
          {/* Title Area */}
          <div className="flex-1 mr-4 min-w-0 flex items-center gap-2">
            {isEditingTitle && onRename ? (
              <div className="flex items-center gap-2 w-full max-w-xs">
                <input
                  className="w-full rounded border border-white/20 bg-black/50 px-2 py-1 text-sm text-white focus:outline-none"
                  value={tempTitle}
                  onChange={e => setTempTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      onRename(tempTitle);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                />
                <button onClick={() => { onRename(tempTitle); setIsEditingTitle(false); }} className="text-lime-400"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setIsEditingTitle(false); setTempTitle(title); }} className="text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="text-sm font-bold text-white truncate max-w-[150px] md:max-w-md" title={title}>
                  {title}
                </div>
                {onRename && (
                  <button onClick={() => { setTempTitle(title); setIsEditingTitle(true); }} className="text-white/20 hover:text-white p-1">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mobile-friendly horizontal scroll for actions if needed, or just flex-wrap */}
          <div className="flex shrink-0 items-center justify-between gap-2 md:w-auto md:justify-end">
            <div className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
              <button
                type="button"
                onClick={handleDownload}
                className={[
                  "flex shrink-0 items-center justify-center gap-2 rounded-full border p-2 md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider text-white",
                  downloading
                    ? "cursor-not-allowed border-white/5 bg-white/5 text-white/40"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20",
                ].join(" ")}
                disabled={downloading}
                title="Download"
              >
                {downloading ? (
                  <span className="animate-spin">
                    <Loader2 className="w-4 h-4" />
                  </span>
                ) : (
                  <>
                    <span className="hidden md:block">Download</span>
                    <Download className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRemix}
                className={[
                  "flex shrink-0 items-center justify-center gap-2 rounded-full border p-2 md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider text-white",
                  onRemix ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20" : "cursor-not-allowed border-white/5 bg-white/5 text-white/40",
                ].join(" ")}
                disabled={!onRemix}
                title="Remix"
              >
                <span className="hidden md:block">Remix</span>
                <Sparkles className="w-4 h-4" />
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 p-2 md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 hover:border-white/20"
                  title="Edit"
                >
                  <span className="hidden md:block">Edit</span>
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {onAnimate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAnimate();
                  }}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 p-2 md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider text-indigo-200 hover:bg-indigo-500/20 hover:border-indigo-500/40"
                  title="Animate"
                >
                  <span className="hidden md:block">Animate</span>
                  <Film className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleShare}
                className={[
                  "flex shrink-0 items-center justify-center gap-2 rounded-full border p-2 md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider text-white",
                  onShare ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20" : "cursor-not-allowed border-white/5 bg-white/5 text-white/40",
                ].join(" ")}
                disabled={!onShare}
                title="Share"
              >
                <span className="hidden md:block">Share</span>
                <Share2 className="w-4 h-4" />
              </button>

              {id && (
                <a
                  href={`/remix/${id}`}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 p-2 md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 hover:border-white/20"
                  title="View Details Page"
                >
                  <span className="hidden md:block">Details</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-950/20 p-2 md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider text-red-200 hover:bg-red-950/40 hover:border-red-500/40 transition-colors"
                  title="Delete"
                >
                  <span className="hidden md:block">Delete</span>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              className="shrink-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 ml-2"
              onClick={onClose}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {downloadError ? (
          <div className="border-b border-red-500/20 bg-red-950/20 px-4 py-3 text-xs text-red-200">
            {downloadError}
          </div>
        ) : null}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden md:grid md:grid-cols-2 md:overflow-hidden">
          {/* Media Column */}
          <div className="relative min-h-[50vh] w-full bg-black md:h-full md:border-r md:border-white/10">
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(to_bottom,transparent,black)]">
              {isVideo ? (
                <div className="relative h-full w-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={safeVideoUrl}
                    className="w-full h-full object-contain drop-shadow-2xl"
                    loop
                    playsInline
                    muted={isMuted}
                    autoPlay
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  {/* Video Controls */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full">
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          if (isPlaying) {
                            videoRef.current.pause();
                          } else {
                            videoRef.current.play();
                          }
                        }
                      }}
                      className="text-white hover:text-lime-400 transition"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button
                      onClick={() => {
                        setIsMuted(!isMuted);
                        if (videoRef.current) {
                          videoRef.current.muted = !isMuted;
                        }
                      }}
                      className="text-white hover:text-lime-400 transition"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    <button
                      onClick={() => setIsFullScreen(true)}
                      className="text-white hover:text-lime-400 transition"
                      title="Fullscreen"
                    >
                      <Maximize size={20} />
                    </button>
                  </div>
                  {/* Video Badge */}
                  <div className="absolute top-4 right-4 bg-black/70 text-lime-400 text-xs font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-lime-400 rounded-full animate-pulse" />
                    Video
                  </div>
                </div>
              ) : (
                <div
                  className="relative h-full w-full cursor-zoom-in transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  onClick={() => setIsFullScreen(true)}
                >
                  <Image src={safeUrl} alt="Preview" fill className="object-contain drop-shadow-2xl" priority unoptimized />
                </div>
              )}
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
                  {cleanPrompt(c || o) || <span className="text-white/30 italic">Waiting for generation...</span>}
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
