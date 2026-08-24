import React from "react";
import { Languages, Loader2 } from "lucide-react";

interface TranslateButtonProps {
    onClick: () => void;
    isTranslating: boolean;
    disabled?: boolean;
    label?: string;
    className?: string;
}

const TranslateButton: React.FC<TranslateButtonProps> = ({
    onClick,
    isTranslating,
    disabled = false,
    label = "Translate",
    className = "",
}) => {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || isTranslating}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md
                bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
            title={label}
        >
            {isTranslating ? (
                <Loader2 size={12} className="animate-spin" />
            ) : (
                <Languages size={12} />
            )}
            {label}
        </button>
    );
};

export default TranslateButton;
