/**
 * Pure Node.js MP4 Faststart — moves the `moov` atom to before `mdat`.
 *
 * iOS Safari requires the moov (movie metadata) atom to be at the START of
 * an MP4 file to begin streaming without downloading the entire file first.
 * AI video generators (e.g. HeyGen) often write moov at the END because they
 * don't know the final duration until all frames are encoded.
 *
 * Equivalent to: ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
 *
 * No binary dependencies — pure Buffer manipulation in Node.js.
 */
export function mp4Faststart(input: Buffer): Buffer {
    const boxes = parseTopLevelBoxes(input);

    const moovIdx = boxes.findIndex(b => b.type === "moov");
    const mdatIdx = boxes.findIndex(b => b.type === "mdat");

    // Already faststart (moov before mdat), or structure unrecognised — return as-is
    if (moovIdx === -1 || mdatIdx === -1 || moovIdx < mdatIdx) {
        return input;
    }

    const moovBox = boxes[moovIdx];

    // Make a mutable copy of the moov data and update chunk offsets.
    // When moov moves to before mdat, all mdat content shifts by moovBox.size bytes,
    // so every stco/co64 entry must increase by that amount.
    const moovData = Buffer.from(input.subarray(moovBox.start, moovBox.start + moovBox.size));
    updateChunkOffsets(moovData, 8, moovData.length, moovBox.size);

    // Reconstruct: boxes-before-mdat (e.g. ftyp), then moov, then everything else
    const parts: Buffer[] = [];
    for (const b of boxes) {
        if (b === moovBox) continue; // moved separately
        if (boxes.indexOf(b) === mdatIdx) {
            // Insert moov immediately before the first mdat
            parts.push(moovData);
        }
        parts.push(input.subarray(b.start, b.start + b.size));
    }

    return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface Box { type: string; start: number; size: number }

function parseTopLevelBoxes(buf: Buffer): Box[] {
    const boxes: Box[] = [];
    let pos = 0;
    while (pos + 8 <= buf.length) {
        let size = buf.readUInt32BE(pos);
        if (size === 1) {
            // 64-bit extended size
            if (pos + 16 > buf.length) break;
            const hi = buf.readUInt32BE(pos + 8);
            const lo = buf.readUInt32BE(pos + 12);
            size = hi * 0x100000000 + lo;
        }
        if (size < 8 || pos + size > buf.length) break;
        const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
        boxes.push({ type, start: pos, size });
        pos += size;
    }
    return boxes;
}

/** Recursively find stco/co64 atoms inside a container and add `delta` to each entry. */
function updateChunkOffsets(data: Buffer, start: number, end: number, delta: number): void {
    const CONTAINERS = new Set(["moov","trak","mdia","minf","stbl","udta","edts","moof","traf","dinf","mvex"]);
    let pos = start;
    while (pos + 8 <= end && pos + 8 <= data.length) {
        let size = data.readUInt32BE(pos);
        if (size === 1) {
            if (pos + 16 > data.length) break;
            const hi = data.readUInt32BE(pos + 8);
            const lo = data.readUInt32BE(pos + 12);
            size = hi * 0x100000000 + lo;
        }
        if (size < 8 || pos + size > data.length) break;
        const type = data.subarray(pos + 4, pos + 8).toString("ascii");

        if (type === "stco") {
            // 4-byte version/flags, 4-byte entry count, then 4-byte offsets
            const count = data.readUInt32BE(pos + 12);
            for (let i = 0; i < count; i++) {
                const off = pos + 16 + i * 4;
                data.writeUInt32BE(data.readUInt32BE(off) + delta, off);
            }
        } else if (type === "co64") {
            // 4-byte version/flags, 4-byte entry count, then 8-byte offsets
            const count = data.readUInt32BE(pos + 12);
            for (let i = 0; i < count; i++) {
                const off = pos + 16 + i * 8;
                const hi = data.readUInt32BE(off);
                const lo = data.readUInt32BE(off + 4);
                const updated = hi * 0x100000000 + lo + delta;
                data.writeUInt32BE(Math.floor(updated / 0x100000000), off);
                data.writeUInt32BE(updated % 0x100000000, off + 4);
            }
        } else if (CONTAINERS.has(type)) {
            updateChunkOffsets(data, pos + 8, pos + size, delta);
        }

        pos += size;
    }
}
