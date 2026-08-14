import React from "react";
import { Loader2, UploadCloud } from "lucide-react";

interface UploadProgressOverlayProps {
    open: boolean;
    progress: number;
    estimatedSecondsLeft: number | null;
    title?: string;
    label?: string;
}

const formatTimeShort = (secs: number) => {
    const s = Math.max(0, Math.round(secs || 0));
    if (s === 0) return "0s";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
};

const UploadProgressOverlay: React.FC<UploadProgressOverlayProps> = ({
    open,
    progress,
    estimatedSecondsLeft,
    title = "Uploading photo...",
    label = "",
}) => {
    if (!open) return null;

    const pct = Math.max(0, Math.min(100, Math.round(progress || 0)));

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ zIndex: 9999 }}>
            <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full p-6">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 shrink-0">
                        <Loader2 className="w-10 h-10 text-light-500 dark:text-secdark-500 animate-spin" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-light-900 dark:text-dark-50 truncate">{title}</h3>
                        {label && (
                            <div className="mt-0.5 text-sm text-light-600 dark:text-dark-400 truncate">{label}</div>
                        )}
                    </div>
                </div>

                <div className="mt-4 w-full bg-light-100 dark:bg-dark-700 h-3 rounded-full overflow-hidden">
                    <div
                        className="h-3 bg-light-500 dark:bg-secdark-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                    />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-light-500 dark:text-dark-400">
                    <div className="inline-flex items-center gap-1.5">
                        <UploadCloud className="w-3.5 h-3.5" />
                        {pct}%
                    </div>
                    <div>
                        {pct >= 100
                            ? "Done"
                            : estimatedSecondsLeft !== null
                                ? `${formatTimeShort(estimatedSecondsLeft)} remaining`
                                : "Estimating..."}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadProgressOverlay;
