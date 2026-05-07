import { useMemo, useState } from "react";
import { useLang } from "@/hooks/useLang";
import { Check, Loader2, Plus, RefreshCw, Search, X, Edit, Trash2 } from "lucide-react";
import { usePackages, useServices, useItems, useCategories } from "@/hooks/queries";
import type { Package } from "@/api/requests/packagesService";
import type { Service } from "@/api/requests/servicesService";
import { useNavigate } from "react-router-dom";
import { deletePackage } from "@/api/requests/packagesService";

const PackagesPage = () => {
    const { t, lang } = useLang();
    const navigate = useNavigate();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const [searchQuery, setSearchQuery] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [error, setError] = useState<string>("");

    // React Query hooks
    const { data: packagesResponse, isLoading, refetch } = usePackages({
        page: currentPage,
        limit: 20,
        search: searchQuery || undefined,
    });
    const packages = packagesResponse?.data || [];
    const totalPages = packagesResponse?.meta.totalPages || 1;

    // Load services for stats only
    const { data: servicesResponse } = useServices({ limit: 1000 });
    const services = servicesResponse?.data || [];
    
    // Load items for display
    const { data: itemsResponse } = useItems({ limit: 1000 });
    const items = itemsResponse?.data || [];
    
    // Load categories for filtering
    const { data: packageCategoriesResponse, isLoading: categoriesLoading } = useCategories({ type: "package", page: 1 });
    const packageCategories = packageCategoriesResponse?.categories || [];

    const itemsMap = useMemo(() => {
        const m: Record<string, string> = {};
        items.forEach((it: any) => {
            const display = it?.name || it?.nameEn || it?.nameAr || it?.en || it?.ar || it?.title || "(item)";
            if (it && it._id) m[it._id] = display;
            if (it && it.id) m[it.id] = display;
        });
        return m;
    }, [items]);

    const getPackageCategoryId = (pkg: Package): string => {
        const anyPkg: any = pkg as any;
        if (!anyPkg.category) return "";
        if (typeof anyPkg.category === "string") return anyPkg.category;
        if (anyPkg.category._id) return anyPkg.category._id;
        if (anyPkg.category.id) return anyPkg.category.id;
        return "";
    };

    // Build list of categories that actually have packages
    const categoriesWithCounts = useMemo(() => {
        const map: { category: typeof packageCategories[0]; count: number }[] = [];
        
        packageCategories.forEach((category) => {
            const count = packages.filter((pkg) => getPackageCategoryId(pkg) === category._id).length;
            if (count > 0) {
                map.push({ category, count });
            }
        });
        
        return map;
    }, [packageCategories, packages]);

    const filteredPackages = useMemo(() => {
        if (!selectedCategoryId) return packages;
        return packages.filter((pkg) => getPackageCategoryId(pkg) === selectedCategoryId);
    }, [packages, selectedCategoryId]);

    const normalizePackageItem = (pkgItem: any, pkgId: string, idx: number) => {
        const raw = pkgItem as any;
        const inner = raw?.item ?? raw;

        let id = undefined as string | undefined;
        let name = "(item)";

        if (typeof inner === "string" || typeof inner === "number") {
            id = String(inner);
            name = itemsMap[id] || id;
        } else if (inner && typeof inner === "object") {
            id = inner._id || inner.id || undefined;
            name = inner.name || inner.nameEn || inner.nameAr || inner.en || inner.ar || inner.title || itemsMap[id || ""] || "(item)";
        }

        return {
            id,
            key: id || `${pkgId}-${idx}`,
            name,
            quantity: raw?.quantity,
            note: raw?.note ?? inner?.note ?? "",
        };
    };

    const handleAddPackage = () => {
        navigate("/packages/add");
    };

    const handleRefresh = () => {
        refetch();
    };

    const handleEditPackage = (id: string) => {
        if (!id) return;
        navigate("/packages/add", { state: { editPackageId: id } });
    };

    const handleDeletePackage = async (id: string) => {
        if (!id) return;
        const ok = window.confirm(tr("confirm_delete_package", "Are you sure you want to delete this package?"));
        if (!ok) return;
        try {
            await deletePackage(id);
            refetch();
        } catch (err: any) {
            setError(err?.message || "Failed to delete package");
        }
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-14 h-56 w-56 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-14 h-56 w-56 rounded-full bg-secdark-700/20 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                                Package Library
                            </span>
                            <h1 className="title mt-3 text-xl sm:text-2xl lg:text-3xl">{tr("service_packages", "Service Packages")}</h1>
                            <p className="text-light-600 dark:text-dark-300 mt-1 text-sm sm:text-base">
                                {tr("service_packages_subtitle", "Explore and compare service packages with full feature visibility.")}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleRefresh}
                                className="btn-ghost flex items-center gap-2"
                                title={tr("refresh", "Refresh")}
                            >
                                <RefreshCw size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={handleAddPackage}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus size={16} />
                                {tr("add_package", "Add Package")}
                            </button>
                        </div>
                    </div>

                    <div className="relative max-w-xs">
                        <Search className="text-light-600 dark:text-dark-400 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder={tr("search_packages", "Search packages...")}
                            className="input w-full rounded-xl pr-3 pl-10"
                        />
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_packages", "Total Packages")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{packages.length}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("categories", "Categories")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{packageCategories.length}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("services", "Services")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{services.length}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("visible_packages", "Visible Packages")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{filteredPackages.length}</p>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                </div>
            )}

            {isLoading && categoriesLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="text-light-500 dark:text-light-500 h-8 w-8 animate-spin" />
                </div>
            ) : (
                <>
                    {/* Category Filter Chips - No Icons */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryId(null)}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                                selectedCategoryId === null
                                    ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                    : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:bg-dark-700"
                            }`}
                        >
                            {tr("all", "All")}
                            <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                                selectedCategoryId === null
                                    ? "bg-white/20 text-white"
                                    : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                            }`}>
                                {packages.length}
                            </span>
                        </button>

                        {categoriesWithCounts.map(({ category, count }) => (
                            <button
                                key={category._id}
                                type="button"
                                onClick={() => setSelectedCategoryId(category._id)}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                                    selectedCategoryId === category._id
                                        ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                        : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:bg-dark-700"
                                }`}
                            >
                                {category.name}
                                <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                                    selectedCategoryId === category._id
                                        ? "bg-white/20 text-white"
                                        : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                                }`}>
                                    {count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredPackages.map((pkg) => {
                            const categoryName = getPackageCategoryId(pkg) ? packageCategories.find(c => c._id === getPackageCategoryId(pkg))?.name : null;
                            
                            return (
                                <div
                                    key={pkg._id}
                                    className="group to-light-50 dark:from-dark-800 dark:to-dark-900 relative flex flex-col overflow-hidden rounded-3xl border border-light-200/80 bg-gradient-to-br from-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-dark-700/80"
                                >
                                    <div className="from-primary-400/20 to-primary-600/20 absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br blur-3xl" />

                                    <div className="relative z-10 mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-light-300/80 bg-white/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-light-700 shadow-sm dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                                                {(pkg.items || []).length} {tr("items", "items")}
                                            </span>
                                            {categoryName && (
                                                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                                    {categoryName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const id = pkg._id || pkg.id;
                                                    if (id) handleEditPackage(id);
                                                }}
                                                title={tr("edit", "Edit")}
                                                className="rounded-lg p-1.5 text-light-500 transition hover:bg-light-100 hover:text-primary-600 dark:text-light-500 dark:hover:bg-dark-700"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const id = pkg._id || pkg.id;
                                                    if (id) handleDeletePackage(id);
                                                }}
                                                title={tr("delete", "Delete")}
                                                className="rounded-lg p-1.5 text-light-500 transition hover:bg-red-50 hover:text-red-600 dark:text-light-500 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative z-10 mb-5 text-center">
                                        <h3 className="text-light-900 dark:text-dark-50 text-[28px] leading-tight font-bold tracking-tight">
                                            {lang === "ar" ? pkg.nameAr : pkg.nameEn}
                                        </h3>
                                        {pkg.description && <p className="text-light-600 dark:text-dark-400 mt-2 line-clamp-2 text-sm">{pkg.description}</p>}
                                    </div>

                                    <div className="relative z-10 mb-5 flex-1">
                                        <div className="mb-3 rounded-2xl border border-light-200/70 bg-gradient-to-r from-light-100/90 to-light-200/80 p-3 dark:border-dark-700/80 dark:from-dark-700 dark:to-dark-800">
                                            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                                                <h4 className="text-light-800 dark:text-dark-200 text-left text-[13px] font-extrabold tracking-[0.1em] uppercase">
                                                    {lang === "ar" ? "الميزات" : "Features"}
                                                </h4>
                                                <h4 className="text-light-800 dark:text-dark-200 text-right text-[13px] font-extrabold tracking-[0.1em] uppercase">
                                                    {lang === "ar" ? "المتاحة" : "Provided"}
                                                </h4>
                                            </div>
                                        </div>

                                        {pkg.items && pkg.items.length > 0 ? (
                                            <div className="border-light-200/80 dark:border-dark-700/80 dark:bg-dark-900/30 max-h-[252px] space-y-2 overflow-auto rounded-2xl border bg-white/55 p-2.5 pr-1.5 shadow-inner scrollbar-thin">
                                                {pkg.items.map((pkgItem, idx) => {
                                                    const item = normalizePackageItem(pkgItem, pkg._id, idx);

                                                    return (
                                                        <div
                                                            key={item.key}
                                                            className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-light-200/80 bg-white/95 px-3 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-600/80 dark:bg-dark-800/95"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-light-900 dark:text-dark-50 text-sm font-medium">{item.name}</div>
                                                                {item.note && (
                                                                    <div className="text-light-600 dark:text-dark-400 mt-1 truncate text-[11px]">{item.note}</div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-end">
                                                                {typeof item.quantity === "boolean" ? (
                                                                    item.quantity ? (
                                                                        <div className="rounded-full border border-emerald-200 bg-emerald-100/90 p-1.5 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-900/30">
                                                                            <Check size={17} className="text-green-600 dark:text-green-400" />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="rounded-full border border-red-200 bg-red-100/90 p-1.5 shadow-sm dark:border-red-500/30 dark:bg-red-900/30">
                                                                            <X size={17} className="text-red-600 dark:text-red-400" />
                                                                        </div>
                                                                    )
                                                                ) : typeof item.quantity === "number" ? (
                                                                    <span className="inline-flex min-w-[40px] items-center justify-center rounded-full bg-gradient-to-r from-light-300 to-light-200 px-3.5 py-1.5 text-sm font-extrabold text-light-900 shadow-sm dark:from-dark-600 dark:to-dark-700 dark:text-dark-50">
                                                                        {item.quantity}
                                                                    </span>
                                                                ) : item.quantity !== undefined && item.quantity !== null ? (
                                                                    <span className="inline-flex max-w-[120px] truncate rounded-full bg-light-200 px-3 py-1 text-xs font-semibold text-light-800 dark:bg-dark-700 dark:text-dark-100">
                                                                        {item.quantity}
                                                                    </span>
                                                                ) : (
                                                                    <div className="rounded-full border border-emerald-200 bg-emerald-100/90 p-1.5 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-900/30">
                                                                        <Check size={17} className="text-green-600 dark:text-green-400" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-light-500 dark:text-dark-500 rounded-2xl border border-dashed border-light-200/70 py-4 text-center text-sm dark:border-dark-700/70">
                                                {lang === "ar" ? "لا توجد ميزات" : "No features"}
                                            </p>
                                        )}
                                    </div>

                                    <div className="relative z-10 mt-auto rounded-2xl border border-primary-300/25 bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-center shadow-lg shadow-primary-500/20">
                                        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-white/80">
                                            {lang === "ar" ? "السعر" : "Price"}
                                        </div>
                                        <div className="mt-1 flex items-center justify-center gap-2">
                                            <span className="text-4xl leading-none font-extrabold text-white tabular-nums">{pkg.price}</span>
                                            <span className="text-xl font-semibold text-white/90">{lang === "ar" ? "ج.م" : "EGP"}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredPackages.length === 0 && !isLoading && (
                        <div className="py-12 text-center">
                            <p className="text-light-600 dark:text-dark-400">{tr("no_packages_found", "No packages found")}</p>
                            <button
                                type="button"
                                onClick={handleAddPackage}
                                className="btn-primary mt-4 inline-flex items-center gap-2"
                            >
                                <Plus size={16} />
                                {tr("add_first_package", "Add Your First Package")}
                            </button>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-center gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="btn-ghost rounded-xl px-3 py-1 disabled:opacity-50"
                            >
                                {tr("previous", "Previous")}
                            </button>
                            <span className="text-light-600 dark:text-dark-400 text-sm">
                                {tr("page", "Page")} {currentPage} {tr("of", "of")} {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="btn-ghost rounded-xl px-3 py-1 disabled:opacity-50"
                            >
                                {tr("next", "Next")}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PackagesPage;