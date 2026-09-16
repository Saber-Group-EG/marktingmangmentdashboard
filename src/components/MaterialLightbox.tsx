import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface MaterialLightboxProps {
    url: string;
    label?: string;
    isVideo?: boolean;
    onClose: () => void;
}

const MaterialLightbox: React.FC<MaterialLightboxProps> = ({ url, label, isVideo, onClose }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleZoomIn = useCallback(() => {
        setScale((s) => Math.min(s + 0.5, 5));
    }, []);

    const handleZoomOut = useCallback(() => {
        setScale((s) => {
            const next = Math.max(s - 0.5, 1);
            if (next === 1) setPosition({ x: 0, y: 0 });
            return next;
        });
    }, []);

    const handleReset = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            setScale((s) => Math.min(s + 0.2, 5));
        } else {
            setScale((s) => {
                const next = Math.max(s - 0.2, 1);
                if (next === 1) setPosition({ x: 0, y: 0 });
                return next;
            });
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (scale <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    }, [scale, position]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPosition({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "+" || e.key === "=") handleZoomIn();
            if (e.key === "-") handleZoomOut();
            if (e.key === "0") handleReset();
        };
        window.addEventListener("keydown", handleKeyDown);

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose, handleZoomIn, handleZoomOut, handleReset]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90" onClick={onClose}>
            <div
                ref={containerRef}
                className="relative w-full h-full flex items-center justify-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
            >
                {isVideo ? (
                    <video
                        src={url}
                        className="max-w-[90vw] max-h-[85vh] rounded-lg"
                        controls
                        autoPlay
                        muted
                        playsInline
                    />
                ) : (
                    <img
                        src={url}
                        alt={label || "Material"}
                        className="select-none rounded-lg"
                        style={{
                            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                            transition: isDragging ? "none" : "transform 0.2s ease",
                            maxWidth: "90vw",
                            maxHeight: "85vh",
                            objectFit: "contain",
                        }}
                        draggable={false}
                    />
                )}
            </div>

            {/* Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-[71]">
                <button
                    onClick={handleZoomIn}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                    title="Zoom in (+)"
                >
                    <ZoomIn className="w-5 h-5" />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                    title="Zoom out (-)"
                >
                    <ZoomOut className="w-5 h-5" />
                </button>
                <button
                    onClick={handleReset}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                    title="Reset (0)"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                    title="Close (Esc)"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Label + zoom level */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-[71]">
                {label && (
                    <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm font-medium backdrop-blur-sm">
                        {label}
                    </span>
                )}
                <span className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs backdrop-blur-sm">
                    {Math.round(scale * 100)}%
                </span>
            </div>
        </div>
    );
};

export default MaterialLightbox;
