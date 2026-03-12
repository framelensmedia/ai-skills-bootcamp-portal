"use client";

import { NleProvider } from "./_context/NleContext";
import { ArrowLeft, MonitorPlay, Save, Loader2, Check, AlertCircle, FolderOpen, Trash2, Plus, Maximize, Minimize, Sparkles, Wand2, Library, X, Image as ImageIcon, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

import NleTimeline from "./_components/NleTimeline";
import NlePlaybackEngine from "./_components/NlePlaybackEngine";
import NleLibraryPanel from "./_components/NleLibraryPanel";
import NleTransportBar from "./_components/NleTransportBar";

import { useNle, TimelineClip } from "./_context/NleContext";

function EditorWorkspace() {
    const {
        tracks, duration, isFullscreen, setIsFullscreen, aspectRatio, setAspectRatio,
        projectId, projectName, setProjectName, hasUnsavedChanges, saveStatus, saveProject, loadProject, newProject,
        addClipToTrack, activeTrackId
    } = useNle();

    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showProjects, setShowProjects] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [showFloatingMenu, setShowFloatingMenu] = useState(false);
    const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);

    const searchParams = useSearchParams();
    const router = useRouter();

    // === Load project from URL on mount ===
    const didLoad = useRef<string | null>(null);
    useEffect(() => {
        const projectParam = searchParams.get('project');
        if (projectParam && didLoad.current !== projectParam) {
            didLoad.current = projectParam;
            loadProject(projectParam);
        }
    }, [searchParams, loadProject]);

    // === Auto-Draft Timer (every 30s) ===
    useEffect(() => {
        const interval = setInterval(() => {
            if (hasUnsavedChanges) {
                saveProject(true); // Save as draft
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [hasUnsavedChanges, saveProject]);

    const handleExport = async () => {
        try {
            setRendering(true);
            setError(null);
            const res = await fetch("/api/nle-render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tracks, duration })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to render");
            const a = document.createElement('a');
            a.href = data.videoUrl;
            a.download = `Studio_NLE_Export.mp4`;
            a.click();
        } catch (err: any) {
            console.error("Export Error:", err);
            setError(err.message);
        } finally {
            setRendering(false);
        }
    };

    // Fetch saved projects list
    const fetchProjects = async () => {
        setLoadingProjects(true);
        try {
            const res = await fetch('/api/nle-projects');
            if (res.ok) {
                const { projects: list } = await res.json();
                setProjects(list || []);
            }
        } catch (e) {
            console.error('Fetch projects error:', e);
        }
        setLoadingProjects(false);
    };

    const deleteProject = async (id: string) => {
        try {
            await fetch(`/api/nle-projects/${id}`, { method: 'DELETE' });
            setProjects(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            console.error('Delete project error:', e);
        }
    };

    // Save status indicator
    const SaveIndicator = () => {
        if (saveStatus === 'saving') return <span className="text-[10px] text-yellow-400/80 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Saving...</span>;
        if (saveStatus === 'saved') return <span className="text-[10px] text-green-400/80 flex items-center gap-1"><Check size={10} /> Saved</span>;
        if (saveStatus === 'error') return <span className="text-[10px] text-red-400/80 flex items-center gap-1"><AlertCircle size={10} /> Error</span>;
        if (hasUnsavedChanges) return <span className="text-[10px] text-white/30">Unsaved</span>;
        return null;
    };

    const handleMobileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            const type = file.type.startsWith('video') ? 'video' : 'audio';
            const newClip: Omit<TimelineClip, 'id'> = {
                assetId: Math.random().toString(36).substr(2, 9),
                mediaType: type as any,
                url: url,
                duration: 5,
                startTime: 0,
                inPoint: 0,
                outPoint: 5,
                volume: 1.0,
                x: 0, y: 0, width: 100, height: 100, opacity: 1.0
            };
            addClipToTrack(activeTrackId, newClip);
            if (isLibraryModalOpen) setIsLibraryModalOpen(false);
        }
    };

    return (
        <div className={`bg-[#0A0A0A] text-white flex flex-col ${isFullscreen ? "fixed inset-0 z-50 w-full h-full" : "h-[calc(100vh-8rem)] min-h-[600px] rounded-xl border border-white/10 shadow-2xl"}`}>
            {/* Top Navigation Bar - Always visible, changes slightly in Fullscreen */}
            <header className="h-14 border-b border-white/10 bg-black/50 flex items-center justify-between px-4 shrink-0 transition-all z-[999] relative">
                <div className="flex items-center gap-3">
                    <Link href="/studio/creator" className={`${isFullscreen ? 'hidden' : 'flex'} text-white/50 hover:text-white transition p-2 rounded-lg hover:bg-white/5`}>
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <MonitorPlay className="text-lime-400" size={18} />
                        {editingName ? (
                            <input
                                autoFocus
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                onBlur={() => setEditingName(false)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
                                className="font-bold text-sm tracking-wide bg-transparent border-b border-lime-400 outline-none text-white w-40"
                            />
                        ) : (
                            <h1
                                className="font-bold text-sm tracking-wide cursor-pointer hover:text-lime-400 transition"
                                onClick={() => setEditingName(true)}
                                title="Click to rename"
                            >
                                {projectName}
                            </h1>
                        )}
                        <SaveIndicator />
                    </div>
                </div>

                <input
                    type="file"
                    id="mobile-upload-input"
                    className="hidden"
                    onChange={handleMobileUpload}
                    accept="video/*,audio/*"
                />

                <div className="flex items-center gap-2">
                    {/* My Projects Button */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowProjects(!showProjects); if (!showProjects) fetchProjects(); }}
                            className="h-8 px-3 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-bold rounded-lg flex items-center gap-1.5 transition hidden sm:flex"
                            title="My Projects"
                        >
                            <FolderOpen size={14} />
                            <span>Projects</span>
                        </button>

                        {/* Projects Dropdown */}
                        {showProjects && (
                            <div className="absolute right-0 top-10 w-72 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden">
                                <div className="p-3 border-b border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-bold text-white/50 uppercase tracking-wider">My Projects</span>
                                    <button
                                        onClick={() => { newProject(); setShowProjects(false); }}
                                        className="text-[10px] font-bold text-lime-400 hover:text-lime-300 flex items-center gap-1 transition"
                                    >
                                        <Plus size={12} /> New
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {loadingProjects ? (
                                        <div className="p-4 text-center"><Loader2 size={16} className="animate-spin mx-auto text-white/30" /></div>
                                    ) : projects.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-white/30">No saved projects yet</div>
                                    ) : (
                                        projects.map(p => (
                                            <div
                                                key={p.id}
                                                className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition group cursor-pointer"
                                                onClick={() => {
                                                    setShowProjects(false);
                                                    loadProject(p.id);
                                                    didLoad.current = p.id;
                                                    window.history.replaceState(null, '', `/studio/edit?project=${p.id}`);
                                                }}
                                            >
                                                <div className="flex-1 text-left min-w-0">
                                                    <div className="text-xs font-semibold text-white/80 truncate">{p.name}</div>
                                                    <div className="text-[10px] text-white/30 flex gap-2">
                                                        <span>{p.is_draft ? '📝 Draft' : '💾 Saved'}</span>
                                                        <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        deleteProject(p.id);
                                                    }}
                                                    className="w-8 h-8 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition z-10"
                                                    title="Delete Project"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Aspect Ratio Picker */}
                    <div className="hidden sm:flex bg-black/60 rounded-md border border-white/10 overflow-hidden shadow-sm pointer-events-auto">
                        <span className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/50 uppercase border-r border-white/10 bg-white/5 hidden md:block">Ratio</span>
                        <button onClick={() => setAspectRatio('9:16')} className={`px-3 py-1.5 border-r border-white/10 text-xs font-bold transition hover:bg-white/10 ${aspectRatio === '9:16' ? 'text-lime-400 bg-white/5' : 'text-white/40'}`}>9:16</button>
                        <button onClick={() => setAspectRatio('16:9')} className={`px-3 py-1.5 border-r border-white/10 text-xs font-bold transition hover:bg-white/10 ${aspectRatio === '16:9' ? 'text-lime-400 bg-white/5' : 'text-white/40'}`}>16:9</button>
                        <button onClick={() => setAspectRatio('1:1')} className={`px-3 py-1.5 text-xs font-bold transition hover:bg-white/10 ${aspectRatio === '1:1' ? 'text-lime-400 bg-white/5' : 'text-white/40'}`}>1:1</button>
                    </div>

                    {isFullscreen ? (
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="h-8 px-4 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition hidden sm:flex"
                        >
                            Exit Fullscreen
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsFullscreen(true)}
                            className="h-8 px-4 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-bold rounded-lg flex items-center gap-2 transition hidden sm:flex"
                        >
                            Fullscreen
                        </button>
                    )}

                    {/* Save Button */}
                    <button
                        onClick={() => saveProject(false)}
                        disabled={saveStatus === 'saving'}
                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 hidden sm:flex"
                        title="Save Project"
                    >
                        {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span className="hidden sm:inline">Save</span>
                    </button>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={rendering}
                        className="h-8 px-4 bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold rounded-lg flex items-center gap-2 transition disabled:opacity-50 hidden sm:flex"
                    >
                        {rendering ? <Loader2 size={14} className="animate-spin" /> : <MonitorPlay size={14} />}
                        {rendering ? "Rendering..." : "Export"}
                    </button>
                </div>
            </header>

            {/* Mobile Actions Floating Menu */}
            <div className="fixed top-[4.5rem] right-4 z-[9999] lg:hidden flex flex-col items-end gap-3">
                <button
                    onClick={() => setShowFloatingMenu(!showFloatingMenu)}
                    className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${showFloatingMenu ? 'bg-zinc-700 rotate-45 opacity-100' : 'bg-black/40 backdrop-blur-md border border-white/10 text-white/40 hover:opacity-100'} shadow-black/20`}
                >
                    {showFloatingMenu ? <X size={20} /> : <Wand2 size={20} />}
                </button>

                {showFloatingMenu && (
                    <div className="flex flex-col items-end gap-3 mt-2 animate-in fade-in slide-in-from-top-4 duration-200 max-h-[75vh] overflow-y-auto scrollbar-none pb-4 pr-1">
                        {/* Aspect Ratio Cycler */}
                        <button
                            onClick={() => {
                                const ratios: ('9:16' | '16:9' | '1:1')[] = ['9:16', '16:9', '1:1'];
                                const next = ratios[(ratios.indexOf(aspectRatio) + 1) % ratios.length];
                                setAspectRatio(next);
                            }}
                            className="w-12 h-12 bg-zinc-800 border border-white/10 rounded-full shadow-lg flex items-center justify-center text-[#B7FF00] active:scale-95 transition text-[10px] font-bold"
                            title="Cycle Aspect Ratio"
                        >
                            {aspectRatio}
                        </button>
                        {/* Save */}
                        <button
                            onClick={() => { saveProject(false); setShowFloatingMenu(false); }}
                            className="w-12 h-12 bg-emerald-600 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition"
                            title="Save"
                        >
                            <Save size={20} />
                        </button>
                        {/* Export */}
                        <button
                            onClick={() => { handleExport(); setShowFloatingMenu(false); }}
                            className="w-12 h-12 bg-lime-500 rounded-full shadow-lg flex items-center justify-center text-black active:scale-95 transition"
                            title="Export"
                        >
                            <MonitorPlay size={20} />
                        </button>
                        {/* Projects */}
                        <button
                            onClick={() => { setShowProjects(true); fetchProjects(); setShowFloatingMenu(false); }}
                            className="w-12 h-12 bg-zinc-800 border border-white/10 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition"
                            title="Projects"
                        >
                            <FolderOpen size={20} />
                        </button>
                        {/* Fullscreen */}
                        <button
                            onClick={() => { setIsFullscreen(!isFullscreen); setShowFloatingMenu(false); }}
                            className="w-12 h-12 bg-zinc-800 border border-white/10 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition"
                            title="Fullscreen"
                        >
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>

                        {/* Library */}
                        <button
                            onClick={() => { setIsLibraryModalOpen(true); setShowFloatingMenu(false); }}
                            className="w-12 h-12 bg-zinc-800 border border-white/10 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition"
                            title="Library"
                        >
                            <Library size={20} className="text-[#B7FF00]" />
                        </button>

                        {/* Upload */}
                        <button
                            onClick={() => { document.getElementById('mobile-upload-input')?.click(); setShowFloatingMenu(false); }}
                            className="w-12 h-12 bg-zinc-800 border border-white/10 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition"
                            title="Upload"
                        >
                            <Upload size={20} className="text-[#B7FF00]" />
                        </button>
                    </div>
                )}
            </div>

            {/* Main Workspace Area */}
            {error && (
                <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 p-2 text-center text-xs font-bold shrink-0 z-50">
                    Export Error: {error}
                </div>
            )}
            <div className={`flex-1 flex flex-col sm:flex-row-reverse overflow-hidden relative z-10 ${isFullscreen ? "bg-[#090909]" : "bg-black"}`}>

                {/* Video Preview (Top in Portrait, Right in Landscape) */}
                <div className={`w-full sm:w-[33%] lg:w-[40%] flex flex-col relative h-[40vh] sm:h-auto min-h-0 ${isFullscreen ? "bg-[#050505]" : "bg-black"} border-b sm:border-b-0 sm:border-l border-white/10`}>
                    <div className="absolute top-4 left-4 z-50 pointer-events-none">
                        <span className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/50 uppercase bg-black/60 backdrop-blur-md rounded-md border border-white/10 pointer-events-auto">Preview</span>
                    </div>

                    <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col items-center justify-center p-2 lg:p-4">
                        <NlePlaybackEngine isFullscreen={isFullscreen} />
                    </div>
                </div>

                {/* Left (Landscape) or Bottom (Portrait) Column: Media Actions & Timeline */}
                <div className="flex-1 sm:w-[66%] lg:w-[60%] flex flex-col min-h-0 bg-[#090909] sm:border-r border-white/10 relative">

                    {/* Desktop Library Sidebar (only on large screens) */}
                    <div className="hidden lg:flex h-80 flex-col min-h-0 bg-[#111] border-b border-white/10">
                        <NleLibraryPanel />
                    </div>

                    {/* Timeline Container (Always Visible) */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#121212] overflow-hidden">
                        <NleTimeline isFullscreen={isFullscreen} />
                    </div>
                </div>
            </div>

            {/* Transport Bar (Bottom Fixed) */}
            <div className="shrink-0 bg-[#0A0A0A]">
                <NleTransportBar />
            </div>

            {/* Library Modal for Mobile */}
            {isLibraryModalOpen && (
                <div className="fixed inset-0 z-[10000] bg-black animate-in fade-in slide-in-from-bottom-5 duration-300">
                    <div className="flex flex-col h-full">
                        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0A0A0A] shrink-0">
                            <div className="flex items-center gap-3">
                                <Library size={20} className="text-[#B7FF00]" />
                                <h2 className="text-lg font-bold text-white">Select Media</h2>
                            </div>
                            <button
                                onClick={() => setIsLibraryModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition"
                            >
                                <X size={20} />
                            </button>
                        </header>
                        <div className="flex-1 overflow-hidden">
                            <NleLibraryPanel onClipAdded={() => setIsLibraryModalOpen(false)} />
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close projects dropdown */}
            {showProjects && <div className="fixed inset-0 z-[99]" onClick={() => setShowProjects(false)} />}
        </div>
    );
}

export default function NlePage() {
    return (
        <NleProvider>
            <Suspense fallback={<div className="h-screen bg-black flex items-center justify-center text-white/30">Loading Editor...</div>}>
                <EditorWorkspace />
            </Suspense>
        </NleProvider>
    );
}
