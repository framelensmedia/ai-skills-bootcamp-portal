"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, Mic, Square, Play, Pause, Upload, AudioLines, ChevronRight, ChevronLeft, Check, Loader2, RefreshCw } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

// Utility to convert decoded AudioBuffer to a WAV Blob
function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sampleRate = audioBuffer.sampleRate;
    let offset = 0;
    let pos = 0;

    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const writeString = (name: string) => { for (let i = 0; i < name.length; i++) { view.setUint8(pos, name.charCodeAt(i)); pos++; } };

    // WAV Header
    writeString('RIFF');
    setUint32(length - 8);
    writeString('WAVE');
    writeString('fmt ');
    setUint32(16);
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16); // 16-bit
    writeString('data');
    setUint32(length - pos - 4);

    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;     // scale to 16-bit integer
            view.setInt16(pos, sample, true);                            // write 16-bit sample
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], { type: "audio/wav" });
}

// Helper to decode any audio blob and return a WAV blob
async function convertBlobToWav(blob: Blob): Promise<Blob> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBufferToWavBlob(audioBuffer);
}

interface VoiceCloneWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const DEMO_SCRIPTS = [
    "The quick brown fox jumps over the lazy dog. This is a common phrase used to test typewriters and computer keyboards because it contains every letter of the alphabet.",
    "Welcome to my new video! Today we're going to explore some amazing AI tools that can help you create content faster and better than ever before.",
    "For the best results, try to speak naturally and clearly. Make sure you are in a quiet room without any background noise or echo, and keep an even pace.",
];

export default function VoiceCloneWizard({ isOpen, onClose, onComplete }: VoiceCloneWizardProps) {
    const supabase = createSupabaseBrowserClient();

    // Wizard State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [voiceName, setVoiceName] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Audio Method State
    const [method, setMethod] = useState<"record" | "upload">("record");

    // Upload State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    // Record State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Device Selection State
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    // Processing State
    const [isUploading, setIsUploading] = useState(false);

    // Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Randomize script on mount
    const [scriptIndex, setScriptIndex] = useState(0);
    useEffect(() => {
        setScriptIndex(Math.floor(Math.random() * DEMO_SCRIPTS.length));
    }, [isOpen]);

    // Sync audioUrl → audio element src whenever it changes
    useEffect(() => {
        if (!audioRef.current) return;
        audioRef.current.src = audioUrl || "";
        if (audioUrl) audioRef.current.load();
        setIsPlaying(false);
    }, [audioUrl]);

    // Fetch Audio Devices
    const fetchDevices = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true }); // Request permission first
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === "audioinput");
            setAudioDevices(audioInputs);
            if (audioInputs.length > 0 && !selectedDeviceId) {
                setSelectedDeviceId(audioInputs[0].deviceId);
            }
        } catch (err) {
            console.error("Error fetching audio devices:", err);
        }
    };

    useEffect(() => {
        if (isOpen && step === 2) {
            fetchDevices();
        }
    }, [isOpen, step]);

    // Timer Logic
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    // Format time helpers
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Cleanup URLs on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const handleNext = () => {
        setErrorMessage("");
        if (step === 1) {
            if (!voiceName.trim()) {
                setErrorMessage("Please enter a name for your voice.");
                return;
            }
            setStep(2);
        } else if (step === 2) {
            if (method === "record" && !audioBlob) {
                setErrorMessage("Please record at least a 10-second sample.");
                return;
            }
            if (method === "upload" && !uploadedFile) {
                setErrorMessage("Please select a file to upload.");
                return;
            }
            if (method === "record" && recordingTime < 5) {
                setErrorMessage("Recording is too short! Try for at least 10 seconds.");
                return;
            }
            // Proceed to finalize and upload
            handleFinalize();
        }
    };

    const handleFinalize = async () => {
        setErrorMessage("");
        setStep(3); // Moving to processing step
        setIsUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            // Convert tracking variables
            let finalBlob: Blob | File | null = null;

            if (method === "upload") {
                if (!uploadedFile) throw new Error("Missing upload file");
                // If it's an MP3 or WAV, we can likely use it directly. 
                // We'll safely convert it to WAV if it's not mp3 or wav.
                const ext = uploadedFile.name.split('.').pop()?.toLowerCase() || "";
                if (ext === "wav" || ext === "mp3") {
                    finalBlob = uploadedFile;
                } else {
                    console.log(`Converting uploaded ${uploadedFile.type} file to WAV...`);
                    finalBlob = await convertBlobToWav(uploadedFile);
                }
            } else {
                if (!audioBlob) throw new Error("Missing recording");
                // The browser recording is always .webm or .mp4, which Minimax rejects.
                // We must decode and convert to PCM .wav format.
                console.log(`Converting recorded ${audioBlob.type} blob to WAV...`);
                finalBlob = await convertBlobToWav(audioBlob);
            }

            // Always save as .wav unless it was a pre-existing clean mp3/wav
            const fileExt = method === "upload" && finalBlob instanceof File
                ? finalBlob.name.split('.').pop()?.toLowerCase() || "wav"
                : "wav";

            const filePath = `${user.id}/${Date.now()}_clone.${fileExt}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('voices')
                .upload(filePath, finalBlob as Blob);

            if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage.from('voices').getPublicUrl(filePath);

            // 3. Insert into Database
            const { error: insertError } = await supabase
                .from('voices')
                .insert({
                    user_id: user.id,
                    provider: 'f5-tts',
                    provider_voice_id: 'custom',
                    name: voiceName,
                    type: 'cloned',
                    preview_audio_url: publicUrl
                });

            if (insertError) throw new Error(`Database error: ${insertError.message}`);

            // 4. Success!
            setIsUploading(false);
            setTimeout(() => {
                onComplete();
                handleClose();
            }, 1500);

        } catch (err: any) {
            console.error("Cloning Failed:", err);
            setErrorMessage(err.message || "Failed to save voice clone. Please try again.");
            setIsUploading(false);
            setStep(2); // kick them back to retry
        }
    };

    const handleClose = () => {
        if (isRecording) stopRecording();
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setStep(1);
        setVoiceName("");
        setMethod("record");
        setAudioBlob(null);
        setAudioUrl(null);
        setUploadedFile(null);
        setRecordingTime(0);
        setErrorMessage("");
        onClose();
    };

    // --- Media Recorder Methods --- //
    const startRecording = async () => {
        setErrorMessage("");
        try {
            const constraints = {
                audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Initialize raw — let the browser choose its preferred default codec/container
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Let the Blob assume the native type of the recorded chunks
                const blob = new Blob(audioChunksRef.current);
                console.log(`[Recording Stopped] Blob size: ${blob.size} bytes | Type: ${blob.type || mediaRecorder.mimeType} | Chunks: ${audioChunksRef.current.length}`);

                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setIsPlaying(false);

                // Stop all tracks
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setAudioBlob(null);
            setAudioUrl(null);
            setRecordingTime(0);
            setIsRecording(true);
        } catch (err) {
            console.error("Microphone Access Error:", err);

            setErrorMessage("Microphone access denied or unavailable.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const togglePlayback = () => {
        if (!audioUrl || !audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            // Re-seek to start so re-playing always works
            audioRef.current.currentTime = 0;
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(e => {
                    console.error("Playback failed:", e);
                    setIsPlaying(false);
                });
        }
    };

    const onAudioEnded = () => setIsPlaying(false);

    // --- Upload Handlers --- //
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            const url = URL.createObjectURL(file);
            setAudioUrl(url);
            setIsPlaying(false);
            setErrorMessage("");
        }
    };

    // Prevent rendering if not open
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Always-mounted hidden audio element so ref is always valid */}
            <audio
                ref={audioRef}
                preload="auto"
                onEnded={() => setIsPlaying(false)}
                style={{ display: "none" }}
            />
            <div className="bg-[#0f0f11] max-w-2xl w-full rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/20 p-2 rounded-xl border border-primary/20">
                            <Plus className="text-primary" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Create Voice Clone</h3>
                            <p className="text-xs text-white/40 font-medium">Step {step} of 2 - {step === 1 ? 'Voice Profile' : step === 2 ? 'Audio Capture' : 'Processing'}</p>
                        </div>
                    </div>
                    {step !== 3 && (
                        <button onClick={handleClose} className="text-white/30 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/5">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${step === 1 ? '33%' : step === 2 ? '66%' : '100%'}` }}
                    />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">

                    {errorMessage && step !== 3 && (
                        <div className="mb-6 text-sm font-bold text-red-400 bg-red-400/10 py-3 px-4 rounded-xl border border-red-400/20 animate-in slide-in-from-top-2">
                            {errorMessage}
                        </div>
                    )}

                    {/* --- STEP 1: Name --- */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">What should we call this voice?</label>
                                <input
                                    type="text"
                                    value={voiceName}
                                    onChange={e => setVoiceName(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-lg text-white outline-none focus:border-primary/50 transition-colors shadow-inner"
                                    placeholder="E.g. My Narrator Voice, John Doe, etc."
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                />
                                <p className="text-sm text-white/40">Choose a memorable name so you can easily find it later in the Voice Studio.</p>
                            </div>
                        </div>
                    )}

                    {/* --- STEP 2: Record / Upload --- */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Method Tabs */}
                            <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 w-fit mx-auto mb-8">
                                <button
                                    onClick={() => setMethod("record")}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${method === "record" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70"}`}
                                >
                                    <Mic size={16} /> Record in Browser
                                </button>
                                <button
                                    onClick={() => setMethod("upload")}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${method === "upload" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70"}`}
                                >
                                    <Upload size={16} /> Upload Audio File
                                </button>
                            </div>

                            {/* RECORDING MODE */}
                            {method === "record" && (
                                <div className="flex flex-col items-center">

                                    {/* Microphone Selector */}
                                    {audioDevices.length > 1 && !isRecording && !audioBlob && (
                                        <div className="w-full mb-6">
                                            <label className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2 block text-center">
                                                Select Microphone
                                            </label>
                                            <select
                                                value={selectedDeviceId}
                                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 outline-none focus:border-primary/50 transition-colors cursor-pointer appearance-none text-center"
                                                style={{ textAlignLast: "center" }}
                                            >
                                                {audioDevices.map((device) => (
                                                    <option key={device.deviceId} value={device.deviceId} className="bg-[#0f0f11] text-left">
                                                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="bg-black/30 border border-white/5 rounded-3xl p-6 w-full mb-8 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3">
                                            <button
                                                onClick={() => setScriptIndex((prev) => (prev + 1) % DEMO_SCRIPTS.length)}
                                                className="text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/5 px-2 py-1 rounded-lg"
                                            >
                                                <RefreshCw size={12} /> Swap Script
                                            </button>
                                        </div>
                                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3 text-center">Reading Script</p>
                                        <p className="text-white/80 text-xl md:text-2xl font-serif text-center leading-relaxed">
                                            "{DEMO_SCRIPTS[scriptIndex]}"
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-center justify-center py-6 w-full rounded-3xl border border-white/10 bg-black/50 relative overflow-hidden">

                                        {/* Recording Pulse Effect */}
                                        {isRecording && (
                                            <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
                                        )}

                                        <div className="text-4xl font-mono text-white/90 mb-6 tracking-wider font-light">
                                            {formatTime(recordingTime)}
                                        </div>

                                        <div className="flex items-center gap-6">
                                            {!isRecording && !audioBlob && (
                                                <button
                                                    onClick={startRecording}
                                                    className="w-20 h-20 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all hover:scale-105"
                                                >
                                                    <Mic size={32} className="text-white" />
                                                </button>
                                            )}

                                            {isRecording && (
                                                <button
                                                    onClick={stopRecording}
                                                    className="w-20 h-20 bg-black border-2 border-red-500 rounded-full flex items-center justify-center transition-all hover:scale-105 group"
                                                >
                                                    <Square size={24} className="text-red-500 group-hover:fill-red-500" />
                                                </button>
                                            )}

                                            {(!isRecording && audioBlob && audioUrl) && (
                                                <div className="flex flex-col items-center gap-4 w-full px-4">
                                                    {/* Native browser audio player — most reliable playback */}
                                                    <audio
                                                        src={audioUrl}
                                                        controls
                                                        className="w-full rounded-xl"
                                                        style={{ colorScheme: "dark" }}
                                                    />
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={startRecording}
                                                            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-all border border-white/10"
                                                        >
                                                            🔄 Record Again
                                                        </button>
                                                        <a
                                                            href={audioUrl}
                                                            download="test-recording.webm"
                                                            className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-all"
                                                        >
                                                            💾 Download to test
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                    <p className="text-center text-xs text-white/30 mt-4 max-w-sm">
                                        Record at least 10-15 seconds of clear audio for the best cloning quality.
                                    </p>
                                </div>
                            )}

                            {/* UPLOAD MODE */}
                            {method === "upload" && (
                                <div>
                                    <div
                                        className="border-2 border-dashed border-white/10 rounded-3xl p-12 bg-black/50 text-center hover:border-primary/30 transition-all group relative cursor-pointer overflow-hidden mb-6"
                                        onClick={() => !audioUrl && fileInputRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            accept="audio/mp3,audio/wav,audio/mpeg,audio/m4a"
                                            ref={fileInputRef}
                                            className="hidden"
                                            onChange={handleFileUpload}
                                        />

                                        {!audioUrl ? (
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                                    <Upload className="text-white/40 group-hover:text-primary transition-colors" size={28} />
                                                </div>
                                                <div>
                                                    <div className="text-lg font-bold text-white mb-1">Click to browse files</div>
                                                    <div className="text-sm text-white/40 font-medium pb-2">.mp3, .wav, or .m4a (Max 10MB)</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-6">
                                                <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                                    <Check size={16} /> File Selected: {uploadedFile?.name}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAudioUrl(null); setUploadedFile(null); }}
                                                        className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-white text-sm font-bold transition-all border border-white/10"
                                                    >
                                                        Remove
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
                                                        className="w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center shadow-lg transition-all"
                                                    >
                                                        {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-3">
                                        <AudioLines className="text-white/40 shrink-0" size={20} />
                                        <p className="text-xs text-white/60 leading-relaxed font-medium">
                                            Upload clean audio of ONLY the target speaker. Ensure there is no background music, reverb, or multiple voices overlap. For best results, audio should be at least 15 seconds long.
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {/* --- STEP 3: Processing (Saving to DB/Storage) --- */}
                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-700">
                            {isUploading ? (
                                <>
                                    <div className="w-24 h-24 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center mb-6 relative">
                                        <div className="absolute inset-0 rounded-full border-[3px] border-t-primary border-primary/10 animate-spin" />
                                        <AudioLines className="text-primary animate-pulse" size={32} />
                                    </div>
                                    <h4 className="text-2xl font-bold text-white mb-2">Cloning Voice...</h4>
                                    <p className="text-white/40 font-medium">Processing your audio sample and generating voice profile.</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-24 h-24 rounded-full border border-green-500/20 bg-green-500/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                        <Check className="text-green-500" size={40} strokeWidth={3} />
                                    </div>
                                    <h4 className="text-2xl font-bold text-white mb-2 text-center">Voice Cloned Successfully!</h4>
                                    <p className="text-white/40 font-medium mb-1">"{voiceName}" has been added to your library.</p>
                                    <p className="text-white/30 text-sm">Redirecting...</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {step !== 3 && (
                    <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center">
                        <button
                            onClick={step === 2 ? () => { setStep(1); stopRecording(); } : handleClose}
                            className="px-6 py-3 rounded-xl hover:bg-white/10 text-white/60 hover:text-white text-sm font-bold transition-all"
                        >
                            {step === 1 ? 'Cancel' : 'Back'}
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={step === 1 ? !voiceName.trim() : (method === "record" ? !audioBlob : !uploadedFile)}
                            className="px-8 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {step === 1 ? (
                                <>Next Step <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                            ) : (
                                <>Complete Setup <Check size={16} /></>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden Audio Player for previewing */}
            <audio
                ref={audioRef}
                src={audioUrl || undefined}
                onEnded={onAudioEnded}
                className="hidden"
            />
        </div>
    );
}
