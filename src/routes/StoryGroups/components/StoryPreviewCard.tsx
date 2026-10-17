import { useLang } from "@/hooks/useLang";
import { cn } from "@/utils/cn";
import { getProxiedCoverUrl } from "@/utils/proxy";

interface StoryPreviewCardProps {
    title: string;
    videoCount: number;
    coverUrl?: string;
    className?: string;
}

const tr = (t: (key: string) => string, key: string, fallback: string): string => {
    const value = t(key);
    return !value || value === key ? fallback : value;
};

/**
 * Instagram-style story card. The top segment count is driven by the amount of
 * videos in the group so the bar grows as videos are added.
 */
const StoryPreviewCard = ({ title, videoCount, coverUrl, className }: StoryPreviewCardProps) => {
    const { t } = useLang();
    const displayTitle = title || tr(t, "untitled_story_group", "Untitled");
    const cover = coverUrl ? getProxiedCoverUrl(coverUrl, { width: 640, quality: 70 }) : "";
    const initial = displayTitle.trim().charAt(0).toUpperCase();

    return (
        <div className={cn("bg-dark-950 relative aspect-[9/16] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/10", className)}>
            {cover ? (
                <img
                    src={cover}
                    alt={displayTitle}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                />
            ) : (
                <div className="from-dark-800 via-dark-900 absolute inset-0 bg-gradient-to-br to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/85" />

            {videoCount > 0 && (
                <div className="absolute inset-x-0 top-0 flex gap-1 p-2.5">
                    {Array.from({ length: videoCount }, (_, index) => (
                        <span
                            key={index}
                            className={cn("h-1 min-w-1 flex-1 rounded-full", index === 0 ? "bg-white" : "bg-white/35")}
                        />
                    ))}
                </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-white/70 uppercase">
                    {tr(t, "story_card_created_by", "Created by")} · {t("app_name")}
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-[11px] font-bold text-white ring-1 ring-white/60">
                        {cover ? (
                            <img
                                src={cover}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span>{initial}</span>
                        )}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white">{displayTitle}</span>
                        <span className="block truncate text-[11px] text-white/75">
                            {tr(t, "story_card_reel", "Reel")} · {videoCount} {tr(t, "story_card_videos", "videos")}
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default StoryPreviewCard;
