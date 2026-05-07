import { useState, KeyboardEvent } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2, Search } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { showConfirm } from "@/utils/swal";
import { useContractTerms, useCreateContractTerm, useUpdateContractTerm, useDeleteContractTerm } from "@/hooks/queries/useContractTermsQuery";
import { useCategories } from "@/hooks/queries";
import type { ContractTerm } from "@/api/requests/termsService";

const TermsPage = () => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };
    
    // Form states
    const [inputKey, setInputKey] = useState<string>("");
    const [inputValue, setInputValue] = useState<string>("");
    const [inputKeyAr, setInputKeyAr] = useState<string>("");
    const [inputValueAr, setInputValueAr] = useState<string>("");
    const [inputCategory, setInputCategory] = useState<string>("");
    
    // Edit modal states (using modal instead of inline editing)
    const [editingTerm, setEditingTerm] = useState<ContractTerm | null>(null);
    const [editKey, setEditKey] = useState<string>("");
    const [editValue, setEditValue] = useState<string>("");
    const [editKeyAr, setEditKeyAr] = useState<string>("");
    const [editValueAr, setEditValueAr] = useState<string>("");
    const [editCategory, setEditCategory] = useState<string>("");
    
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [error, setError] = useState<string>("");
    
    // Category filter state
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    const { data: termCategoriesResponse, isLoading: termCategoriesLoading } = useCategories({ type: "term", page: 1 });
    const termCategories = termCategoriesResponse?.categories || [];

    const getCategoryId = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return String(value._id || value.id || "");
    };

    // Calculate category counts
    const getCategoryCount = (categoryId: string) => {
        if (categoryId === "all") return terms.length;
        return terms.filter(term => getCategoryId((term as any).category) === categoryId).length;
    };

    // React Query hooks
    const { data: termsResponse, isLoading } = useContractTerms({
        page: currentPage,
        limit: 20,
        search: searchQuery || undefined,
    });
    const terms = termsResponse?.data || [];
    const totalPages = termsResponse?.meta.totalPages || 1;

    // Filter terms by selected category
    const filteredTerms = selectedCategory === "all" 
        ? terms 
        : terms.filter(term => getCategoryId((term as any).category) === selectedCategory);

    const createTermMutation = useCreateContractTerm();
    const updateTermMutation = useUpdateContractTerm();
    const deleteTermMutation = useDeleteContractTerm();

    const isSaving = createTermMutation.isPending || updateTermMutation.isPending;

    const handleAdd = () => {
        const key = (inputKey || "").trim();
        const value = (inputValue || "").trim();
        const keyAr = (inputKeyAr || "").trim();
        const valueAr = (inputValueAr || "").trim();

        if (!key || !keyAr) {
            setError(t("term_key_required") || "Term key (both languages) is required");
            return;
        }

        setError("");

        const payload = {
            key,
            keyAr,
            value: value || undefined,
            valueAr: valueAr || undefined,
            category: inputCategory || undefined,
        };

        createTermMutation.mutate(payload, {
            onError: (e: any) => {
                setError(e?.response?.data?.message || "Failed to create term");
            },
        });

        setInputKey("");
        setInputKeyAr("");
        setInputValue("");
        setInputValueAr("");
        setInputCategory("");
    };

    const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    const openEditModal = (term: ContractTerm) => {
        setEditingTerm(term);
        setEditKey(term.key || "");
        setEditKeyAr(term.keyAr || "");
        setEditValue(term.value || "");
        setEditValueAr(term.valueAr || "");
        setEditCategory(getCategoryId((term as any).category));
    };

    const closeEditModal = () => {
        setEditingTerm(null);
        setEditKey("");
        setEditKeyAr("");
        setEditValue("");
        setEditValueAr("");
        setEditCategory("");
        setError("");
    };

    const saveEdit = async () => {
        const key = (editKey || "").trim();
        const value = (editValue || "").trim();
        const keyAr = (editKeyAr || "").trim();
        const valueAr = (editValueAr || "").trim();

        if (!key || !keyAr) {
            setError(t("term_key_required") || "Term key (both languages) is required");
            return;
        }

        if (!editingTerm) return;

        try {
            setError("");
            await updateTermMutation.mutateAsync({
                id: editingTerm._id,
                data: {
                    key,
                    keyAr,
                    value: value || undefined,
                    valueAr: valueAr || undefined,
                    category: editCategory || undefined,
                },
            });
            closeEditModal();
        } catch (e: any) {
            setError(e.response?.data?.message || "Failed to update term");
        }
    };

    const remove = async (term: ContractTerm) => {
        const confirmed = await showConfirm(
            t("confirm_delete_term") || "Delete this term?", 
            t("yes") || "Yes", 
            t("no") || "No"
        );
        if (!confirmed) return;

        try {
            setError("");
            await deleteTermMutation.mutateAsync(term._id);
        } catch (e: any) {
            setError(e.response?.data?.message || "Failed to delete term");
        }
    };

    const getCategoryName = (categoryId: string) => {
        const category = termCategories.find(c => c._id === categoryId);
        return category ? category.name : tr("no_category", "No category");
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-14 h-56 w-56 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-14 h-56 w-56 rounded-full bg-secdark-700/20 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Contract Terms
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("Contract Terms", "Contract Terms")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("manage_terms_sub", "Manage contract terms and conditions for your agreements.")}
                    </p>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_terms", "Total Terms")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{filteredTerms.length}</p>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-light-900 dark:text-dark-50 text-lg font-semibold">{tr("manage_terms", "Manage Terms")}</h2>
                    <div className="relative w-full sm:w-auto">
                        <Search className="text-light-600 dark:text-dark-400 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder={tr("search_terms", "Search terms...")}
                            className="input w-full rounded-xl pr-3 pl-10 sm:w-64"
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
                        {tr("all_terms", "All Terms")}
                        <span className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                            selectedCategory === "all"
                                ? "bg-white/20 text-white"
                                : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                        }`}>
                            {terms.length}
                        </span>
                    </button>
                    
                    {termCategories.map((category) => {
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
                                {category.name}
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
                            {filteredTerms.length > 0 ? (
                                filteredTerms.map((term) => {
                                    const displayKey = lang === "ar" ? term.keyAr || term.key : term.key || term.keyAr;
                                    const displayValue = lang === "ar" ? term.valueAr || term.value : term.value || term.valueAr;
                                    const categoryName = getCategoryName(getCategoryId((term as any).category));
                                    
                                    return (
                                        <div
                                            key={term._id}
                                            className="group rounded-2xl border border-light-200/80 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800"
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-light-900 dark:text-dark-50 text-base font-semibold break-words">
                                                        {displayKey}
                                                    </h3>
                                                    {displayValue && (
                                                        <p className="text-light-600 dark:text-dark-300 mt-1 text-sm break-words line-clamp-2">
                                                            {displayValue}
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
                                                        onClick={() => openEditModal(term)}
                                                        className="rounded-xl bg-light-100 px-3 py-2 text-light-700 transition-colors hover:bg-light-200 dark:bg-dark-700 dark:text-dark-200 dark:hover:bg-dark-600"
                                                        title={tr("edit", "Edit")}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => remove(term)}
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
                                        ? tr("no_terms_defined", "No terms defined yet.")
                                        : tr("no_terms_in_category", "No terms in this category.")}
                                </p>
                            )}
                        </div>

                        {/* Pagination */}
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

            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-gradient-to-br from-light-50 via-white to-light-100/60 p-5 shadow-sm dark:border-dark-700/70 dark:from-dark-900/60 dark:via-dark-900/30 dark:to-dark-800/60 sm:p-6">
                <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-light-300/40 blur-3xl dark:bg-dark-700/40" />
                <div className="relative mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("add_term", "Add Term")}</h2>
                        <p className="text-sm text-light-600 dark:text-dark-300">
                            {tr("add_term_sub", "Create a new term with multilingual values and an optional category.")}
                        </p>
                    </div>
                </div>

                <div className="relative grid gap-4 lg:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("term_key", "Term Key")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={tr("term_key", "Term Key (e.g., Payment)")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("term_key_ar", "المفتاح (بالعربية)")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={inputKeyAr}
                            onChange={(e) => setInputKeyAr(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={tr("term_key_ar", "المفتاح (مثال: الدفع)")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("term_value", "Value")}
                        </label>
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            rows={6}
                            className="input w-full min-h-[150px] resize-y disabled:opacity-50"
                            placeholder={tr("term_value", "Value (e.g., 50% advance)")}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("term_value_ar", "القيمة (بالعربية)")}
                        </label>
                        <textarea
                            value={inputValueAr}
                            onChange={(e) => setInputValueAr(e.target.value)}
                            rows={6}
                            className="input w-full min-h-[150px] resize-y disabled:opacity-50"
                            placeholder={tr("term_value_ar", "القيمة (مثال: 50% مقدم)")}
                            dir="rtl"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("category", "Category")}
                            <span className="ml-1 text-xs font-normal text-light-400">({tr("optional", "Optional")})</span>
                        </label>
                        <select
                            value={inputCategory}
                            onChange={(e) => setInputCategory(e.target.value)}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        >
                            <option value="">{tr("no_category", "No category")}</option>
                            {termCategoriesLoading ? (
                                <option value="" disabled>
                                    {tr("loading", "Loading categories...")}
                                </option>
                            ) : (
                                termCategories.map((category) => (
                                    <option key={category._id} value={category._id}>
                                        {category.name}
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
                            <span>{tr("add", "Add Term")}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Edit Modal */}
            {editingTerm && (
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
                                    {tr("edit_term", "Edit Term")}
                                </h3>
                                <p className="mt-1 text-sm text-light-500 dark:text-dark-400">
                                    {tr("edit_term_sub", "Update term details")}
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
                                {/* Key Fields */}
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("term_key", "Term Key")} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={editKey}
                                            onChange={(e) => setEditKey(e.target.value)}
                                            className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                            placeholder={tr("term_key", "Term Key")}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("term_key_ar", "المفتاح (بالعربية)")} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={editKeyAr}
                                            onChange={(e) => setEditKeyAr(e.target.value)}
                                            className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                            placeholder={tr("term_key_ar", "المفتاح (بالعربية)")}
                                            dir="rtl"
                                        />
                                    </div>
                                </div>

                                {/* Value Fields */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("term_value", "Value")}
                                        <span className="ml-1 text-xs font-normal text-light-400">({tr("optional", "Optional")})</span>
                                    </label>
                                    <textarea
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        rows={6}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100 resize-y"
                                        placeholder={tr("term_value", "Enter term value...")}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("term_value_ar", "القيمة (بالعربية)")}
                                        <span className="mr-1 text-xs font-normal text-light-400">({tr("optional", "اختياري")})</span>
                                    </label>
                                    <textarea
                                        value={editValueAr}
                                        onChange={(e) => setEditValueAr(e.target.value)}
                                        rows={6}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100 resize-y"
                                        placeholder={tr("term_value_ar", "أدخل قيمة المصطلح...")}
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
                                        {termCategoriesLoading ? (
                                            <option value="" disabled>
                                                {tr("loading", "Loading categories...")}
                                            </option>
                                        ) : (
                                            termCategories.map((category) => (
                                                <option key={category._id} value={category._id}>
                                                    {category.name}
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

export default TermsPage;