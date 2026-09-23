import React from "react";
import { X } from "lucide-react";
import { PROJECT_ICONS, PROJECT_ICON_NAMES } from "@/constants/projectIcons";

interface IconPickerProps {
    value?: string | null;
    onChange: (name: string) => void;
    noneLabel?: string;
}

const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, noneLabel = "None" }) => {
    const idleClass =
        "w-9 h-9 flex items-center justify-center rounded-lg border text-light-600 dark:text-dark-300 transition-colors";
    const activeClass =
        "w-9 h-9 flex items-center justify-center rounded-lg border-2 border-light-500 bg-light-500 text-white shadow-md shadow-light-500/30 dark:border-secdark-700 dark:bg-secdark-700 dark:shadow-secdark-700/40 transition-colors";
    const baseBorder = "border-light-200 dark:border-dark-600";
    const hoverClass =
        "hover:border-light-500 hover:text-light-500 dark:hover:border-secdark-500 dark:hover:text-secdark-400";

    return (
        <div className="border border-light-200 dark:border-dark-600 rounded-lg p-3 bg-light-50 dark:bg-dark-800/50">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => onChange("")}
                    title={noneLabel}
                    aria-label={noneLabel}
                    aria-pressed={!value}
                    className={!value ? activeClass : `${idleClass} ${baseBorder} hover:border-light-400 dark:hover:border-dark-500`}
                >
                    <X className="w-4 h-4" />
                </button>
                {PROJECT_ICON_NAMES.map((name) => {
                    const Icon = PROJECT_ICONS[name];
                    if (!Icon) return null;
                    const selected = value === name;
                    return (
                        <button
                            key={name}
                            type="button"
                            onClick={() => onChange(name)}
                            title={name}
                            aria-label={name}
                            aria-pressed={selected}
                            className={
                                selected
                                    ? activeClass
                                    : `${idleClass} ${baseBorder} ${hoverClass}`
                            }
                        >
                            <Icon className="w-5 h-5" />
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-light-500 dark:text-dark-400">
                {value ? value : noneLabel}
            </div>
        </div>
    );
};

export default IconPicker;
