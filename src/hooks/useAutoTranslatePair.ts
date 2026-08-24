import { useCallback, useRef, useState } from "react";
import { translateText } from "@/utils/translateText";

export function useAutoTranslatePair(
    source: string,
    target: string,
    targetLang: "ar" | "en",
    apply: (translated: string) => void,
): { translate: () => Promise<void>; isTranslating: boolean } {
    const [isTranslating, setIsTranslating] = useState(false);
    const targetRef = useRef(target);
    targetRef.current = target;
    const applyRef = useRef(apply);
    applyRef.current = apply;
    const sequenceRef = useRef(0);

    const translate = useCallback(async () => {
        const trimmed = source.trim();
        if (!trimmed) return;

        setIsTranslating(true);
        const seq = ++sequenceRef.current;
        try {
            const translated = await translateText(trimmed, targetLang);
            if (seq !== sequenceRef.current) return;
            applyRef.current(translated);
        } catch {
            // translation failures are non-fatal for the form
        } finally {
            if (seq === sequenceRef.current) {
                setIsTranslating(false);
            }
        }
    }, [source, targetLang]);

    return { translate, isTranslating };
}
