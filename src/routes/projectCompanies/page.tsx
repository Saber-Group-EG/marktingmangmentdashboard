import { useState, KeyboardEvent } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2, Building2 } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { showConfirm } from "@/utils/swal";
import { useProjectCompanies, useCreateProjectCompany, useUpdateProjectCompany, useDeleteProjectCompany } from "@/hooks/queries";
import type { ProjectCompany } from "@/api/requests/projectCompaniesService";

const getCompanyNameEn = (company: ProjectCompany): string => {
    const name = company.name;
    if (!name) return "";
    return typeof name === "string" ? name : name.en || "";
};

const getCompanyNameAr = (company: ProjectCompany): string => {
    const name = company.name;
    if (!name) return "";
    return typeof name === "string" ? "" : name.ar || "";
};

const ProjectCompaniesPage = () => {
    const { t } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    // Add form states
    const [inputNameEn, setInputNameEn] = useState("");
    const [inputNameAr, setInputNameAr] = useState("");

    // Edit modal states
    const [editingCompany, setEditingCompany] = useState<ProjectCompany | null>(null);
    const [editNameEn, setEditNameEn] = useState("");
    const [editNameAr, setEditNameAr] = useState("");

    const [error, setError] = useState("");

    const { data: companies, isLoading } = useProjectCompanies();
    const allCompanies = companies || [];

    const createProjectCompanyMutation = useCreateProjectCompany();
    const updateProjectCompanyMutation = useUpdateProjectCompany();
    const deleteProjectCompanyMutation = useDeleteProjectCompany();

    const isSaving = createProjectCompanyMutation.isPending || updateProjectCompanyMutation.isPending;

    const handleAdd = () => {
        const nameEn = (inputNameEn || "").trim();
        const nameAr = (inputNameAr || "").trim();

        if (!nameEn) {
            setError(tr("project_company_name_en_required", "English name is required"));
            return;
        }
        if (!nameAr) {
            setError(tr("project_company_name_ar_required", "Arabic name is required"));
            return;
        }

        setError("");
        createProjectCompanyMutation.mutate(
            { name: { en: nameEn, ar: nameAr } },
            {
                onSuccess: () => {
                    setInputNameEn("");
                    setInputNameAr("");
                },
                onError: (e: any) => {
                    setError(e?.response?.data?.message || "Failed to create company");
                },
            },
        );
    };

    const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    const openEditModal = (company: ProjectCompany) => {
        setEditingCompany(company);
        setEditNameEn(getCompanyNameEn(company));
        setEditNameAr(getCompanyNameAr(company));
        setError("");
    };

    const closeEditModal = () => {
        setEditingCompany(null);
        setEditNameEn("");
        setEditNameAr("");
        setError("");
    };

    const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveEdit();
        }
    };

    const saveEdit = async () => {
        const nameEn = (editNameEn || "").trim();
        const nameAr = (editNameAr || "").trim();

        if (!nameEn) {
            setError(tr("project_company_name_en_required", "English name is required"));
            return;
        }
        if (!nameAr) {
            setError(tr("project_company_name_ar_required", "Arabic name is required"));
            return;
        }
        if (!editingCompany) return;

        try {
            setError("");
            await updateProjectCompanyMutation.mutateAsync({
                id: editingCompany._id,
                data: { name: { en: nameEn, ar: nameAr } },
            });
            closeEditModal();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to update company");
        }
    };

    const remove = async (company: ProjectCompany) => {
        const confirmed = await showConfirm(
            tr("confirm_delete_project_company", "Delete this company?"),
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) return;

        try {
            setError("");
            await deleteProjectCompanyMutation.mutateAsync(company._id);
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to delete company");
        }
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Portfolio Studio
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("Project Company", "Project Company")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("cast_company_page_sub", "Manage companies shown on projects.")}
                    </p>
                </div>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_companies", "Total Companies")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{allCompanies.length}</p>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                    {error}
                </div>
            )}

            {/* Add Company Form Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-gradient-to-br from-light-50 via-white to-light-100/60 p-5 shadow-sm dark:border-dark-700/70 dark:from-dark-900/60 dark:via-dark-900/30 dark:to-dark-800/60 sm:p-6">
                <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-light-300/40 blur-3xl dark:bg-dark-700/40" />
                <div className="relative mb-5">
                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("project_company_add", "Add Company")}</h2>
                    <p className="text-sm text-light-600 dark:text-dark-300">
                        {tr("project_company_add_sub", "Create a new company shown on projects.")}
                    </p>
                </div>

                <div className="relative grid gap-4 lg:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("project_company_name_en", "Name (English)")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={inputNameEn}
                            onChange={(e) => setInputNameEn(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={tr("project_company_name_en", "Name (English)")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("project_company_name_ar", "Name (Arabic)")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={inputNameAr}
                            onChange={(e) => setInputNameAr(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={tr("project_company_name_ar", "Name (Arabic)")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                            dir="rtl"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={handleAdd}
                            disabled={isSaving}
                            className="btn-primary h-[42px] w-full justify-center rounded-xl disabled:opacity-50 lg:w-auto lg:px-8"
                        >
                            {isSaving ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Plus size={16} />
                            )}
                            <span>{tr("project_company_add", "Add Company")}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Companies List Section */}
            <div className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                <div className="mb-4">
                    <h2 className="text-light-900 dark:text-dark-50 text-lg font-semibold">{tr("project_companies", "Project Companies")}</h2>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-light-500 h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {allCompanies.length > 0 ? (
                            allCompanies.map((company) => {
                                const nameEn = getCompanyNameEn(company);
                                const nameAr = getCompanyNameAr(company);
                                return (
                                    <div
                                        key={company._id}
                                        className="group flex flex-col gap-3 rounded-2xl border border-light-200/80 bg-white px-4 py-3 text-light-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800 dark:text-dark-50 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex w-full min-w-0 flex-col gap-1">
                                            <span className="flex items-center gap-2 text-sm font-semibold break-words">
                                                <Building2 size={16} className="shrink-0 text-light-500 dark:text-dark-400" />
                                                {nameEn}
                                            </span>
                                            {nameAr && (
                                                <span dir="rtl" className="text-sm break-words text-light-600 dark:text-dark-300">
                                                    {nameAr}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                                            <button
                                                onClick={() => openEditModal(company)}
                                                className="btn-ghost flex items-center gap-2 rounded-xl"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => remove(company)}
                                                className="btn-ghost text-danger-500 flex items-center gap-2 rounded-xl"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-light-600 dark:text-dark-300">
                                {tr("no_project_companies", "No project companies defined yet.")}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Company Modal */}
            {editingCompany && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeEditModal();
                    }}
                >
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-dark-800">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-light-200 px-6 py-4 dark:border-dark-700">
                            <div>
                                <h3 className="text-xl font-semibold text-light-900 dark:text-dark-50">
                                    {tr("edit_company", "Edit Company")}
                                </h3>
                                <p className="mt-1 text-sm text-light-500 dark:text-dark-400">
                                    {tr("edit_company_sub", "Update company details")}
                                </p>
                            </div>
                            <button
                                onClick={closeEditModal}
                                className="rounded-lg p-1 text-light-400 hover:bg-light-100 hover:text-light-600 dark:text-dark-500 dark:hover:bg-dark-700 dark:hover:text-dark-300"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
                            {error && (
                                <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("project_company_name_en", "Name (English)")} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        value={editNameEn}
                                        onChange={(e) => setEditNameEn(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                        placeholder={tr("project_company_name_en", "Name (English)")}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("project_company_name_ar", "Name (Arabic)")} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        value={editNameAr}
                                        onChange={(e) => setEditNameAr(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                        placeholder={tr("project_company_name_ar", "Name (Arabic)")}
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 border-t border-light-200 px-6 py-4 dark:border-dark-700">
                            <button
                                onClick={closeEditModal}
                                className="rounded-lg border border-light-300 px-4 py-2 text-sm font-medium text-light-700 transition-colors hover:bg-light-50 dark:border-dark-600 dark:text-dark-300 dark:hover:bg-dark-700"
                            >
                                {tr("cancel", "Cancel")}
                            </button>
                            <button
                                onClick={saveEdit}
                                disabled={isSaving}
                                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>{tr("saving", "Saving...")}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Check size={16} />
                                        <span>{tr("save_changes", "Save Changes")}</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectCompaniesPage;
