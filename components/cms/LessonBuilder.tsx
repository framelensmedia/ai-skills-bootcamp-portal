"use client";

import React, { useState } from "react";
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragEndEvent,
    DragStartEvent
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    Video,
    FileQuestion,
    Sparkles,
    GripVertical,
    Trash2,
    Plus,
    Check,
    Play,
    Clock,
    MoreHorizontal,
    Type,
    Zap,
    LayoutTemplate
} from "lucide-react";
import { LessonContentItem } from "./LessonContentManager";
import VideoUploader from "./VideoUploader";
import TemplateSelector from "@/components/cms/TemplateSelector";

// --- Components ---

function SidebarItem({ type, label, icon: Icon, description }: { type: string, label: string, icon: any, description?: string }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `sidebar-${type}`,
        data: { type, isSidebar: true }
    });

    const style = transform ? {
        transform: CSS.Translate.toString(transform),
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={style}
            className="group flex flex-col gap-2 p-4 rounded-xl border border-white/10 bg-zinc-900/80 hover:bg-zinc-800 hover:border-[#B7FF00]/30 cursor-grab active:cursor-grabbing transition text-left"
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${type === 'video' ? 'bg-[#B7FF00]/10 text-[#B7FF00]' :
                    type === 'text' ? 'bg-blue-500/20 text-blue-400' :
                        type === 'exercise' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-pink-500/20 text-pink-400'
                    }`}>
                    <Icon size={20} />
                </div>
                <span className="font-bold text-sm text-white">{label}</span>
            </div>
            {description && (
                <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
                    {description}
                </p>
            )}
        </div>
    );
}

function SortableCanvasItem({ id, item, index, totalItems, onDelete, onUpdate }: {
    id: string,
    item: LessonContentItem,
    index: number,
    totalItems: number,
    onDelete: () => void,
    onUpdate: (updates: Partial<LessonContentItem>) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 1,
    };

    const [expanded, setExpanded] = useState(false);

    // Update specific content field
    const updateContent = (field: string, value: any) => {
        onUpdate({ content: { ...item.content, [field]: value } });
    };

    const getIcon = () => {
        switch (item.type) {
            case 'video': return Video;
            case 'text': return Type;
            case 'exercise': return Zap; // Changed to Zap for Action
            case 'celebration': return Sparkles;
            default: return Video;
        }
    };

    const Icon = getIcon();

    const getIconColor = () => {
        switch (item.type) {
            case 'video': return 'text-[#B7FF00]';
            case 'text': return 'text-blue-400';
            case 'exercise': return 'text-purple-400';
            case 'celebration': return 'text-pink-400';
            default: return 'text-white';
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-2">
            <div className={`rounded-xl border bg-zinc-900 overflow-hidden transition ${expanded ? "border-[#B7FF00]/30" : "border-white/10"}`}>

                {/* Compact Row Header */}
                <div className="flex items-center gap-3 p-3 group hover:bg-white/5 transition">
                    {/* Drag Handle */}
                    <div {...attributes} {...listeners} className="cursor-grab text-white/10 hover:text-white/40 transition">
                        <GripVertical size={16} />
                    </div>

                    {/* Order Number */}
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-white/5 text-xs font-bold text-white/40 font-mono">
                        {index + 1}
                    </div>

                    {/* Icon */}
                    <div className={`${getIconColor()}`}>
                        <Icon size={16} />
                    </div>

                    {/* Title & Info */}
                    <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setExpanded(!expanded)}
                    >
                        <div className="font-medium text-sm truncate flex items-center gap-2">
                            {item.title}
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                                {item.type === 'exercise' ? 'Action' : item.type}
                            </span>
                        </div>
                        <div className="text-xs text-white/40 truncate mt-0.5">
                            {item.type === 'video' ? (
                                <span className="flex items-center gap-2">
                                    <Clock size={10} />
                                    {item.content.duration_seconds || 60}s
                                    {item.content.video_url ? ` • ${item.content.video_url}` : ' • No video selected'}
                                </span>
                            ) : item.type === 'text' ? (
                                <span>{item.content.question ? `${item.content.question.substring(0, 30)}...` : 'No text content'}</span>
                            ) : item.type === 'exercise' ? (
                                <span>
                                    {item.content.options && item.content.options[0]
                                        ? `Template: ${item.content.options[0].substring(0, 20)}...`
                                        : 'No template selected'}
                                </span>
                            ) : (
                                <span>Celebration Screen</span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={onDelete}
                        className="p-2 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition"
                    >
                        <Trash2 size={14} />
                    </button>

                    <div
                        onClick={() => setExpanded(!expanded)}
                        className={`p-2 rounded cursor-pointer transition ${expanded ? "text-white bg-white/10" : "text-white/20 hover:text-white hover:bg-white/5"}`}
                    >
                        <MoreHorizontal size={14} />
                    </div>
                </div>

                {/* Expanded Editor */}
                {expanded && (
                    <div className="border-t border-white/10 p-4 space-y-4 bg-black/20 animate-in slide-in-from-top-2">
                        {/* Common Title Edit */}
                        <div>
                            <label className="text-xs font-medium text-white/60 mb-1 block">Title</label>
                            <input
                                value={item.title}
                                onChange={(e) => onUpdate({ title: e.target.value })}
                                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#B7FF00] outline-none"
                            />
                        </div>

                        {/* Video Specific */}
                        {item.type === 'video' && (
                            <>
                                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                    <div className="mb-2 text-xs font-medium text-white/80">Upload Video</div>
                                    <VideoUploader
                                        currentUrl={item.content.video_url}
                                        onUpload={(url, duration) => {
                                            console.log("Video uploaded:", url, duration);
                                            const newContent = { ...item.content, video_url: url };
                                            if (duration) newContent.duration_seconds = duration;
                                            onUpdate({ content: newContent });
                                        }}
                                    />
                                    {/* Manual URL Input */}
                                    <div className="mt-2">
                                        <label className="text-xs font-medium text-white/40 mb-1 block">Video URL</label>
                                        <input
                                            value={item.content.video_url || ""}
                                            onChange={(e) => updateContent("video_url", e.target.value)}
                                            placeholder="https://..."
                                            className="w-full bg-zinc-900/50 border border-white/5 rounded px-2 py-1 text-xs text-white/60 focus:text-white focus:border-[#B7FF00]/50 outline-none font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-white/60 mb-1 block">Duration (seconds)</label>
                                        <input
                                            type="number"
                                            value={item.content.duration_seconds || 60}
                                            onChange={(e) => updateContent("duration_seconds", parseInt(e.target.value))}
                                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#B7FF00] outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-white/60 mb-1 block">Description / What you'll learn</label>
                                    <textarea
                                        value={item.content.description || ""}
                                        onChange={(e) => updateContent("description", e.target.value)}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#B7FF00] outline-none resize-none"
                                        rows={3}
                                        placeholder="Briefly describe what this video covers..."
                                    />
                                </div>
                            </>
                        )}

                        {/* Text Specific */}
                        {item.type === 'text' && (
                            <div>
                                <label className="text-xs font-medium text-white/60 mb-1 block">Content</label>
                                <textarea
                                    value={item.content.question || ""} // reusing question field for text content
                                    onChange={(e) => updateContent("question", e.target.value)}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#B7FF00] outline-none resize-none font-mono"
                                    rows={5}
                                    placeholder="# Heading&#10;Write your lesson text here..."
                                />
                                <p className="text-[10px] text-white/30 mt-1">Supports basic Markdown</p>
                            </div>
                        )}

                        {/* Action (Exercise) Specific */}
                        {item.type === 'exercise' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-white/60 mb-2 block">Select Template</label>
                                    <TemplateSelector
                                        selectedTemplateId={item.content.correct_answer_index?.toString() || null} // Hacking this field to store ID
                                        onSelect={(id, template) => {
                                            // Storing as int if possible, or we need to change type?
                                            // Wait, IDs are UUIDs. I cannot store UUID in correct_answer_index (number).
                                            // I must use a string field. 'explanation' is a string field I can use for Template ID.
                                            // 'options[0]' can be Template Name.
                                            if (id && template) {
                                                const imageUrl = template.featured_image_url || template.image_url || template.media_url || "";
                                                updateContent("explanation", id);
                                                updateContent("options", [template.title, imageUrl]);
                                            } else {
                                                updateContent("explanation", "");
                                                updateContent("options", []);
                                            }
                                        }}
                                        visibilityFilter={["public", "learning_only"]}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-white/60 mb-1 block">Button Label</label>
                                        <input
                                            value={item.content.description || "Start Action"}
                                            onChange={(e) => updateContent("description", e.target.value)}
                                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#B7FF00] outline-none"
                                            placeholder="e.g. Create Now"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Celebration Specific */}
                        {item.type === 'celebration' && (
                            <div className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 text-sm">
                                <h4 className="font-bold text-pink-200 mb-1 flex items-center gap-2">
                                    <Sparkles size={14} />
                                    Celebration Animation
                                </h4>
                                <p className="text-white/60 text-xs">This block triggers a confetti application and the 'Lesson Completed' modal. It's usually the last item in the list.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function DroppableArea({ id, children, isEmpty }: { id: string, children: React.ReactNode, isEmpty: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`w-full transition-all duration-200 rounded-xl ${isOver
                ? "bg-[#B7FF00]/5 ring-2 ring-[#B7FF00]/30 min-h-[100px]"
                : isEmpty
                    ? "min-h-[200px] border-2 border-dashed border-white/10 bg-white/5"
                    : "min-h-[50px]"
                }`}
        >
            {children}
        </div>
    );
}


// --- Main Builder ---

type Props = {
    items: LessonContentItem[];
    onChange: (items: LessonContentItem[]) => void;
};

export default function LessonBuilder({ items, onChange }: Props) {
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveDragId(active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (!over) return;

        // Dropping a sidebar item onto the canvas
        if (active.data.current?.isSidebar) {
            const type = active.data.current.type as "video" | "text" | "exercise" | "celebration";
            const newItem: LessonContentItem = {
                id: crypto.randomUUID(),
                type,
                title: type === 'video' ? 'New Video' :
                    type === 'text' ? 'Information' :
                        type === 'exercise' ? 'Create Action' : 'Lesson Complete',
                order_index: items.length,
                content: type === 'video' ? { duration_seconds: 60 } :
                    type === 'text' ? { question: "" } :
                        type === 'exercise' ? { explanation: "", options: [], description: "Create Now" } : // explanation=template_id, options=[title, image]
                            { description: "Lesson Completed" },
                is_published: true
            };

            // If dropped on the placeholder or end of list
            if (over.id === 'canvas-droppable') {
                const newItems = [...items, newItem];
                onChange(newItems.map((item, idx) => ({ ...item, order_index: idx })));
            } else {
                // Insert after the hovered item
                const overItem = items.find(i => i.id === over.id);
                let newItems = [...items];
                if (overItem) {
                    const overIndex = items.indexOf(overItem);
                    newItems.splice(overIndex + 1, 0, newItem);
                } else {
                    newItems.push(newItem);
                }
                onChange(newItems.map((item, idx) => ({ ...item, order_index: idx })));
            }
            return;
        }

        // Reordering existing items
        if (active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newItems = arrayMove(items, oldIndex, newIndex);
                onChange(newItems.map((item, idx) => ({ ...item, order_index: idx })));
            }
        }
    };

    const updateItem = (id: string, updates: Partial<LessonContentItem>) => {
        onChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const deleteItem = (id: string) => {
        onChange(items.filter(item => item.id !== id).map((item, idx) => ({ ...item, order_index: idx })));
    };

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col lg:flex-row gap-8 items-start">

                {/* Toolbox Sidebar (Sticky) */}
                <div className="w-full lg:w-64 shrink-0 space-y-4 sticky top-6">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider px-1">Toolbox</h3>
                    <div className="space-y-3">
                        <SidebarItem
                            type="video"
                            label="Micro-Video"
                            icon={Video}
                            description="Short AI avatar video (45-75s)"
                        />
                        <SidebarItem
                            type="text"
                            label="Text Block"
                            icon={Type}
                            description="Rich text information"
                        />
                        <SidebarItem
                            type="exercise"
                            label="Create Action"
                            icon={Zap}
                            description="User template remix action"
                        />
                        <SidebarItem
                            type="celebration"
                            label="Celebration"
                            icon={Sparkles}
                            description="End of lesson confetti"
                        />
                    </div>
                </div>

                {/* Canvas Area (List) */}
                <div className="flex-1 w-full min-w-0">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Lesson Flow</h3>
                        <div className="text-xs text-white/40">
                            {items.length} items • ~{Math.ceil(items.reduce((acc, i) => acc + (i.content.duration_seconds || 0), 0) / 60)} min
                        </div>
                    </div>

                    <SortableContext items={items.map(i => i.id || '')} strategy={verticalListSortingStrategy}>
                        <DroppableArea id="canvas-droppable" isEmpty={items.length === 0}>
                            {items.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/30 py-12">
                                    <div className="p-4 rounded-full bg-white/5 mb-3">
                                        <Plus size={24} className="opacity-50" />
                                    </div>
                                    <p className="text-sm font-medium">Your lesson is empty</p>
                                    <p className="text-xs opacity-50">Drag items from the toolbox to start</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {items.map((item, index) => (
                                        <SortableCanvasItem
                                            key={item.id}
                                            id={item.id || ''}
                                            item={item}
                                            index={index}
                                            totalItems={items.length}
                                            onDelete={() => deleteItem(item.id!)}
                                            onUpdate={(updates) => updateItem(item.id!, updates)}
                                        />
                                    ))}
                                </div>
                            )}
                        </DroppableArea>
                    </SortableContext>
                </div>

            </div>

            <DragOverlay>
                {activeDragId ? (
                    <div className="p-4 bg-zinc-800 rounded-xl border border-[#B7FF00] shadow-2xl w-64 opacity-90 cursor-grabbing">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#B7FF00]/20 text-[#B7FF00]">
                                <Plus size={20} />
                            </div>
                            <span className="font-bold text-white">Adding Item...</span>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
