import React from "react";
import { Globe } from "lucide-react";

interface BilingualTextProps {
    value: any;
    className?: string;
    separator?: "slash" | "dot" | "line";
    size?: "sm" | "md" | "lg";
}

const getEn = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value.en || value.ar || "";
    return "";
};

const getAr = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string") return "";
    if (typeof value === "object") return value.ar || "";
    return "";
};

const BilingualText: React.FC<BilingualTextProps> = ({
    value,
    className = "",
    separator = "slash",
    size = "md",
}) => {
    const en = getEn(value);
    const ar = getAr(value);

    if (!en && !ar) return <span className={className}>—</span>;
    if (en && !ar) return <span className={className}>{en}</span>;
    if (!en && ar) return <span className={className} dir="rtl">{ar}</span>;

    const sizeClasses = {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
    };

    const labelSizeClasses = {
        sm: "text-[10px]",
        md: "text-xs",
        lg: "text-xs",
    };

    return (
        <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
            <span className={`${sizeClasses[size]} text-light-900 dark:text-dark-50`}>
                {en}
            </span>
            <span className="text-light-300 dark:text-dark-600">|</span>
            <span className={`${sizeClasses[size]} text-light-700 dark:text-dark-200`} dir="rtl">
                {ar}
            </span>
        </div>
    );
};

export default BilingualText;
