const ffmpeg = require("fluent-ffmpeg");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");

ffmpeg.setFfprobePath(ffprobeInstaller.path);

const falUrl = "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/generations/videos/1da54ff8-869c-4e94-aae5-89fe8604d852/lipsync_1773189708474.mp4";

function measure(url, label) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(url, (err, meta) => {
            if (err) return console.log(label, "Error", err);
            const v = meta.streams.find(s => s.codec_type === "video");
            console.log(label, `${v.width}x${v.height}`, `DAR: ${v.display_aspect_ratio}`);
            resolve();
        });
    });
}

async function run() {
    await measure(falUrl, "User's Lipsync Output");
}

run();
