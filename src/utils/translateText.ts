export async function translateText(text: string, targetLang: "ar" | "en"): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Translation failed: ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
        throw new Error("Translation failed: unexpected response shape");
    }
    return data[0]
        .map((segment: unknown) => {
            if (!Array.isArray(segment) || typeof segment[0] !== "string") {
                throw new Error("Translation failed: unexpected response shape");
            }
            return segment[0];
        })
        .join("");
}

export function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

export function toLocalizedItems(items: unknown[]): { en: string; ar: string }[] {
    return (items || []).map((item: unknown) => {
        if (typeof item === "string") return { en: item, ar: "" };
        if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const name = record.name;
            if (name && typeof name === "object") {
                const localized = name as Record<string, unknown>;
                return { en: (localized.en as string) || "", ar: (localized.ar as string) || "" };
            }
            if (record.en !== undefined || record.ar !== undefined) {
                return { en: (record.en as string) || "", ar: (record.ar as string) || "" };
            }
            return { en: String(record.label || record.title || record.value || ""), ar: "" };
        }
        return { en: "", ar: "" };
    });
}

export function mergeLocalizedAr(item: unknown, ar: string): unknown {
    if (typeof item === "string") return { en: item, ar };
    if (!item || typeof item !== "object") return item;
    const record = item as Record<string, unknown>;
    const name = record.name;
    if (name && typeof name === "object") return { ...record, name: { ...(name as Record<string, unknown>), ar } };
    if (record.en !== undefined || record.ar !== undefined) return { ...record, ar };
    return record;
}