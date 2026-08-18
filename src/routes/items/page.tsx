import { useState, KeyboardEvent } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2, Search } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { showConfirm } from "@/utils/swal";
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useCategories } from "@/hooks/queries";
import { getCategoryDisplayName } from "@/api/requests/categoriesService";
import type { Item } from "@/api/requests/itemsService";

const ItemsPage = () => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };
    
    // Form states
    const [inputName, setInputName] = useState<string>("");
    const [inputDescription, setInputDescription] = useState<string>("");
    const [inputNameAr, setInputNameAr] = useState<string>("");
    const [inputDescriptionAr, setInputDescriptionAr] = useState<string>("");
    const [inputCategory, setInputCategory] = useState<string>("");
    
    // Edit modal states
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [editName, setEditName] = useState<string>("");
    const [editDescription, setEditDescription] = useState<string>("");
    const [editNameAr, setEditNameAr] = useState<string>("");
    const [editDescriptionAr, setEditDescriptionAr] = useState<string>("");
    const [editCategory, setEditCategory] = useState<string>("");
    
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [error, setError] = useState<string>("");
    
    // Category filter state - can be "all" or specific category ID
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    const { data: itemCategoriesResponse, isLoading: itemCategoriesLoading } = useCategories({ type: "item" });
    const itemCategories = itemCategoriesResponse?.categories || [];

    const getCategoryId = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return String(value._id || value.id || "");
    };

    // Calculate category counts
    const getCategoryCount = (categoryId: string) => {
        if (categoryId === "all") return items.length;
        return items.filter(item => getCategoryId((item as any).category) === categoryId).length;
    };

    // React Query hooks
    const { data: itemsResponse, isLoading } = useItems({
        page: currentPage,
        limit: 20,
        search: searchQuery || undefined,
    });
    const items = itemsResponse?.data || [];
    const totalPages = itemsResponse?.meta.totalPages || 1;

    // Filter items by selected category
    const filteredItems = selectedCategory === "all" 
        ? items 
        : items.filter(item => getCategoryId((item as any).category) === selectedCategory);

    const createItemMutation = useCreateItem();
    const updateItemMutation = useUpdateItem();
    const deleteItemMutation = useDeleteItem();

    const isSaving = createItemMutation.isPending || updateItemMutation.isPending;

    const handleAdd = () => {
        const name = (inputName || "").trim();
        const desc = (inputDescription || "").trim();
        const nameAr = (inputNameAr || "").trim();
        const descAr = (inputDescriptionAr || "").trim();

        if (!name) {
            setError(t("item_name_required") || "Item name is required");
            return;
        }

        setError("");

        const payload = {
            name,
            ar: nameAr || undefined,
            description: desc || undefined,
            descriptionAr: descAr || undefined,
            category: inputCategory || undefined,
        };

        createItemMutation.mutate(payload, {
            onError: (e: any) => {
                setError(e?.response?.data?.message || "Failed to create item");
            },
        });

        setInputName("");
        setInputNameAr("");
        setInputDescription("");
        setInputDescriptionAr("");
        setInputCategory("");
    };

    const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    const openEditModal = (item: Item) => {
        setEditingItem(item);
        setEditName(item.name || "");
        setEditNameAr((item as any).ar || "");
        setEditDescription(item.description || "");
        setEditDescriptionAr((item as any).descriptionAr || "");
        setEditCategory(getCategoryId((item as any).category));
    };

    const closeEditModal = () => {
        setEditingItem(null);
        setEditName("");
        setEditNameAr("");
        setEditDescription("");
        setEditDescriptionAr("");
        setEditCategory("");
        setError("");
    };

    const saveEdit = async () => {
        const name = (editName || "").trim();
        const desc = (editDescription || "").trim();
        const nameAr = (editNameAr || "").trim();
        const descAr = (editDescriptionAr || "").trim();

        if (!name) {
            setError(t("item_name_required") || "Item name is required");
            return;
        }

        if (!editingItem) return;

        try {
            setError("");
            await updateItemMutation.mutateAsync({
                id: editingItem._id,
                data: {
                    name,
                    ar: nameAr || undefined,
                    description: desc || undefined,
                    descriptionAr: descAr || undefined,
                    category: editCategory || undefined,
                },
            });
            closeEditModal();
        } catch (e: any) {
            setError(e.response?.data?.message || "Failed to update item");
        }
    };

    const remove = async (item: Item) => {
        const confirmed = await showConfirm(
            t("confirm_delete_item") || "Delete this item?", 
            t("yes") || "Yes", 
            t("no") || "No"
        );
        if (!confirmed) return;

        try {
            setError("");
            await deleteItemMutation.mutateAsync(item._id);
        } catch (e: any) {
            setError(e.response?.data?.message || "Failed to delete item");
        }
    };

    const getCategoryName = (categoryId: string) => {
        const category = itemCategories.find(c => c._id === categoryId);
        return category ? getCategoryDisplayName(category, lang) : tr("no_category", "No category");
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Inventory Studio
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("Items", "Items")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("manage_items_sub", "Manage available items shown throughout the app.")}
                    </p>
                </div>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_items", "Total Items")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{items.length}</p>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Add Item Form Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-gradient-to-br from-light-50 via-white to-light-100/60 p-5 shadow-sm dark:border-dark-700/70 dark:from-dark-900/60 dark:via-dark-900/30 dark:to-dark-800/60 sm:p-6">
                <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-light-300/40 blur-3xl dark:bg-dark-700/40" />
                <div className="relative mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("add_item", "Add Item")}</h2>
                        <p className="text-sm text-light-600 dark:text-dark-300">
                            {tr("add_item_sub", "Create a new item with optional category and rich descriptions.")}
                        </p>
                    </div>
                </div>

                <div className="relative grid gap-4 lg:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("item_name", "Item Name")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={inputName}
                            onChange={(e) => setInputName(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={tr("item_name", "Item Name")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("item_name_ar", "اسم العنصر (بالعربية)")}
                        </label>
                        <input
                            value={inputNameAr}
                            onChange={(e) => setInputNameAr(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={tr("item_name_ar", "اسم العنصر (بالعربية)")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("item_description", "Description")}
                        </label>
                        <textarea
                            value={inputDescription}
                            onChange={(e) => setInputDescription(e.target.value)}
                            rows={8}
                            className="input w-full resize-y disabled:opacity-50 min-h-[100px]"
                            placeholder={tr("item_description", "Description")}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("item_description_ar", "وصف (بالعربية)")}
                        </label>
                        <textarea
                            value={inputDescriptionAr}
                            onChange={(e) => setInputDescriptionAr(e.target.value)}
                            rows={8}
                            className="input w-full resize-y disabled:opacity-50 min-h-[100px]"
                            placeholder={tr("item_description_ar", "وصف (بالعربية)")}
                            dir="rtl"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("category", "Category")}
                        </label>
                        <select
                            value={inputCategory}
                            onChange={(e) => setInputCategory(e.target.value)}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        >
                            <option value="">{tr("no_category", "No category")}</option>
                            {itemCategoriesLoading ? (
                                <option value="" disabled>
                                    {tr("loading", "Loading categories...")}
                                </option>
                            ) : (
                                itemCategories.map((category) => (
                                    <option key={category._id} value={category._id}>
                                        {getCategoryDisplayName(category, lang)}
                                    </option>
                                ))
                            )}
                        </select>
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
                            <span>{tr("add", "Add Item")}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Items List Section */}
            <div className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-light-900 dark:text-dark-50 text-lg font-semibold">{tr("manage_items", "Manage Items")}</h2>
                    <div className="relative">
                        <Search className="text-light-600 dark:text-dark-400 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder={tr("search_items", "Search items...")}
                            className="input w-64 rounded-xl pr-3 pl-10"
                        />
                    </div>
                </div>

                {/* Category Filter Chips */}
                <div className="mb-6 flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedCategory("all")}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                            selectedCategory === "all"
                                ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                : "bg-light-100 text-light-700 hover:bg-light-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-700"
                        }`}
                    >
                        {tr("all_items", "All Items")}
                        <span className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                            selectedCategory === "all"
                                ? "bg-white/20 text-white"
                                : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                        }`}>
                            {items.length}
                        </span>
                    </button>
                    
                    {itemCategories.map((category) => {
                        const count = getCategoryCount(category._id);
                        if (count === 0) return null;
                        
                        return (
                            <button
                                key={category._id}
                                onClick={() => setSelectedCategory(category._id)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                                    selectedCategory === category._id
                                        ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                        : "bg-light-100 text-light-700 hover:bg-light-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-700"
                                }`}
                            >
                                {getCategoryDisplayName(category, lang)}
                                <span className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                                    selectedCategory === category._id
                                        ? "bg-white/20 text-white"
                                        : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-light-500 dark:text-light-500 h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3">
                            {filteredItems.length > 0 ? (
                                filteredItems.map((item) => {
                                    const displayName = lang === "ar" ? (item as any).ar || item.name : item.name || (item as any).ar;
                                    const displayDesc = lang === "ar"
                                        ? (item as any).descriptionAr || item.description
                                        : item.description || (item as any).descriptionAr;
                                    const categoryName = getCategoryName(getCategoryId((item as any).category));
                                    
                                    return (
                                        <div
                                            key={item._id}
                                            className="group rounded-2xl border border-light-200/80 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800"
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-light-900 dark:text-dark-50 text-base font-semibold break-words">
                                                        {displayName}
                                                    </h3>
                                                    {displayDesc && (
                                                        <p className="text-light-600 dark:text-dark-300 mt-1 text-sm break-words line-clamp-2">
                                                            {displayDesc}
                                                        </p>
                                                    )}
                                                    <div className="mt-2">
                                                        <span className="inline-flex items-center rounded-full bg-light-100 px-2.5 py-0.5 text-xs font-medium text-light-700 dark:bg-dark-700 dark:text-dark-300">
                                                            {categoryName}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                                                    <button
                                                        onClick={() => openEditModal(item)}
                                                        className="rounded-xl bg-light-100 px-3 py-2 text-light-700 transition-colors hover:bg-light-200 dark:bg-dark-700 dark:text-dark-200 dark:hover:bg-dark-600"
                                                        title={tr("edit", "Edit")}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => remove(item)}
                                                        className="rounded-xl bg-red-50 px-3 py-2 text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                                                        title={tr("delete", "Delete")}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-light-600 dark:text-dark-300 text-center py-8">
                                    {selectedCategory === "all" 
                                        ? tr("no_items_defined", "No items defined yet.")
                                        : tr("no_items_in_category", "No items in this category.")}
                                </p>
                            )}
                        </div>

                        {/* Pagination - only show if not filtering by category or if filtered items exceed page size */}
                        {totalPages > 1 && selectedCategory === "all" && (
                            <div className="mt-6 flex items-center justify-center gap-3">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="rounded-xl border border-light-200 px-4 py-2 text-sm font-medium text-light-700 transition-colors hover:bg-light-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800"
                                >
                                    {tr("previous", "Previous")}
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className="text-light-600 dark:text-dark-400 text-sm">
                                        {tr("page", "Page")}
                                    </span>
                                    <span className="rounded-lg bg-light-100 px-3 py-1 text-sm font-semibold text-light-900 dark:bg-dark-700 dark:text-dark-50">
                                        {currentPage}
                                    </span>
                                    <span className="text-light-600 dark:text-dark-400 text-sm">
                                        {tr("of", "of")} {totalPages}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="rounded-xl border border-light-200 px-4 py-2 text-sm font-medium text-light-700 transition-colors hover:bg-light-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800"
                                >
                                    {tr("next", "Next")}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Clean Edit Modal */}
            {editingItem && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeEditModal();
                    }}
                >
                    <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl dark:bg-dark-800">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-light-200 px-6 py-4 dark:border-dark-700">
                            <div>
                                <h3 className="text-xl font-semibold text-light-900 dark:text-dark-50">
                                    {tr("edit_item", "Edit Item")}
                                </h3>
                                <p className="mt-1 text-sm text-light-500 dark:text-dark-400">
                                    {tr("edit_item_sub", "Update item details")}
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
                        <div className="max-h-[70vh] overflow-y-auto p-6">
                            {error && (
                                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-5">
                                {/* Name Fields */}
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("item_name", "Item Name")} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                            placeholder={tr("item_name", "Item Name")}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("item_name_ar", "اسم العنصر (بالعربية)")}
                                        </label>
                                        <input
                                            value={editNameAr}
                                            onChange={(e) => setEditNameAr(e.target.value)}
                                            className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                            placeholder={tr("item_name_ar", "أدخل اسم العنصر بالعربية")}
                                            dir="rtl"
                                        />
                                    </div>
                                </div>

                                {/* Description Fields */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("item_description", "Description")}
                                        <span className="ml-1 text-xs font-normal text-light-400">({tr("optional", "Optional")})</span>
                                    </label>
                                    <textarea
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        rows={6}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100 resize-y"
                                        placeholder={tr("item_description_placeholder", "Enter a detailed description...")}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("item_description_ar", "وصف (بالعربية)")}
                                        <span className="mr-1 text-xs font-normal text-light-400">({tr("optional", "اختياري")})</span>
                                    </label>
                                    <textarea
                                        value={editDescriptionAr}
                                        onChange={(e) => setEditDescriptionAr(e.target.value)}
                                        rows={6}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100 resize-y"
                                        placeholder={tr("item_description_ar_placeholder", "أدخل وصفاً مفصلاً...")}
                                        dir="rtl"
                                    />
                                </div>

                                {/* Category Field */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("category", "Category")}
                                        <span className="ml-1 text-xs font-normal text-light-400">({tr("optional", "Optional")})</span>
                                    </label>
                                    <select
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                    >
                                        <option value="">{tr("no_category", "No category")}</option>
                                        {itemCategoriesLoading ? (
                                            <option value="" disabled>
                                                {tr("loading", "Loading categories...")}
                                            </option>
                                        ) : (
                                            itemCategories.map((category) => (
                                                <option key={category._id} value={category._id}>
                                                    {getCategoryDisplayName(category, lang)}
                                                </option>
                                            ))
                                        )}
                                    </select>
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

export default ItemsPage;