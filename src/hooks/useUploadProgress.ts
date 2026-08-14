import { useCallback, useEffect, useRef, useState } from "react";

interface UploadProgressOptions<T> {
    title?: string;
    label?: string;
    task: (report: (percent: number) => void) => Promise<T>;
}

export const useUploadProgress = () => {
    const [open, setOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [estimatedSecondsLeft, setEstimatedSecondsLeft] = useState<number | null>(null);
    const [label, setLabel] = useState("");
    const [title, setTitle] = useState("");
    const tickerRef = useRef<number | null>(null);
    const startRef = useRef(0);
    const lastPercentRef = useRef(0);

    const clearTicker = () => {
        if (tickerRef.current !== null) {
            window.clearInterval(tickerRef.current);
            tickerRef.current = null;
        }
    };

    useEffect(() => clearTicker, []);

    const stop = useCallback(() => {
        clearTicker();
        setOpen(false);
        setProgress(0);
        setEstimatedSecondsLeft(null);
    }, []);

    const run = useCallback(async <T,>(options: UploadProgressOptions<T>): Promise<T> => {
        clearTicker();
        lastPercentRef.current = 0;
        setTitle(options.title || "Uploading photo...");
        setLabel(options.label || "");
        setProgress(0);
        setEstimatedSecondsLeft(null);
        setOpen(true);
        startRef.current = Date.now();

        const updateEta = (percent: number) => {
            const elapsed = (Date.now() - startRef.current) / 1000;
            const speed = percent / Math.max(elapsed, 0.2);
            const remaining = 100 - percent;
            setEstimatedSecondsLeft(remaining > 0 ? Math.max(1, Math.round(remaining / Math.max(speed, 1))) : 0);
        };

        tickerRef.current = window.setInterval(() => {
            const elapsed = (Date.now() - startRef.current) / 1000;
            const simulated = 92 * (1 - Math.exp(-elapsed / 2.5));
            const current = Math.max(lastPercentRef.current, Math.round(simulated));
            setProgress(current);
            updateEta(current);
        }, 250);

        const report = (percent: number) => {
            lastPercentRef.current = Math.max(lastPercentRef.current, Math.min(percent, 92));
            const value = Math.round(lastPercentRef.current);
            setProgress(value);
            updateEta(value);
        };

        try {
            const result = await options.task(report);
            clearTicker();
            setProgress(100);
            setEstimatedSecondsLeft(0);
            setLabel(options.label ? `${options.label} — complete` : "Upload complete");
            await new Promise((resolve) => setTimeout(resolve, 500));
            setOpen(false);
            return result;
        } catch (error) {
            clearTicker();
            setOpen(false);
            throw error;
        }
    }, []);

    return { open, progress, estimatedSecondsLeft, label, title, run, stop };
};
