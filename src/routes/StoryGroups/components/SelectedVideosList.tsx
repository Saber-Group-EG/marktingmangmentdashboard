import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock3, GripVertical, Loader2, X } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { cn } from "@/utils/cn";
import { getProxiedCoverUrl } from "@/utils/proxy";
import { getItemLabel, isPendingUpload, type DraftVideoItem } from "../utils/draftVideo";

interface SelectedVideosListProps {
    items: DraftVideoItem[];
    onChange: (items: DraftVideoItem[]) => void;
    disabled?: boolean;
}

const tr = (t: (key: string) => string, key: string, fallback: string): string => {
    const value = t(key);
    return !value || value === key ? fallback : value;
};

type SortableVideoRowProps = {
    item: DraftVideoItem;
    index: number;
    label: string;
    disabled: boolean;
    onRemove: (item: DraftVideoItem) => void;
};

const SortableVideoRow = ({ item, index, label, disabled, onRemove }: SortableVideoRowProps) => {
    const { t } = useLang();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.key,
        disabled,
    });

    const preview = item.thumbnail ? getProxiedCoverUrl(item.thumbnail, { width: 160, quality: 60 }) : item.previewUrl || item.url;
    const pending = isPendingUpload(item);

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.5 : 1,
                zIndex: isDragging ? 20 : undefined,
            }}
            className="border-light-200 dark:border-dark-700 dark:bg-dark-900 flex items-center gap-3 rounded-xl border bg-white px-3 py-2"
        >
            <button
                type="button"
                aria-label={tr(t, "reorder_video", "Reorder video")}
                disabled={disabled}
                {...attributes}
                {...listeners}
                className={cn(
                    "text-light-500 dark:text-dark-400 shrink-0 touch-none rounded-lg p-1.5",
                    disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing",
                )}
            >
                <GripVertical size={16} />
            </button>

            <span className="text-light-500 dark:text-dark-400 w-6 shrink-0 text-center text-xs font-semibold">{index + 1}</span>

            <span className="bg-dark-950 h-11 w-16 shrink-0 overflow-hidden rounded-lg">
                {preview ? (
                    item.thumbnail ? (
                        <img
                            src={preview}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <video
                            src={preview}
                            preload="metadata"
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                        />
                    )
                ) : (
                    <span className="text-light-400 dark:text-dark-500 flex h-full w-full items-center justify-center">
                        <Loader2
                            size={14}
                            className="animate-spin"
                        />
                    </span>
                )}
            </span>

            <span className="min-w-0 flex-1">
                <span className="text-light-900 dark:text-dark-50 block truncate text-sm font-medium">{label}</span>
                {pending ? (
                    <span className="text-danger-500 mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium">
                        <Clock3 size={11} />
                        {tr(t, "pending_upload", "Pending upload")}
                    </span>
                ) : (
                    <span className="text-light-500 dark:text-dark-400 mt-0.5 block truncate text-[11px]">{item.url}</span>
                )}
            </span>

            <button
                type="button"
                onClick={() => onRemove(item)}
                disabled={disabled}
                aria-label={tr(t, "remove_video", "Remove video")}
                className="btn-ghost text-danger-500 shrink-0 rounded-lg p-1.5 disabled:opacity-40"
            >
                <X size={16} />
            </button>
        </li>
    );
};

const SelectedVideosList = ({ items, onChange, disabled = false }: SelectedVideosListProps) => {
    const { t } = useLang();
    const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id || disabled) return;
        const oldIndex = items.findIndex((item) => item.key === active.id);
        const newIndex = items.findIndex((item) => item.key === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onChange(arrayMove(items, oldIndex, newIndex));
    };

    const handleRemove = (target: DraftVideoItem) => {
        onChange(items.filter((row) => row.key !== target.key));
    };

    if (items.length === 0) {
        return (
            <p className="border-light-300 text-light-600 dark:border-dark-600 dark:text-dark-300 rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
                {tr(t, "no_videos_selected", "No videos selected yet.")}
            </p>
        );
    }

    return (
        <DndContext
            sensors={dragSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map((item) => item.key)}
                strategy={verticalListSortingStrategy}
            >
                <ul className="space-y-2">
                    {items.map((item, index) => (
                        <SortableVideoRow
                            key={item.key}
                            item={item}
                            index={index}
                            label={getItemLabel(item, tr(t, "video", "Video"))}
                            disabled={disabled}
                            onRemove={handleRemove}
                        />
                    ))}
                </ul>
            </SortableContext>
        </DndContext>
    );
};

export default SelectedVideosList;
