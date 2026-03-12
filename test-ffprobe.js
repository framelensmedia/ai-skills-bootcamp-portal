const ffmpeg = require("fluent-ffmpeg");

const videoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

ffmpeg.ffprobe(videoUrl, (err, metadata) => {
    if (err) {
        console.error("FFProbe Error:", err);
    } else {
        const videoStream = metadata.streams.find(s => s.codec_type === "video");
        console.log(`Original Resolution: ${videoStream.width}x${videoStream.height}`);
    }
});
