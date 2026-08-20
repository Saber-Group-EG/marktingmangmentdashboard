import { useEffect, useRef } from "react";
import { translateText } from "@/utils/translateText";

export function useAutoTranslatePair(
    source: string,
    target: string,
    targetLang: "ar" | "en",
    apply: (translated: string) => void,
    delay = 500,
): void {
    const targetRef = useRef(target);
    targetRef.current = target;
    const applyRef = useRef(apply);
    applyRef.current = apply;

    const lastAutoFillRef = useRef("");
    const sequenceRef = useRef(0);

    useEffect(() => {
        const trimmed = source.trim();
        if (!trimmed) {
            lastAutoFillRef.current = "";
            return;
        }

        const targetAtStart = targetRef.current.trim();
        // legacy records copy the English text into the ar field as a placeholder,
        // so a target identical to the source is safe to overwrite
        const isPlaceholderCopy = targetAtStart !== "" && targetAtStart === trimmed;

        const seq = ++sequenceRef.current;
        const timeout = setTimeout(async () => {
            try {
                const translated = await translateText(trimmed, targetLang);
                if (seq !== sequenceRef.current) return;

                const currentTarget = targetRef.current.trim();
                const userEditedDuringFetch = currentTarget !== targetAtStart;
                const shouldApply =
                    currentTarget === "" ||
                    currentTarget === lastAutoFillRef.current ||
                    (isPlaceholderCopy && !userEditedDuringFetch);
                if (!shouldApply) return;

                lastAutoFillRef.current = translated;
                applyRef.current(translated);
            } catch {
                // translation failures are non-fatal for the form
            }
        }, delay);

        return () => {
            clearTimeout(timeout);
            // invalidate any in-flight translation so it cannot apply after unmount/change
            sequenceRef.current += 1;
        };
    }, [source, targetLang, delay]);
}