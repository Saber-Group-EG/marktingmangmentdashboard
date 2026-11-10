import { useState, type KeyboardEvent } from "react";
import { Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import type { ProjectType } from "@/api/requests/typesService";
import { getTypeNameAr, getTypeNameEn } from "./projectTypeHelpers";

export type ProjectTypeRowLabels = {
    nameEn: string;
    nameAr: string;
    edit: string;
    remove: string;
    save: string;
    cancel: string;
    requiredEn: string;
    requiredAr: string;
    missingId: string;
};

type ProjectTypeRowProps = {
    type: ProjectType;
    isBusy: boolean;
    isSaving: boolean;
    labels: ProjectTypeRowLabels;
    onSave: (id: string, name: { en: string; ar: string }) => Promise<boolean>;
    onRemove: (type: ProjectType) => void;
    onError: (message: string) => void;
};

export const ProjectTypeRow = ({ type, isBusy, isSaving, labels, onSave, onRemove, onError }: ProjectTypeRowProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [nameEn, setNameEn] = useState("");
    const [nameAr, setNameAr] = useState("");

    const startEdit = () => {
        setNameEn(getTypeNameEn(type));
        setNameAr(getTypeNameAr(type));
        setIsEditing(true);
        onError("");
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setNameEn("");
        setNameAr("");
    };

    const save = async () => {
        const trimmedEn = nameEn.trim();
        const trimmedAr = nameAr.trim();

        if (!trimmedEn) {
            onError(labels.requiredEn);
            return;
        }
        if (!trimmedAr) {
            onError(labels.requiredAr);
            return;
        }

        const id = type._id || type.id;
        if (!id) {
            onError(labels.missingId);
            return;
        }

        const saved = await onSave(id, { en: trimmedEn, ar: trimmedAr });
        if (saved) cancelEdit();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            void save();
        }
    };

    return (
        <div className="group flex flex-col gap-3 rounded-2xl border border-light-200/80 bg-white px-4 py-3 text-light-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800 dark:text-dark-50 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full min-w-0">
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        <input
                            value={nameEn}
                            onChange={(e) => setNameEn(e.target.value)}
                            onKeyDown={handleKeyDown}
                            aria-label={labels.nameEn}
                            placeholder={labels.nameEn}
                            className="input w-full"
                        />
                        <input
                            value={nameAr}
                            onChange={(e) => setNameAr(e.target.value)}
                            onKeyDown={handleKeyDown}
                            aria-label={labels.nameAr}
                            placeholder={labels.nameAr}
                            dir="rtl"
                            className="input w-full"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <span className="text-light-900 dark:text-dark-50 break-words text-sm font-semibold">
                            {getTypeNameEn(type)}
                        </span>
                        {getTypeNameAr(type) && (
                            <span dir="rtl" className="break-words text-sm text-light-600 dark:text-dark-300">
                                {getTypeNameAr(type)}
                            </span>
                        )}
                    </div>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                {isEditing ? (
                    <>
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={isBusy}
                            aria-label={labels.save}
                            title={labels.save}
                            className="btn-ghost flex items-center gap-2 rounded-xl disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isBusy}
                            aria-label={labels.cancel}
                            title={labels.cancel}
                            className="btn-ghost flex items-center gap-2 rounded-xl disabled:opacity-50"
                        >
                            <X size={14} />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={startEdit}
                            disabled={isBusy}
                            aria-label={labels.edit}
                            title={labels.edit}
                            className="btn-ghost flex items-center gap-2 rounded-xl disabled:opacity-50"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(type)}
                            disabled={isBusy}
                            aria-label={labels.remove}
                            title={labels.remove}
                            className="btn-ghost text-danger-500 flex items-center gap-2 rounded-xl disabled:opacity-50"
                        >
                            <Trash2 size={14} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
