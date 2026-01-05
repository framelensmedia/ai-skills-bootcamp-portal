"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  value: File[];
  onChange: (next: File[]) => void;
  max?: number;
  title?: string;
  description?: string;
};

function clamp(files: File[], max: number) {
  return files.length <= max ? files : files.slice(0, max);
}

export default function ImageUploadPills({
  value,
  onChange,
  max = 10,
  title = "Upload images",
  description = "Optional. Upload up to 10 reference images to guide the generation.",
}: Props) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    previews.forEach((u) => URL.revokeObjectURL(u));
    const next = value.map((f) => URL.createObjectURL(f));
    setPreviews(next);

    return () => next.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;

    onChange(clamp([...value, ...files], max));
    e.target.value = "";
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function clear() {
    onChange([]);
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-white/45">
          {value.length}/{max}
        </div>
      </div>

      <p className="mt-2 text-sm text-white/55">{description}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-black/60">
          <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
          Upload images
        </label>

        <button
          type="button"
          onClick={clear}
          disabled={!value.length}
          className={[
            "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition",
            value.length
              ? "border-white/15 bg-black/40 text-white/80 hover:bg-black/60"
              : "cursor-not-allowed border-white/10 bg-black/20 text-white/35",
          ].join(" ")}
        >
          Clear
        </button>
      </div>

      {previews.length ? (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {previews.map((src, idx) => (
            <div key={src} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <div className="relative aspect-square w-full">
                <Image src={src} alt={`Upload ${idx + 1}`} fill className="object-cover" />
              </div>

              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute right-1 top-1 rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-[11px] text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                title="Remove"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-xs text-white/45">No images uploaded.</div>
      )}
    </div>
  );
}
