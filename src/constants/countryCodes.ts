export interface CountryCode {
    iso: string;
    dial: string; // without "+"
    en: string;
    ar: string;
}

// Egypt first (default), then MENA, then other common markets
export const countryCodes: CountryCode[] = [
    { iso: "EG", dial: "20", en: "Egypt", ar: "مصر" },
    { iso: "SA", dial: "966", en: "Saudi Arabia", ar: "السعودية" },
    { iso: "AE", dial: "971", en: "United Arab Emirates", ar: "الإمارات" },
    { iso: "KW", dial: "965", en: "Kuwait", ar: "الكويت" },
    { iso: "QA", dial: "974", en: "Qatar", ar: "قطر" },
    { iso: "BH", dial: "973", en: "Bahrain", ar: "البحرين" },
    { iso: "OM", dial: "968", en: "Oman", ar: "عُمان" },
    { iso: "JO", dial: "962", en: "Jordan", ar: "الأردن" },
    { iso: "LB", dial: "961", en: "Lebanon", ar: "لبنان" },
    { iso: "PS", dial: "970", en: "Palestine", ar: "فلسطين" },
    { iso: "SY", dial: "963", en: "Syria", ar: "سوريا" },
    { iso: "IQ", dial: "964", en: "Iraq", ar: "العراق" },
    { iso: "YE", dial: "967", en: "Yemen", ar: "اليمن" },
    { iso: "LY", dial: "218", en: "Libya", ar: "ليبيا" },
    { iso: "SD", dial: "249", en: "Sudan", ar: "السودان" },
    { iso: "TN", dial: "216", en: "Tunisia", ar: "تونس" },
    { iso: "DZ", dial: "213", en: "Algeria", ar: "الجزائر" },
    { iso: "MA", dial: "212", en: "Morocco", ar: "المغرب" },
    { iso: "TR", dial: "90", en: "Turkey", ar: "تركيا" },
    { iso: "GB", dial: "44", en: "United Kingdom", ar: "المملكة المتحدة" },
    { iso: "US", dial: "1", en: "United States / Canada", ar: "الولايات المتحدة / كندا" },
    { iso: "DE", dial: "49", en: "Germany", ar: "ألمانيا" },
    { iso: "FR", dial: "33", en: "France", ar: "فرنسا" },
    { iso: "IT", dial: "39", en: "Italy", ar: "إيطاليا" },
    { iso: "ES", dial: "34", en: "Spain", ar: "إسبانيا" },
    { iso: "NL", dial: "31", en: "Netherlands", ar: "هولندا" },
    { iso: "IN", dial: "91", en: "India", ar: "الهند" },
    { iso: "PK", dial: "92", en: "Pakistan", ar: "باكستان" },
    { iso: "CN", dial: "86", en: "China", ar: "الصين" },
];

export const DEFAULT_COUNTRY_ISO = "EG";

/** Joins a dial code and a local number into E.164 ("+201012345678"), dropping trunk zeros. */
export const toE164 = (iso: string, local: string): string => {
    const digits = local.replace(/\D/g, "").replace(/^0+/, "");
    if (!digits) return "";
    const country = countryCodes.find((c) => c.iso === iso) || countryCodes[0];
    return `+${country.dial}${digits}`;
};

/** Splits a stored phone ("+9665…", "00971…" or local "010…") into country + local part. */
export const splitPhone = (raw?: string): { iso: string; local: string } => {
    const value = (raw || "").trim();
    if (!value) return { iso: DEFAULT_COUNTRY_ISO, local: "" };

    const international = value.startsWith("+") || value.startsWith("00");
    if (international) {
        const digits = value.replace(/\D/g, "").replace(/^00/, "");
        // Longest dial code wins so "+971" isn't read as "+97" + "1…"
        const match = [...countryCodes].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial));
        if (match) return { iso: match.iso, local: digits.slice(match.dial.length) };
    }

    // No country code — treat as a local Egyptian number
    return { iso: DEFAULT_COUNTRY_ISO, local: value.replace(/\D/g, "").replace(/^0+/, "") };
};
