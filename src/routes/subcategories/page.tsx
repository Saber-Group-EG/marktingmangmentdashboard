import { useState, KeyboardEvent } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { showConfirm } from "@/utils/swal";
import { useSubcategories, useCreateSubcategory, useUpdateSubcategory, useDeleteSubcategory } from "@/hooks/queries";
import { useCategories } from "@/hooks/queries";
import { getSubcategoryDisplayName } from "@/api/requests/subcategoriesService";
import { getCategoryDisplayName } from "@/api/requests/categoriesService";
import type { Subcategory } from "@/api/requests/subcategoriesService";

const PAGE_SIZE = 10;

const SubcategoriesPage = () => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const { data: projectCategoriesResponse } = useCategories({ type: "project" });
    const projectCategories = projectCategoriesResponse?.categories || [];

    const [selectedParent, setSelectedParent] = useState("");
    const [inputName, setInputName] = useState("");
    const [inputNameAr, setInputNameAr] = useState("");
    const [editingId, setEditingId] = useState("");
    const [editingName, setEditingName] = useState("");
    const [editingNameAr, setEditingNameAr] = useState("");
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const { data: subcategoriesResponse, isLoading } = useSubcategories({
        parentCategory: selectedParent || undefined,
    });

    const allSubcategories = subcategoriesResponse?.subcategories || [];
    const totalPages = Math.max(1, Math.ceil(allSubcategories.length / PAGE_SIZE));

    const currentItems = allSubcategories.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    );

    const createMutation = useCreateSubcategory();
    const updateMutation = useUpdateSubcategory();
    const deleteMutation = useDeleteSubcategory();

    const isSaving = createMutation.isPending || updateMutation.isPending;

    const getPageNumbers = () => {
        const delta = 2;
        const range: (number | string)[] = [];
        const rangeWithDots: (number | string)[] = [];
        let l: number | undefined;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (const i of range) {
            if (l !== undefined) {
                if ((i as number) - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if ((i as number) - l !== 1) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            l = i as number;
        }

        return rangeWithDots;
    };

    const handleAdd = () => {
        const name = (inputName || "").trim();
        const nameAr = (inputNameAr || "").trim();
        if (!name || !nameAr) {
            setError(tr("subcategory_name_required", "Subcategory name is required in both languages"));
            return;
        }
        if (!selectedParent) {
            setError(tr("parent_required", "Please select a parent category"));
            return;
        }

        setError("");
        createMutation.mutate(
            { name: { en: name, ar: nameAr }, parentCategory: selectedParent },
            {
                onSuccess: () => {
                    setInputName("");
                    setInputNameAr("");
                },
                onError: (e: any) => {
                    setError(e?.response?.data?.message || "Failed to create subcategory");
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

    const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (editingId) saveEdit(editingId);
        }
    };

    const startEdit = (sub: Subcategory) => {
        setEditingId(sub._id);
        const name = sub.name;
        if (typeof name === "object" && name) {
            setEditingName(name.en || "");
            setEditingNameAr(name.ar || "");
        } else {
            setEditingName(typeof name === "string" ? name : "");
            setEditingNameAr("");
        }
    };

    const saveEdit = async (id: string) => {
        const name = (editingName || "").trim();
        const nameAr = (editingNameAr || "").trim();
        if (!name || !nameAr) {
            setError(tr("subcategory_name_required", "Subcategory name is required in both languages"));
            return;
        }

        try {
            setError("");
            await updateMutation.mutateAsync({
                id,
                data: { name: { en: name, ar: nameAr }, parentCategory: selectedParent },
            });
            setEditingId("");
            setEditingName("");
            setEditingNameAr("");
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to update subcategory");
        }
    };

    const cancelEdit = () => {
        setEditingId("");
        setEditingName("");
        setEditingNameAr("");
    };

    const remove = async (sub: Subcategory) => {
        const confirmed = await showConfirm(
            tr("confirm_delete_subcategory", "Delete this subcategory?"),
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) return;

        try {
            setError("");
            await deleteMutation.mutateAsync(sub._id);
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to delete subcategory");
        }
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Taxonomy Studio
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("subcategories", "Subcategories")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("manage_subcategories_sub", "Manage subcategories under project categories.")}
                    </p>
                </div>
            </section>

            <section className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                        {tr("select_parent_category", "Select Parent Category")}
                    </label>
                    <select
                        value={selectedParent}
                        onChange={(e) => setSelectedParent(e.target.value)}
                        className="input w-full"
                    >
                        <option value="">{tr("all_categories", "All Categories")}</option>
                        {projectCategories.map((cat: any) => (
                            <option key={cat._id} value={cat._id}>
                                {getCategoryDisplayName(cat, lang)}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="mb-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                        {error}
                    </div>
                )}

                {isLoading && allSubcategories.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-light-500" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {currentItems.length > 0 ? (
                                currentItems.map((sub) => (
                                    <div
                                        key={sub._id}
                                        className="group flex flex-col gap-3 rounded-2xl border border-light-200/80 bg-white px-4 py-3 text-light-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800 dark:text-dark-50 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="w-full min-w-0">
                                            {editingId === sub._id ? (
                                                <div className="flex flex-col gap-2">
                                                    <input
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onKeyDown={handleEditKeyDown}
                                                        className="input w-full"
                                                        placeholder={tr("subcategory_name", "Subcategory name")}
                                                    />
                                                    <input
                                                        value={editingNameAr}
                                                        onChange={(e) => setEditingNameAr(e.target.value)}
                                                        onKeyDown={handleEditKeyDown}
                                                        className="input w-full"
                                                        dir="rtl"
                                                        placeholder={tr("subcategory_name_ar", "اسم الفئة الفرعية (بالعربية)")}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-light-900 dark:text-dark-50 break-words text-sm font-semibold">
                                                        {getSubcategoryDisplayName(sub, lang)}
                                                    </span>
                                                    {selectedParent === "" && (
                                                        <span className="text-xs text-light-500 dark:text-dark-400">
                                                            ({projectCategories.find((c: any) => c._id === sub.parentCategory) ? getCategoryDisplayName(projectCategories.find((c: any) => c._id === sub.parentCategory), lang) : sub.parentCategory})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                                            {editingId === sub._id ? (
                                                <>
                                                    <button
                                                        onClick={() => saveEdit(sub._id)}
                                                        disabled={isSaving}
                                                        className="btn-ghost flex items-center gap-2 rounded-xl"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="btn-ghost flex items-center gap-2 rounded-xl"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(sub)}
                                                        className="btn-ghost flex items-center gap-2 rounded-xl"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => remove(sub)}
                                                        className="btn-ghost text-danger-500 flex items-center gap-2 rounded-xl"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-light-600 dark:text-dark-300">
                                    {selectedParent
                                        ? tr("no_subcategories_for_category", "No subcategories defined for this category yet.")
                                        : tr("no_subcategories_defined", "No subcategories defined yet.")}
                                </p>
                            )}
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between border-t border-light-200 pt-4 dark:border-dark-700">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="flex items-center gap-1 rounded-lg border border-light-200 px-3 py-1.5 text-sm font-medium text-light-700 transition-colors hover:bg-light-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800"
                                >
                                    {tr("previous", "Previous")}
                                </button>

                                <div className="flex items-center gap-1">
                                    {getPageNumbers().map((page, index) => (
                                        page === '...' ? (
                                            <span key={`dots-${index}`} className="px-2 text-light-500">
                                                ...
                                            </span>
                                        ) : (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page as number)}
                                                className={`min-w-[32px] rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                                                    currentPage === page
                                                        ? 'bg-primary-500 text-white shadow-sm'
                                                        : 'text-light-700 hover:bg-light-50 dark:text-dark-300 dark:hover:bg-dark-800'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        )
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="flex items-center gap-1 rounded-lg border border-light-200 px-3 py-1.5 text-sm font-medium text-light-700 transition-colors hover:bg-light-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800"
                                >
                                    {tr("next", "Next")}
                                </button>
                            </div>
                        )}
                    </>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                        value={inputName}
                        onChange={(e) => setInputName(e.target.value)}
                        onKeyDown={handleCreateKeyDown}
                        placeholder={tr("subcategory_name", "Subcategory name")}
                        disabled={isSaving || !selectedParent}
                        className="input w-full flex-1 disabled:opacity-50"
                    />
                    <input
                        value={inputNameAr}
                        onChange={(e) => setInputNameAr(e.target.value)}
                        onKeyDown={handleCreateKeyDown}
                        placeholder={tr("subcategory_name_ar", "اسم الفئة الفرعية (بالعربية)")}
                        disabled={isSaving || !selectedParent}
                        dir="rtl"
                        className="input w-full flex-1 disabled:opacity-50"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={isSaving || !selectedParent}
                        className="btn-primary h-[42px] min-w-[120px] justify-center rounded-xl disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {tr("add", "Add")}
                    </button>
                </div>
            </section>
        </div>
    );
};

export default SubcategoriesPage;
