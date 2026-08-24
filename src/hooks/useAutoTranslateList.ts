import { useCallback, useRef, useState } from "react";
import { translateText } from "@/utils/translateText";

interface LocalizedValue {
    en?: string;
    ar?: string;
}

export function useAutoTranslateList(
    items: LocalizedValue[],
    onUpdate: (index: number, ar: string) => void,
): { translateAll: () => Promise<void>; isTranslating: boolean } {
    const [isTranslating, setIsTranslating] = useState(false);
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;
    const sequenceRef = useRef(0);

    const translateAll = useCallback(async () => {
        setIsTranslating(true);
        const seq = ++sequenceRef.current;
        try {
            const promises = itemsRef.current.map(async (item, index) => {
                const source = item.en?.trim() || "";
                if (!source) return;
                const currentAr = item.ar?.trim() || "";
                if (currentAr && currentAr !== source) return;
                try {
                    const translated = await translateText(source, "ar");
                    if (seq !== sequenceRef.current) return;
                    const current = itemsRef.current[index];
                    if (!current || (current.en?.trim() || "") !== source) return;
                    if ((current.ar?.trim() || "") !== currentAr) return;
                    onUpdateRef.current(index, translated);
                } catch {
                    // individual item translation failures are non-fatal
                }
            });
            await Promise.all(promises);
        } finally {
            if (seq === sequenceRef.current) {
                setIsTranslating(false);
            }
        }
    }, []);

    return { translateAll, isTranslating };
}
