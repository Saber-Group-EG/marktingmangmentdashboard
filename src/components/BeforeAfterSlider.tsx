import React, { useRef, useState } from "react";

interface BeforeAfterSliderProps {
    beforeUrl?: string;
    afterUrl?: string;
    beforeLabel?: string;
    afterLabel?: string;
    className?: string;
    mediaClassName?: string;
    showSlider?: boolean;
}

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
    beforeUrl,
    afterUrl,
    beforeLabel = "Before",
    afterLabel = "After",
    className = "",
    mediaClassName = "aspect-square w-full",
    showSlider = true,
}) => {
    const [position, setPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const hasBothImages = Boolean(beforeUrl && afterUrl);
    const mediaRef = useRef<HTMLDivElement | null>(null);

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    const setPositionFromClientX = (clientX: number) => {
        if (!mediaRef.current) return;
        const rect = mediaRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;
        const pct = ((clientX - rect.left) / rect.width) * 100;
        setPosition(clamp(pct, 0, 100));
    };

    const handleDragStart = (e: React.PointerEvent) => {
        if (!hasBothImages) return;
        e.preventDefault();
        e.stopPropagation();
        mediaRef.current?.setPointerCapture?.(e.pointerId);
        setIsDragging(true);
        setPositionFromClientX(e.clientX);
    };

    const handleDragMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setPositionFromClientX(e.clientX);
    };

    const handleDragEnd = (e: React.PointerEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        mediaRef.current?.releasePointerCapture?.(e.pointerId);
        setIsDragging(false);
    };

    if (!hasBothImages) {
        return (
            <div className={className}>
                <div className={`relative overflow-hidden bg-light-100 dark:bg-dark-700 ${mediaClassName}`}>
                    {beforeUrl ? (
                        <img src={beforeUrl} alt={beforeLabel} className="w-full h-full object-cover" />
                    ) : afterUrl ? (
                        <img src={afterUrl} alt={afterLabel} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-light-500 dark:text-dark-400">
                            No images
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div
                ref={mediaRef}
                className={`relative overflow-hidden bg-light-100 dark:bg-dark-700 ${mediaClassName}`}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerLeave={handleDragEnd}
                onPointerCancel={handleDragEnd}
            >
                <img
                    src={afterUrl}
                    alt={afterLabel}
                    className="absolute inset-0 h-full w-full object-cover"
                />

                <img
                    src={beforeUrl}
                    alt={beforeLabel}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                />

                <div
                    className="absolute inset-y-0 z-10 cursor-ew-resize"
                    style={{ left: `calc(${position}% - 1px)` }}
                    onPointerDown={handleDragStart}
                >
                    <div className="h-full w-0.5 bg-white/90 shadow" />
                    <div
                        className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white text-sm font-bold text-gray-700 shadow-lg select-none"
                        style={{ touchAction: "none" }}
                    >
                        &#8596;
                    </div>
                </div>

                <div className="absolute top-3 left-3 z-10 rounded bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
                    {beforeLabel}
                </div>
                <div className="absolute top-3 right-3 z-10 rounded bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
                    {afterLabel}
                </div>
            </div>

            {showSlider && (
                <div className="mt-2 px-1">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={position}
                        onChange={(e) => setPosition(Number(e.target.value))}
                        className="w-full accent-light-500 dark:accent-secdark-500"
                        aria-label="Before and after slider"
                    />
                </div>
            )}
        </div>
    );
};

export default BeforeAfterSlider;
