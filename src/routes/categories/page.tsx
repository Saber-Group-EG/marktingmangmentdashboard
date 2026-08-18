import { useState, KeyboardEvent, useEffect } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2, Layers, Package as PackageIcon, FileSignature, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { showConfirm } from "@/utils/swal";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/queries";
import { getCategories, getCategoryDisplayName } from "@/api/requests/categoriesService";
import type { Category, CategoryType } from "@/api/requests/categoriesService";

type CategorySectionProps = {
    type: CategoryType;
    title: string;
    subtitle: string;
    Icon: typeof Layers;
};

const PAGE_SIZE = 10;

const CategorySection = ({ type, title, subtitle, Icon }: CategorySectionProps) => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const [inputName, setInputName] = useState("");
    const [inputNameAr, setInputNameAr] = useState("");
    const [editingId, setEditingId] = useState("");
    const [editingName, setEditingName] = useState("");
    const [editingNameAr, setEditingNameAr] = useState("");
    const [error, setError] = useState("");
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
    const [totalPages, setTotalPages] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Fetch initial pages (1 and 2)
    const { data: page1Data, isLoading: isLoadingPage1 } = useCategories({ type, page: 1 });
    const { data: page2Data, isLoading: isLoadingPage2 } = useCategories({ type, page: 2 });
    
    const isLoading = isLoadingPage1 || isLoadingPage2;

    const createCategoryMutation = useCreateCategory();
    const updateCategoryMutation = useUpdateCategory();
    const deleteCategoryMutation = useDeleteCategory();

    const isSaving = createCategoryMutation.isPending || updateCategoryMutation.isPending;

    // Load initial pages
    useEffect(() => {
        if (page1Data && !loadedPages.has(1)) {
            setAllCategories(prev => {
                const existingIds = new Set(prev.map(c => c._id));
                const newCategories = page1Data.categories.filter(c => !existingIds.has(c._id));
                return [...prev, ...newCategories];
            });
            setLoadedPages(prev => new Set(prev).add(1));
            setTotalPages(page1Data.meta.totalPages);
        }
        
        if (page2Data && !loadedPages.has(2)) {
            setAllCategories(prev => {
                const existingIds = new Set(prev.map(c => c._id));
                const newCategories = page2Data.categories.filter(c => !existingIds.has(c._id));
                return [...prev, ...newCategories];
            });
            setLoadedPages(prev => new Set(prev).add(2));
            setTotalPages(page2Data.meta.totalPages);
        }
    }, [page1Data, page2Data]);

    // Fetch specific page using your API
    const fetchPage = async (page: number) => {
        if (loadedPages.has(page)) return;
        
        setIsLoadingMore(true);
        try {
            const data = await getCategories({ type, page });

            setAllCategories(prev => {
                const existingIds = new Set(prev.map(c => c._id));
                const newCategories = data.categories.filter(c => !existingIds.has(c._id));
                return [...prev, ...newCategories];
            });
            setLoadedPages(prev => new Set(prev).add(page));
            setTotalPages(data.meta.totalPages);
        } catch (error) {
            console.error(`Failed to fetch page ${page}:`, error);
            setError(`Failed to load page ${page}`);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Handle page change
    const handlePageChange = async (page: number) => {
        if (page < 1 || page > totalPages) return;
        
        setCurrentPage(page);
        
        // Fetch the page if not loaded yet
        if (!loadedPages.has(page)) {
            await fetchPage(page);
        }
    };

    // Get current page's categories
    const getCurrentPageCategories = () => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        return allCategories.slice(startIndex, endIndex);
    };

    const currentCategories = getCurrentPageCategories();
    const canGoPrev = currentPage > 1;
    const canGoNext = currentPage < totalPages;

    // Generate page numbers to display
    const getPageNumbers = () => {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    // Refresh after mutations
    const refreshCategories = async () => {
        setAllCategories([]);
        setLoadedPages(new Set());
        setCurrentPage(1);
        
        // Refetch pages 1 and 2
        try {
            const [newPage1, newPage2] = await Promise.all([
                getCategories({ type, page: 1 }),
                getCategories({ type, page: 2 }),
            ]);
            
            if (newPage1) {
                setAllCategories(newPage1.categories);
                setLoadedPages(new Set([1]));
                setTotalPages(newPage1.meta.totalPages);
            }
            
            if (newPage2) {
                setAllCategories(prev => [...prev, ...newPage2.categories]);
                setLoadedPages(prev => new Set(prev).add(2));
                setTotalPages(newPage2.meta.totalPages);
            }
        } catch (error) {
            console.error("Failed to refresh categories:", error);
        }
    };

    const handleAdd = () => {
        const name = (inputName || "").trim();
        const nameAr = (inputNameAr || "").trim();
        if (!name || !nameAr) {
            setError(tr("category_name_required", "Category name is required in both languages"));
            return;
        }

        setError("");
        createCategoryMutation.mutate(
            { name: { en: name, ar: nameAr }, type },
            {
                onSuccess: () => {
                    refreshCategories();
                    setInputName("");
                    setInputNameAr("");
                },
                onError: (e: any) => {
                    setError(e?.response?.data?.message || "Failed to create category");
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

    const startEdit = (category: Category) => {
        setEditingId(category._id);
        const name = category.name;
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
            setError(tr("category_name_required", "Category name is required in both languages"));
            return;
        }

        try {
            setError("");
            await updateCategoryMutation.mutateAsync({
                id,
                data: { name: { en: name, ar: nameAr }, type },
            });
            refreshCategories();
            setEditingId("");
            setEditingName("");
            setEditingNameAr("");
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to update category");
        }
    };

    const cancelEdit = () => {
        setEditingId("");
        setEditingName("");
        setEditingNameAr("");
    };

    const remove = async (category: Category) => {
        const confirmed = await showConfirm(
            tr("confirm_delete_category", "Delete this category?"),
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) return;

        try {
            setError("");
            await deleteCategoryMutation.mutateAsync(category._id);
            refreshCategories();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to delete category");
        }
    };

    return (
        <section className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-light-900 text-white shadow-sm dark:bg-dark-100 dark:text-dark-900">
                        <Icon size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{title}</h2>
                        <p className="text-sm text-light-600 dark:text-dark-400">{subtitle}</p>
                    </div>
                </div>
                <span className="rounded-full border border-light-200 bg-light-50 px-3 py-1 text-xs font-semibold text-light-700 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-200">
                    {allCategories.length}
                </span>
            </div>

            {error && (
                <div className="mb-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                    {error}
                </div>
            )}

            {isLoading && allCategories.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-light-500" />
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        {currentCategories.length > 0 ? (
                            currentCategories.map((category) => (
                                <div
                                    key={category._id}
                                    className="group flex flex-col gap-3 rounded-2xl border border-light-200/80 bg-white px-4 py-3 text-light-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800 dark:text-dark-50 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="w-full min-w-0">
                                        {editingId === category._id ? (
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onKeyDown={handleEditKeyDown}
                                                    className="input w-full"
                                                    placeholder={tr("category_name", "Category name")}
                                                />
                                                <input
                                                    value={editingNameAr}
                                                    onChange={(e) => setEditingNameAr(e.target.value)}
                                                    onKeyDown={handleEditKeyDown}
                                                    className="input w-full"
                                                    dir="rtl"
                                                    placeholder={tr("category_name_ar", "اسم الفئة (بالعربية)")}
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-light-900 dark:text-dark-50 break-words text-sm font-semibold">
                                                {getCategoryDisplayName(category, lang)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                                        {editingId === category._id ? (
                                            <>
                                                <button
                                                    onClick={() => saveEdit(category._id)}
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
                                                    onClick={() => startEdit(category)}
                                                    className="btn-ghost flex items-center gap-2 rounded-xl"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => remove(category)}
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
                                {tr("no_categories_defined", "No categories defined yet.")}
                            </p>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-between border-t border-light-200 pt-4 dark:border-dark-700">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={!canGoPrev || isLoadingMore}
                                className="flex items-center gap-1 rounded-lg border border-light-200 px-3 py-1.5 text-sm font-medium text-light-700 transition-colors hover:bg-light-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800"
                            >
                                <ChevronLeft size={16} />
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
                                            onClick={() => handlePageChange(page as number)}
                                            disabled={isLoadingMore}
                                            className={`min-w-[32px] rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                                                currentPage === page
                                                    ? 'bg-primary-500 text-white shadow-sm'
                                                    : 'text-light-700 hover:bg-light-50 dark:text-dark-300 dark:hover:bg-dark-800'
                                            } disabled:cursor-not-allowed disabled:opacity-50`}
                                        >
                                            {page}
                                        </button>
                                    )
                                ))}
                            </div>
                            
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={!canGoNext || isLoadingMore}
                                className="flex items-center gap-1 rounded-lg border border-light-200 px-3 py-1.5 text-sm font-medium text-light-700 transition-colors hover:bg-light-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800"
                            >
                                {tr("next", "Next")}
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    {/* Loading more indicator */}
                    {isLoadingMore && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-light-500">
                            <Loader2 size={14} className="animate-spin" />
                            <span>{tr("loading_more", "Loading more...")}</span>
                        </div>
                    )}
                </>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    onKeyDown={handleCreateKeyDown}
                    placeholder={tr("category_name", "Category name")}
                    disabled={isSaving}
                    className="input w-full flex-1 disabled:opacity-50"
                />
                <input
                    value={inputNameAr}
                    onChange={(e) => setInputNameAr(e.target.value)}
                    onKeyDown={handleCreateKeyDown}
                    placeholder={tr("category_name_ar", "اسم الفئة (بالعربية)")}
                    disabled={isSaving}
                    dir="rtl"
                    className="input w-full flex-1 disabled:opacity-50"
                />
                <button
                    onClick={handleAdd}
                    disabled={isSaving}
                    className="btn-primary h-[42px] min-w-[120px] justify-center rounded-xl disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {tr("add", "Add")}
                </button>
            </div>
        </section>
    );
};

const CategoriesPage = () => {
    const { t } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const sections: CategorySectionProps[] = [
        {
            type: "item",
            title: tr("items_categories", "Item Categories"),
            subtitle: tr("items_categories_sub", "Used when creating and editing items."),
            Icon: Layers,
        },
        {
            type: "package",
            title: tr("packages_categories", "Package Categories"),
            subtitle: tr("packages_categories_sub", "Used when creating and editing packages."),
            Icon: PackageIcon,
        },
        {
            type: "term",
            title: tr("terms_categories", "Term Categories"),
            subtitle: tr("terms_categories_sub", "Used when creating and editing contract terms."),
            Icon: FileSignature,
        },
        {
            type: "project",
            title: tr("projects_categories", "Project Categories"),
            subtitle: tr("projects_categories_sub", "Used when organizing projects."),
            Icon: Target,
        },
    ];

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Taxonomy Studio
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("categories", "Categories")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("manage_categories_sub", "Manage categories across items, packages, terms, and projects.")}
                    </p>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                {sections.map((section) => (
                    <CategorySection key={section.type} {...section} />
                ))}
            </div>
        </div>
    );
};

export default CategoriesPage;