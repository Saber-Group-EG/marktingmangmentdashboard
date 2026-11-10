import { useState, type KeyboardEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { showConfirm } from "@/utils/swal";
import { useTypes, useCreateType, useUpdateType, useDeleteType } from "@/hooks/queries";
import type { ProjectType } from "@/api/requests/typesService";
import { ProjectTypeRow, type ProjectTypeRowLabels } from "./ProjectTypeRow";
import { getTypeKey } from "./projectTypeHelpers";

type ApiErrorShape = { response?: { data?: { message?: string } } };

const getApiErrorMessage = (error: unknown, fallback: string): string => {
    const message = (error as ApiErrorShape | null | undefined)?.response?.data?.message;
    return typeof message === "string" && message.trim() ? message : fallback;
};

const ProjectTypesPage = () => {
    const { t } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const [inputNameEn, setInputNameEn] = useState("");
    const [inputNameAr, setInputNameAr] = useState("");
    const [error, setError] = useState("");

    const { data: types, isLoading } = useTypes();
    const allTypes = types ?? [];

    const createMutation = useCreateType();
    const updateMutation = useUpdateType();
    const deleteMutation = useDeleteType();

    const isCreating = createMutation.isPending;
    const isBusy = isCreating || updateMutation.isPending || deleteMutation.isPending;

    const nameEnLabel = tr("project_type_name_en", "Name (English)");
    const nameArLabel = tr("project_type_name_ar", "Name (Arabic)");
    const requiredEn = tr("project_type_name_en_required", "English name is required");
    const requiredAr = tr("project_type_name_ar_required", "Arabic name is required");

    const rowLabels: ProjectTypeRowLabels = {
        nameEn: nameEnLabel,
        nameAr: nameArLabel,
        edit: tr("edit_project_type", "Edit Type"),
        remove: tr("delete", "Delete"),
        save: tr("save_changes", "Save"),
        cancel: tr("cancel", "Cancel"),
        requiredEn,
        requiredAr,
        missingId: tr("project_type_missing_id", "This type cannot be changed because it has no id."),
    };

    const handleAdd = () => {
        const nameEn = inputNameEn.trim();
        const nameAr = inputNameAr.trim();

        if (!nameEn) {
            setError(requiredEn);
            return;
        }
        if (!nameAr) {
            setError(requiredAr);
            return;
        }

        setError("");
        createMutation.mutate(
            { name: { en: nameEn, ar: nameAr } },
            {
                onSuccess: () => {
                    setInputNameEn("");
                    setInputNameAr("");
                },
                onError: (e: unknown) => setError(getApiErrorMessage(e, "Failed to create type")),
            },
        );
    };

    const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    const handleRowSave = async (id: string, name: { en: string; ar: string }): Promise<boolean> => {
        try {
            setError("");
            await updateMutation.mutateAsync({ id, data: { name } });
            return true;
        } catch (e: unknown) {
            setError(getApiErrorMessage(e, "Failed to update type"));
            return false;
        }
    };

    const remove = async (type: ProjectType) => {
        const confirmed = await showConfirm(
            tr("confirm_delete_project_type", "Delete this type?"),
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) return;

        const id = type._id || type.id;
        if (!id) {
            setError(rowLabels.missingId);
            return;
        }

        try {
            setError("");
            await deleteMutation.mutateAsync(id);
        } catch (e: unknown) {
            setError(getApiErrorMessage(e, "Failed to delete type"));
        }
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Portfolio Studio
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("project_types", "Project Types")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr(
                            "project_types_page_sub",
                            "Manage the technical types that describe the work done in projects.",
                        )}
                    </p>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">
                        {tr("total_types", "Total Types")}
                    </p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{allTypes.length}</p>
                </div>
            </section>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200"
                >
                    {error}
                </div>
            )}

            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-gradient-to-br from-light-50 via-white to-light-100/60 p-5 shadow-sm dark:border-dark-700/70 dark:from-dark-900/60 dark:via-dark-900/30 dark:to-dark-800/60 sm:p-6">
                <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-light-300/40 blur-3xl dark:bg-dark-700/40" />
                <div className="relative mb-5">
                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">
                        {tr("project_types_add", "Add Type")}
                    </h2>
                    <p className="text-sm text-light-600 dark:text-dark-300">
                        {tr("project_types_add_sub", "Create a new type shown on projects.")}
                    </p>
                </div>

                <div className="relative grid gap-4 lg:grid-cols-2">
                    <div>
                        <label
                            htmlFor="project-type-name-en"
                            className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300"
                        >
                            {nameEnLabel} <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="project-type-name-en"
                            value={inputNameEn}
                            onChange={(e) => setInputNameEn(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={nameEnLabel}
                            disabled={isBusy}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="project-type-name-ar"
                            className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300"
                        >
                            {nameArLabel} <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="project-type-name-ar"
                            value={inputNameAr}
                            onChange={(e) => setInputNameAr(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={nameArLabel}
                            disabled={isBusy}
                            dir="rtl"
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div className="flex items-end lg:col-span-2">
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={isBusy}
                            className="btn-primary h-[42px] w-full justify-center rounded-xl disabled:opacity-50 lg:w-auto lg:px-8"
                        >
                            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            <span>{tr("project_types_add", "Add Type")}</span>
                        </button>
                    </div>
                </div>
            </section>

            <div className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                <div className="mb-4">
                    <h2 className="text-light-900 dark:text-dark-50 text-lg font-semibold">
                        {tr("project_types_list", "All Types")}
                    </h2>
                </div>

                {isLoading ? (
                    <div role="status" className="flex items-center justify-center py-12">
                        <Loader2 className="text-light-500 h-8 w-8 animate-spin" />
                        <span className="sr-only">{tr("loading", "Loading...")}</span>
                    </div>
                ) : allTypes.length > 0 ? (
                    <div className="space-y-2">
                        {allTypes.map((type) => (
                            <ProjectTypeRow
                                key={getTypeKey(type)}
                                type={type}
                                isBusy={isBusy}
                                isSaving={updateMutation.isPending}
                                labels={rowLabels}
                                onSave={handleRowSave}
                                onRemove={remove}
                                onError={setError}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-light-600 dark:text-dark-300">
                        {tr("no_project_types", "No project types defined yet.")}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ProjectTypesPage;
