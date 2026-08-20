import { useEffect, useRef } from "react";
import { translateText } from "@/utils/translateText";

interface LocalizedValue {
    en?: string;
    ar?: string;
}

export function useAutoTranslateList(
    items: LocalizedValue[],
    onUpdate: (index: number, ar: string) => void,
    delay = 500,
): void {
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    const lastAutoFillRef = useRef<Record<number, string>>({});
    const lastSourceRef = useRef<Record<number, string>>({});
    const sequenceRef = useRef<Record<number, number>>({});

    useEffect(() => {
        const timeouts: ReturnType<typeof setTimeout>[] = [];
        items.forEach((item, index) => {
            const source = item.en?.trim() || "";
            if (!source) {
                delete lastAutoFillRef.current[index];
                delete lastSourceRef.current[index];
                delete sequenceRef.current[index];
                return;
            }

            const target = item.ar?.trim() || "";
            const lastFill = lastAutoFillRef.current[index] || "";
            const sourceChanged = (lastSourceRef.current[index] || "") !== source;
            lastSourceRef.current[index] = source;

            if (target === lastFill && !sourceChanged) return;
            if (target && target !== source && target !== lastFill) return;

            const seq = (sequenceRef.current[index] = (sequenceRef.current[index] || 0) + 1);
            const timeout = setTimeout(async () => {
                try {
                    const translated = await translateText(source, "ar");
                    if (seq !== sequenceRef.current[index]) return;
                    const current = itemsRef.current[index];
                    if (!current || (current.en?.trim() || "") !== source) return;
                    if ((current.ar?.trim() || "") !== target) return;
                    lastAutoFillRef.current[index] = translated;
                    onUpdateRef.current(index, translated);
                } catch {
                    // translation failures are non-fatal for the form
                }
            }, delay + index * 100);
            timeouts.push(timeout);
        });
        return () => timeouts.forEach((t) => clearTimeout(t));
    }, [items, delay]);
}