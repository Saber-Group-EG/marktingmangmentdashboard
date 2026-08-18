import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Package as PackageIcon, Plus, Search, Trash2, Copy, FolderOpen, Tag, ShoppingBag } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/hooks/useLang";
import { showAlert, showConfirm } from "@/utils/swal";
import { createItem, getItems, type Item } from "@/api/requests/itemsService";
import type { Package as PackageType } from "@/api/requests/packagesService";
import { getPackageById } from "@/api/requests/packagesService";
import { packagesKeys, useCreatePackage, useDeletePackage, usePackages, useUpdatePackage } from "@/hooks/queries/usePackagesQuery";
import { useServices, useCategories } from "@/hooks/queries";
import { getCategoryDisplayName } from "@/api/requests/categoriesService";

type DisplayType = "number" | "string" | "availability";
type LocalItem = Item & { id?: string };

const AddPackagePage = () => {
    const { t, lang } = useLang();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    // Package form states
    const [nameEn, setNameEn] = useState("");
    const [nameAr, setNameAr] = useState("");
    const [description, setDescription] = useState("");
    const [descriptionAr, setDescriptionAr] = useState("");
    const [price, setPrice] = useState("");
    const [categoryId, setCategoryId] = useState("");

    // Items states
    const [availableItems, setAvailableItems] = useState<LocalItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [displayTypes, setDisplayTypes] = useState<Record<string, DisplayType>>({});
    const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
    const [stringValues, setStringValues] = useState<Record<string, string>>({});
    const [availabilities, setAvailabilities] = useState<Record<string, boolean>>({});
    const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

    // Filter states
    const [packageSearch, setPackageSearch] = useState("");
    const [selectedPackageCategory, setSelectedPackageCategory] = useState<string>("all");
    const [itemSearch, setItemSearch] = useState("");
    const [selectedItemCategory, setSelectedItemCategory] = useState<string>("all");

    // UI states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editPackageId, setEditPackageId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [nameError, setNameError] = useState("");
    const [priceError, setPriceError] = useState("");

    // Quick add item states
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [newItemNameAr, setNewItemNameAr] = useState("");
    const [newItemDescription, setNewItemDescription] = useState("");
    const [newItemDescriptionAr, setNewItemDescriptionAr] = useState("");
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [quickAddError, setQuickAddError] = useState("");

    // Data fetching
    const { data: packagesData, isLoading: packagesLoading } = usePackages({ page: 1, limit: 100 });
    const packagesList: PackageType[] = packagesData?.data || [];
    const { data: servicesData } = useServices({ limit: 1000 });
    const services = servicesData?.data || [];
    const { data: packageCategoriesResponse, isLoading: packageCategoriesLoading } = useCategories({ type: "package" });
    const { data: itemCategoriesResponse } = useCategories({ type: "item" });
    
    const packageCategories = packageCategoriesResponse?.categories || [];
    const itemCategories = itemCategoriesResponse?.categories || [];

    const createPackageMutation = useCreatePackage();
    const updatePackageMutation = useUpdatePackage();
    const deleteMutation = useDeletePackage();

    const getItemId = (item: any): string => String(item?._id || item?.id || "");
    const getCategoryId = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return String(value._id || value.id || "");
    };

    const getPackageCategoryId = (pkg: PackageType): string => {
        return getCategoryId((pkg as any).category);
    };

    const getItemCategoryId = (item: LocalItem): string => {
        return getCategoryId((item as any).category);
    };

    const getPackageCategoryName = (categoryId: string) => {
        const category = packageCategories.find(c => c._id === categoryId);
        return category ? getCategoryDisplayName(category, lang) : tr("no_category", "No category");
    };

    // Calculate category counts for packages
    const getPackageCategoryCount = (categoryId: string) => {
        if (categoryId === "all") return packagesList.length;
        return packagesList.filter(pkg => getPackageCategoryId(pkg) === categoryId).length;
    };

    // Calculate category counts for items
    const getItemCategoryCount = (categoryId: string) => {
        if (categoryId === "all") return filteredBySearch.length;
        return filteredBySearch.filter(item => getItemCategoryId(item) === categoryId).length;
    };

    const normalizeItem = (raw: any): LocalItem | null => {
        const source = raw?.item || raw?.data || raw;
        const id = getItemId(source);
        if (!id) return null;

        return {
            ...(source || {}),
            _id: id,
            id,
            name: source?.name || source?.en || source?.title || "",
            ar: source?.ar || source?.nameAr || "",
            description: source?.description,
            descriptionAr: source?.descriptionAr,
        } as LocalItem;
    };

    const loadItems = async () => {
        setItemsLoading(true);
        setError("");
        try {
            const response = await getItems({ page: 1, limit: 200 });
            const normalized = (response.data || []).map((it: any) => normalizeItem(it)).filter(Boolean) as LocalItem[];
            setAvailableItems(normalized);
        } catch (err: any) {
            setError(err?.response?.data?.message || tr("items_load_failed", "Failed to load items"));
        } finally {
            setItemsLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    // Apply search and category filter to packages
    const filteredPackages = useMemo(() => {
        let filtered = packagesList;
        
        if (selectedPackageCategory !== "all") {
            filtered = filtered.filter(pkg => getPackageCategoryId(pkg) === selectedPackageCategory);
        }
        
        if (packageSearch.trim()) {
            const q = packageSearch.trim().toLowerCase();
            filtered = filtered.filter((pkg) => {
                const en = (pkg.nameEn || "").toLowerCase();
                const ar = (pkg.nameAr || "").toLowerCase();
                const desc = (pkg.description || "").toLowerCase();
                return en.includes(q) || ar.includes(q) || desc.includes(q);
            });
        }
        
        return filtered;
    }, [packagesList, selectedPackageCategory, packageSearch]);

    // Apply search filter to items
    const filteredBySearch = useMemo(() => {
        if (!itemSearch.trim()) return availableItems;
        const q = itemSearch.trim().toLowerCase();
        return availableItems.filter((item) => {
            const name = (item.name || "").toLowerCase();
            const ar = (item.ar || "").toLowerCase();
            const desc = (item.description || "").toLowerCase();
            return name.includes(q) || ar.includes(q) || desc.includes(q);
        });
    }, [availableItems, itemSearch]);

    // Apply category filter to items
    const filteredItems = useMemo(() => {
        if (selectedItemCategory === "all") return filteredBySearch;
        return filteredBySearch.filter(item => getItemCategoryId(item) === selectedItemCategory);
    }, [filteredBySearch, selectedItemCategory]);

    const resetForm = () => {
        setEditPackageId(null);
        setNameEn("");
        setNameAr("");
        setDescription("");
        setDescriptionAr("");
        setPrice("");
        setCategoryId("");
        setSelectedItemIds([]);
        setDisplayTypes({});
        setItemQuantities({});
        setStringValues({});
        setAvailabilities({});
        setItemNotes({});
        setNameError("");
        setPriceError("");
    };

    const startEditPackage = (pkg: PackageType) => {
        setEditPackageId(pkg._id);
        setNameEn(pkg.nameEn || "");
        setNameAr(pkg.nameAr || "");
        setDescription(pkg.description || "");
        setDescriptionAr(pkg.descriptionAr || "");
        setPrice(pkg.price?.toString() || "");
        setCategoryId(getCategoryId((pkg as any).category));

        const ids: string[] = [];
        const quantities: Record<string, number> = {};
        const types: Record<string, DisplayType> = {};
        const strings: Record<string, string> = {};
        const bools: Record<string, boolean> = {};
        const notes: Record<string, string> = {};

        (pkg.items || []).forEach((entry: any) => {
            const itemObj = entry?.item || entry;
            const id = String(itemObj?._id || itemObj?.id || itemObj || "");
            if (!id) return;

            ids.push(id);

            if (typeof entry?.quantity === "number") {
                types[id] = "number";
                quantities[id] = Math.max(1, Number(entry.quantity) || 1);
            } else if (typeof entry?.quantity === "string") {
                types[id] = "string";
                strings[id] = entry.quantity;
            } else if (typeof entry?.quantity === "boolean") {
                types[id] = "availability";
                bools[id] = entry.quantity;
            } else {
                types[id] = "number";
                quantities[id] = 1;
            }

            notes[id] = typeof entry?.note === "string" ? entry.note : "";
        });

        setSelectedItemIds(ids);
        setDisplayTypes(types);
        setItemQuantities(quantities);
        setStringValues(strings);
        setAvailabilities(bools);
        setItemNotes(notes);
        setNameError("");
        setPriceError("");
        setError("");

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const duplicatePackage = (pkg: PackageType) => {
        setEditPackageId(null);
        setNameEn(pkg.nameEn || "");
        setNameAr(pkg.nameAr || "");
        setDescription(pkg.description || "");
        setDescriptionAr(pkg.descriptionAr || "");
        setPrice(pkg.price?.toString() || "");
        setCategoryId(getCategoryId((pkg as any).category));

        const ids: string[] = [];
        const quantities: Record<string, number> = {};
        const types: Record<string, DisplayType> = {};
        const strings: Record<string, string> = {};
        const bools: Record<string, boolean> = {};
        const notes: Record<string, string> = {};

        (pkg.items || []).forEach((entry: any) => {
            const itemObj = entry?.item || entry;
            const id = String(itemObj?._id || itemObj?.id || itemObj || "");
            if (!id) return;

            ids.push(id);

            if (typeof entry?.quantity === "number") {
                types[id] = "number";
                quantities[id] = Math.max(1, Number(entry.quantity) || 1);
            } else if (typeof entry?.quantity === "string") {
                types[id] = "string";
                strings[id] = entry.quantity;
            } else if (typeof entry?.quantity === "boolean") {
                types[id] = "availability";
                bools[id] = entry.quantity;
            } else {
                types[id] = "number";
                quantities[id] = 1;
            }

            notes[id] = typeof entry?.note === "string" ? entry.note : "";
        });

        setSelectedItemIds(ids);
        setDisplayTypes(types);
        setItemQuantities(quantities);
        setStringValues(strings);
        setAvailabilities(bools);
        setItemNotes(notes);
        setNameError("");
        setPriceError("");
        setError("");

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const location = useLocation();

    useEffect(() => {
        const locState = (location?.state as any)?.editPackageId;
        const searchId = typeof location?.search === "string" ? new URLSearchParams(location.search).get("id") : null;
        const pkgId = locState || searchId;
        if (!pkgId) return;

        let cancelled = false;

        const prefill = async () => {
            const existing = packagesList.find((p) => String(p._id || p.id) === String(pkgId));
            if (existing) {
                startEditPackage(existing);
                return;
            }

            try {
                const fetched = await getPackageById(String(pkgId));
                if (!cancelled && fetched) startEditPackage(fetched as PackageType);
            } catch (err: any) {
                if (!cancelled) setError(err?.message || tr("package_load_failed", "Failed to load package"));
            }
        };

        void prefill();

        return () => {
            cancelled = true;
        };
    }, [packagesList, location?.state, location?.search]);

    const removeItemSelection = (itemId: string) => {
        setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
        setDisplayTypes((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
        setItemQuantities((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
        setStringValues((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
        setAvailabilities((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
        setItemNotes((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    };

    const setItemSelected = (itemId: string, selected: boolean) => {
        if (!selected) {
            removeItemSelection(itemId);
            return;
        }

        setSelectedItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
        setDisplayTypes((prev) => ({ ...prev, [itemId]: prev[itemId] || "number" }));
        setItemQuantities((prev) => ({ ...prev, [itemId]: prev[itemId] || 1 }));
    };

    const setDisplayType = (itemId: string, nextType: DisplayType) => {
        setDisplayTypes((prev) => ({ ...prev, [itemId]: nextType }));
        if (nextType === "number") {
            setItemQuantities((prev) => ({ ...prev, [itemId]: prev[itemId] || 1 }));
        }
        if (nextType === "string") {
            setStringValues((prev) => ({ ...prev, [itemId]: prev[itemId] || "" }));
        }
        if (nextType === "availability") {
            setAvailabilities((prev) => ({ ...prev, [itemId]: prev[itemId] ?? true }));
        }
    };

    const buildItemsPayload = () => {
        return selectedItemIds
            .filter((itemId) => !itemId.startsWith("temp-item-"))
            .map((itemId) => {
                const type = displayTypes[itemId] || "number";
                let quantity: number | string | boolean = itemQuantities[itemId] || 1;

                if (type === "string") {
                    quantity = stringValues[itemId] || "";
                }
                if (type === "availability") {
                    quantity = !!availabilities[itemId];
                }

                return {
                    item: itemId,
                    quantity,
                    note: (itemNotes[itemId] || "").trim() || undefined,
                };
            });
    };

    const handleSubmit = async () => {
        const en = nameEn.trim();
        const ar = nameAr.trim();
        const p = price.trim();
        const itemsPayload = buildItemsPayload();

        if (!en) {
            setNameError(tr("package_name_required", "Package name is required"));
            return;
        }

        const normalizedAr = ar || en;

        const enHasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(en);
        const arHasLatin = /[A-Za-z]/.test(normalizedAr);
        if (enHasArabic) {
            setNameError(tr("english_only", "Please enter English text only in English field."));
            return;
        }
        if (ar && arHasLatin) {
            setNameError(tr("arabic_only", "Please enter Arabic text only in Arabic field."));
            return;
        }
        setNameError("");

        if (!p || Number.isNaN(Number(p)) || Number(p) <= 0) {
            setPriceError(tr("invalid_price", "Please enter a valid price."));
            return;
        }
        setPriceError("");

        if (itemsPayload.length === 0) {
            setError(tr("select_items", "Please select at least one item for the package"));
            return;
        }

        setIsSubmitting(true);
        setError("");

        const payload = {
            nameEn: en,
            nameAr: normalizedAr,
            price: Number(p),
            description: description.trim() || undefined,
            descriptionAr: descriptionAr.trim() || undefined,
            category: categoryId || undefined,
            items: itemsPayload,
        };

        try {
            if (editPackageId) {
                await updatePackageMutation.mutateAsync({ id: editPackageId, data: payload });
                await showAlert(tr("package_updated_success", "Package updated successfully"), "success");
            } else {
                await createPackageMutation.mutateAsync(payload);
                await showAlert(tr("package_created_success", "Package created successfully"), "success");
            }

            queryClient.invalidateQueries({ queryKey: packagesKeys.lists() });
            navigate("/packages");
        } catch (err: any) {
            setError(err?.response?.data?.message || tr("package_save_failed", "Failed to save package"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateItemInline = async () => {
        const en = newItemName.trim();
        const ar = newItemNameAr.trim();
        const descriptionEn = newItemDescription.trim();
        const descriptionArabic = newItemDescriptionAr.trim();
        setQuickAddError("");

        if (!en) {
            const msg = tr("item_name_required", "Item name is required");
            setError(msg);
            setQuickAddError(msg);
            return;
        }

        const enHasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(en);
        const arHasLatin = /[A-Za-z]/.test(ar);
        if (enHasArabic) {
            const msg = tr("english_only", "Please enter English text only in English field.");
            setError(msg);
            setQuickAddError(msg);
            return;
        }
        if (ar && arHasLatin) {
            const msg = tr("arabic_only", "Please enter Arabic text only in Arabic field.");
            setError(msg);
            setQuickAddError(msg);
            return;
        }

        setIsCreatingItem(true);
        setError("");
        setQuickAddError("");

        const tempId = `temp-item-${Date.now()}`;
        const optimisticItem: LocalItem = {
            _id: tempId,
            id: tempId,
            name: en,
            ar,
            description: descriptionEn || undefined,
            descriptionAr: descriptionArabic || undefined,
        };

        setAvailableItems((prev) => [optimisticItem, ...prev]);
        setSelectedItemIds((prev) => (prev.includes(tempId) ? prev : [...prev, tempId]));
        setDisplayTypes((prev) => ({ ...prev, [tempId]: prev[tempId] || "number" }));
        setItemQuantities((prev) => ({ ...prev, [tempId]: prev[tempId] || 1 }));
        setItemSearch("");

        setNewItemName("");
        setNewItemNameAr("");
        setNewItemDescription("");
        setNewItemDescriptionAr("");
        setShowQuickAdd(false);

        try {
            const created = await createItem({
                name: en,
                ar,
                description: descriptionEn || undefined,
                descriptionAr: descriptionArabic || undefined,
            });

            const createdItem = normalizeItem(created);
            const createdId = createdItem?._id || "";

            if (createdItem && createdId) {
                setAvailableItems((prev) => {
                    const withoutTemp = prev.filter((item) => getItemId(item) !== tempId);
                    if (withoutTemp.some((item) => getItemId(item) === createdId)) return withoutTemp;
                    return [createdItem, ...withoutTemp];
                });

                setSelectedItemIds((prev) => {
                    const replaced = prev.map((id) => (id === tempId ? createdId : id));
                    return replaced.includes(createdId) ? replaced.filter((id, idx) => replaced.indexOf(id) === idx) : [...replaced, createdId];
                });

                setDisplayTypes((prev) => {
                    const tempType = prev[tempId] || "number";
                    const next = { ...prev, [createdId]: prev[createdId] || tempType };
                    delete next[tempId];
                    return next;
                });

                setItemQuantities((prev) => {
                    const tempValue = prev[tempId] || 1;
                    const next = { ...prev, [createdId]: prev[createdId] || tempValue };
                    delete next[tempId];
                    return next;
                });

                setStringValues((prev) => {
                    if (!(tempId in prev)) return prev;
                    const next = { ...prev, [createdId]: prev[createdId] || prev[tempId] };
                    delete next[tempId];
                    return next;
                });

                setAvailabilities((prev) => {
                    if (!(tempId in prev)) return prev;
                    const next = { ...prev, [createdId]: prev[createdId] ?? prev[tempId] };
                    delete next[tempId];
                    return next;
                });

                setItemNotes((prev) => {
                    if (!(tempId in prev)) return prev;
                    const next = { ...prev, [createdId]: prev[createdId] || prev[tempId] };
                    delete next[tempId];
                    return next;
                });
            } else {
                setAvailableItems((prev) => prev.filter((item) => getItemId(item) !== tempId));
                setSelectedItemIds((prev) => prev.filter((id) => id !== tempId));
            }

            void loadItems();
        } catch (err: any) {
            const msg = err?.response?.data?.message || tr("item_create_failed", "Failed to create item");
            setError(msg);
            setQuickAddError(msg);

            setAvailableItems((prev) => prev.filter((item) => getItemId(item) !== tempId));
            setSelectedItemIds((prev) => prev.filter((id) => id !== tempId));
            setDisplayTypes((prev) => {
                const next = { ...prev };
                delete next[tempId];
                return next;
            });
            setItemQuantities((prev) => {
                const next = { ...prev };
                delete next[tempId];
                return next;
            });
            setStringValues((prev) => {
                const next = { ...prev };
                delete next[tempId];
                return next;
            });
            setAvailabilities((prev) => {
                const next = { ...prev };
                delete next[tempId];
                return next;
            });
            setItemNotes((prev) => {
                const next = { ...prev };
                delete next[tempId];
                return next;
            });
        } finally {
            setIsCreatingItem(false);
        }
    };

    const handleDelete = async (pkgId: string) => {
        const confirmed = await showConfirm(
            tr("confirm_delete", "Are you sure you want to delete this package?"),
            tr("yes", "Yes"),
            tr("no", "No"),
        );
        if (!confirmed) return;

        setDeletingId(pkgId);
        deleteMutation.mutate(pkgId, {
            onSuccess: () => {
                setDeletingId(null);
            },
            onError: () => {
                setDeletingId(null);
                setError(tr("delete_failed", "Failed to delete package"));
            },
        });
    };

    const selectedCount = selectedItemIds.length;
    const hasPendingTempItems = selectedItemIds.some((id) => id.startsWith("temp-item-"));

    if (itemsLoading && packagesLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-light-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 px-4 pb-10 sm:px-6 lg:px-8">
            {/* Header Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-secdark-700/15 blur-3xl" />
                <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-light-400/20 blur-3xl" />
                <div className="relative flex flex-col gap-3">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        {tr("packages_workspace", "Packages Workspace")}
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("create_package", "Create Package")}</h1>
                    <p className="text-sm text-light-600 dark:text-dark-300 sm:text-base">
                        {tr(
                            "package_workspace_subtitle",
                            "Manage services and packages in one practical workspace, then build a package with selected items.",
                        )}
                    </p>
                </div>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <div className="text-xs uppercase tracking-[0.08em] text-light-600 dark:text-dark-300">{tr("services", "Services")}</div>
                    <div className="mt-2 text-2xl font-semibold text-light-900 dark:text-dark-50">{services.length}</div>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <div className="text-xs uppercase tracking-[0.08em] text-light-600 dark:text-dark-300">{tr("packages", "Packages")}</div>
                    <div className="mt-2 text-2xl font-semibold text-light-900 dark:text-dark-50">{packagesList.length}</div>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <div className="text-xs uppercase tracking-[0.08em] text-light-600 dark:text-dark-300">{tr("filtered", "Filtered")}</div>
                    <div className="mt-2 text-2xl font-semibold text-light-900 dark:text-dark-50">{filteredPackages.length}</div>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <div className="text-xs uppercase tracking-[0.08em] text-light-600 dark:text-dark-300">{tr("selected_items", "Selected Items")}</div>
                    <div className="mt-2 text-2xl font-semibold text-light-900 dark:text-dark-50">{selectedCount}</div>
                </div>
            </section>

            {/* Packages Grid with Category Filter */}
            <section className="rounded-3xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-5">
                <div className="mb-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("packages", "Packages")}</h2>
                            <p className="text-sm text-light-600 dark:text-dark-400">
                                {tr("browse_packages", "Browse and select existing packages to edit or duplicate")}
                            </p>
                        </div>

                        <div className="relative w-full sm:max-w-xs">
                            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-light-500" />
                            <input
                                value={packageSearch}
                                onChange={(e) => setPackageSearch(e.target.value)}
                                placeholder={tr("search_packages", "Search packages")}
                                className="input w-full pl-9"
                            />
                        </div>
                    </div>

                    {/* Package Category Filter Chips */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedPackageCategory("all")}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                selectedPackageCategory === "all"
                                    ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                    : "bg-light-100 text-light-700 hover:bg-light-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-700"
                            }`}
                        >
                            <Tag size={12} className="inline mr-1" />
                            {tr("all_packages", "All Packages")}
                            <span className={`ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${
                                selectedPackageCategory === "all"
                                    ? "bg-white/20 text-white"
                                    : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                            }`}>
                                {packagesList.length}
                            </span>
                        </button>
                        
                        {packageCategories.map((category) => {
                            const count = getPackageCategoryCount(category._id);
                            if (count === 0) return null;
                            
                            return (
                                <button
                                    key={category._id}
                                    onClick={() => setSelectedPackageCategory(category._id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                        selectedPackageCategory === category._id
                                            ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                            : "bg-light-100 text-light-700 hover:bg-light-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-700"
                                    }`}
                                >
                                    <FolderOpen size={12} className="inline mr-1" />
                                    {getCategoryDisplayName(category, lang)}
                                    <span className={`ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${
                                        selectedPackageCategory === category._id
                                            ? "bg-white/20 text-white"
                                            : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {packagesLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-light-500" />
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredPackages.map((pkg) => {
                            const pkgId = String(pkg._id || "");
                            const itemsCount = Array.isArray(pkg.items) ? pkg.items.length : 0;
                            const pkgCategoryName = getPackageCategoryName(getPackageCategoryId(pkg));

                            return (
                                <article
                                    key={pkgId}
                                    className="group flex h-full flex-col justify-between rounded-2xl border border-light-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800"
                                >
                                    <div>
                                        <div className="mb-2 flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="truncate text-base font-semibold text-light-900 dark:text-dark-50">
                                                    {pkg.nameEn || pkg.nameAr || tr("unnamed_package", "Unnamed package")}
                                                </h3>
                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-light-100 px-2 py-0.5 text-[10px] font-medium text-light-700 dark:bg-dark-700 dark:text-dark-300">
                                                        <PackageIcon size={10} />
                                                        {itemsCount} {tr("items", "items")}
                                                    </span>
                                                    {pkgCategoryName !== tr("no_category", "No category") && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-light-100 px-2 py-0.5 text-[10px] font-medium text-light-700 dark:bg-dark-700 dark:text-dark-300">
                                                            <FolderOpen size={10} />
                                                            {pkgCategoryName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-light-100 px-2.5 py-1 text-xs font-semibold text-light-700 dark:bg-dark-700 dark:text-dark-200">
                                                {pkg.price ? `${pkg.price} EGP` : "-"}
                                            </div>
                                        </div>

                                        {pkg.description && (
                                            <p className="line-clamp-2 text-xs text-light-600 dark:text-dark-400">{pkg.description}</p>
                                        )}
                                    </div>

                                    <div className="mt-4 flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => duplicatePackage(pkg)}
                                            className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs"
                                        >
                                            <Copy size={14} />
                                            {tr("duplicate", "Duplicate")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => startEditPackage(pkg)}
                                            className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs"
                                        >
                                            <Check size={14} />
                                            {tr("edit", "Edit")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(pkgId)}
                                            disabled={deletingId === pkgId}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-danger-200 px-2.5 py-1.5 text-xs font-medium text-danger-600 transition hover:bg-danger-50 disabled:opacity-60 dark:border-danger-800/60 dark:hover:bg-danger-900/20"
                                        >
                                            {deletingId === pkgId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                            {tr("delete", "Delete")}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}

                        {filteredPackages.length === 0 && (
                            <div className="col-span-full rounded-2xl border border-dashed border-light-300 bg-light-50/70 px-4 py-10 text-center text-sm text-light-600 dark:border-dark-700 dark:bg-dark-900/30 dark:text-dark-300">
                                {tr("no_packages", "No packages found for this filter.")}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {error && (
                <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                    {error}
                </div>
            )}

            {/* Package Builder Sections */}
            <div className="space-y-6">
                {/* Package Information Section */}
                <section className="rounded-3xl border border-light-200/70 bg-white/90 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65">
                    <div className="border-b border-light-200/70 px-6 py-4 dark:border-dark-700/70">
                        <h2 className="text-xl font-semibold text-light-900 dark:text-dark-50">
                            {editPackageId ? tr("edit_package", "Edit Package") : tr("package_information", "Package Information")}
                        </h2>
                        <p className="text-sm text-light-600 dark:text-dark-400">
                            {tr("package_info_subtitle", "Enter the basic details of your package.")}
                        </p>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("package_name_en", "Package Name (English)")} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        value={nameEn}
                                        onChange={(e) => setNameEn(e.target.value)}
                                        placeholder="e.g., Premium Package"
                                        className="input w-full"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("package_name_ar", "Package Name (Arabic)")}
                                    </label>
                                    <input
                                        value={nameAr}
                                        onChange={(e) => setNameAr(e.target.value)}
                                        placeholder="اسم الباقة"
                                        className="input w-full"
                                    />
                                </div>

                                {nameError && <p className="text-xs text-danger-500">{nameError}</p>}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("package_price", "Price")} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="input w-full"
                                    />
                                    {priceError && <p className="mt-1 text-xs text-danger-500">{priceError}</p>}
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("category", "Category")}
                                    </label>
                                    <select
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="input w-full"
                                    >
                                        <option value="">{tr("no_category", "No category")}</option>
                                        {packageCategoriesLoading ? (
                                            <option value="" disabled>{tr("loading", "Loading...")}</option>
                                        ) : (
                                            packageCategories.map((category) => (
                                                <option key={category._id} value={category._id}>
                                                    {getCategoryDisplayName(category, lang)}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                                    {tr("package_description", "Description (English)")}
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe what this package includes..."
                                    rows={8}
                                    className="input w-full min-h-[100px] resize-y"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                                    {tr("package_description_ar", "Description (Arabic)")}
                                </label>
                                <textarea
                                    value={descriptionAr}
                                    onChange={(e) => setDescriptionAr(e.target.value)}
                                    placeholder="وصف الباقة..."
                                    rows={8}
                                    dir="rtl"
                                    className="input w-full min-h-[100px] resize-y"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Items Selection Section */}
                <section className="rounded-3xl border border-light-200/70 bg-white/90 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65">
                    <div className="border-b border-light-200/70 px-6 py-4 dark:border-dark-700/70">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-light-900 dark:text-dark-50 flex items-center gap-2">
                                    <ShoppingBag size={20} />
                                    {tr("select_items", "Select Items")}
                                </h2>
                                <p className="text-sm text-light-600 dark:text-dark-400">
                                    {tr("select_items_subtitle", "Choose items to include in this package and configure their properties.")}
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-light-50 px-3 py-1.5 text-xs font-semibold text-light-700 dark:bg-dark-900/20 dark:text-dark-300">
                                <PackageIcon size={14} />
                                {selectedCount} {tr("items_selected", "selected")}
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Search and Filter Bar */}
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedItemCategory("all")}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                        selectedItemCategory === "all"
                                            ? "bg-primary-500 text-white"
                                            : "bg-light-100 text-light-700 hover:bg-light-200 dark:bg-dark-800 dark:text-dark-300"
                                    }`}
                                >
                                    {tr("all", "All")}
                                    <span className="ml-1.5 inline-block rounded-full bg-white/20 px-1.5 text-[10px]">
                                        {filteredBySearch.length}
                                    </span>
                                </button>
                                {itemCategories.map((cat) => {
                                    const count = getItemCategoryCount(cat._id);
                                    if (count === 0) return null;
                                    return (
                                        <button
                                            key={cat._id}
                                            onClick={() => setSelectedItemCategory(cat._id)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                selectedItemCategory === cat._id
                                                    ? "bg-primary-500 text-white"
                                                    : "bg-light-100 text-light-700 hover:bg-light-200 dark:bg-dark-800 dark:text-dark-300"
                                            }`}
                                        >
                                            {getCategoryDisplayName(cat, lang)}
                                            <span className="ml-1.5 inline-block rounded-full bg-white/20 px-1.5 text-[10px]">
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="relative w-full sm:w-64">
                                <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-light-500" />
                                <input
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                    placeholder={tr("search_items", "Search items...")}
                                    className="input w-full pl-9"
                                />
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="max-h-[500px] space-y-2 overflow-auto">
                            {itemsLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : filteredItems.length > 0 ? (
                                filteredItems.map((item) => {
                                    const isSelected = selectedItemIds.includes(item._id);
                                    const selectedType = displayTypes[item._id] || "number";

                                    return (
                                        <div
                                            key={item._id}
                                            className={`rounded-lg border p-3 transition ${
                                                isSelected
                                                    ? "border-primary-300 bg-primary-50/50 dark:border-primary-700 dark:bg-primary-900/20"
                                                    : "border-light-200 bg-white dark:border-dark-700 dark:bg-dark-800"
                                            }`}
                                        >
                                            <label className="flex cursor-pointer items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => setItemSelected(item._id, e.target.checked)}
                                                    className="mt-0.5 h-4 w-4 rounded border-light-300"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-light-900 dark:text-dark-50">{item.name}</div>
                                                    {item.description && (
                                                        <div className="text-xs text-light-500 dark:text-dark-400">{item.description}</div>
                                                    )}
                                                </div>
                                            </label>

                                            {isSelected && (
                                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                    <div>
                                                        <label className="mb-1 block text-xs text-light-600 dark:text-dark-400">Type</label>
                                                        <select
                                                            value={selectedType}
                                                            onChange={(e) => setDisplayType(item._id, e.target.value as DisplayType)}
                                                            className="input w-full text-sm"
                                                        >
                                                            <option value="number">Number</option>
                                                            <option value="string">Text</option>
                                                            <option value="availability">Availability</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="mb-1 block text-xs text-light-600 dark:text-dark-400">Value</label>
                                                        {selectedType === "number" && (
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={itemQuantities[item._id] || 1}
                                                                onChange={(e) => setItemQuantities(prev => ({ ...prev, [item._id]: Math.max(1, Number(e.target.value)) }))}
                                                                className="input w-full text-sm"
                                                            />
                                                        )}
                                                        {selectedType === "string" && (
                                                            <input
                                                                value={stringValues[item._id] || ""}
                                                                onChange={(e) => setStringValues(prev => ({ ...prev, [item._id]: e.target.value }))}
                                                                placeholder="Text value"
                                                                className="input w-full text-sm"
                                                            />
                                                        )}
                                                        {selectedType === "availability" && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setAvailabilities(prev => ({ ...prev, [item._id]: !prev[item._id] }))}
                                                                className={`h-9 w-full rounded-lg text-sm font-medium ${
                                                                    availabilities[item._id]
                                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                                                        : "bg-light-100 text-light-700 dark:bg-dark-700 dark:text-dark-300"
                                                                }`}
                                                            >
                                                                {availabilities[item._id] ? "Available" : "Not Available"}
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="mb-1 block text-xs text-light-600 dark:text-dark-400">Note (Optional)</label>
                                                        <input
                                                            value={itemNotes[item._id] || ""}
                                                            onChange={(e) => setItemNotes(prev => ({ ...prev, [item._id]: e.target.value }))}
                                                            placeholder="Add a note..."
                                                            className="input w-full text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="rounded-lg border border-dashed border-light-300 p-8 text-center text-sm text-light-500">
                                    {tr("no_items_available", "No items available.")}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Quick Add Item Section */}
                <section className="rounded-3xl border border-light-200/70 bg-gradient-to-br from-primary-50/50 to-white/90 shadow-sm dark:border-primary-800/30 dark:from-primary-900/10 dark:to-dark-900/65">
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-primary-700 dark:text-dark-300 flex items-center gap-2">
                                    <Plus size={18} />
                                    {tr("quick_add_item", "Quick Add Item")}
                                </h3>
                                <p className="mt-1 text-sm text-light-600 dark:text-light-400">
                                    {tr("quick_add_hint", "Don't see the item you need? Create a new item and it will be automatically added to this package.")}
                                </p>
                            </div>
                            {!showQuickAdd && (
                                <button
                                    onClick={() => setShowQuickAdd(true)}
                                    className="rounded-lg border border-primary-300 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-50 dark:border-primary-700 dark:text-primary-300 dark:hover:bg-primary-900/20"
                                >
                                    <Plus size={16} className="inline mr-1" />
                                    {tr("add_new_item", "Add New Item")}
                                </button>
                            )}
                        </div>

                        {showQuickAdd && (
                            <div className="mt-4 rounded-xl border border-primary-200 bg-white p-4 dark:border-primary-800 dark:bg-dark-800">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("item_name_en", "Item Name (English)")} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={newItemName}
                                            onChange={(e) => setNewItemName(e.target.value)}
                                            placeholder="Enter item name"
                                            className="input w-full"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("item_name_ar", "Item Name (Arabic)")}
                                        </label>
                                        <input
                                            value={newItemNameAr}
                                            onChange={(e) => setNewItemNameAr(e.target.value)}
                                            placeholder="اسم العنصر"
                                            className="input w-full"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="mb-1 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("item_description_en", "Description (English)")}
                                        </label>
                                        <textarea
                                            value={newItemDescription}
                                            onChange={(e) => setNewItemDescription(e.target.value)}
                                            rows={6}
                                            className="input w-full min-h-[100px] resize-y"
                                            placeholder="Enter item description"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="mb-1 block text-sm font-medium text-light-700 dark:text-dark-300">
                                            {tr("item_description_ar", "Description (Arabic)")}
                                        </label>
                                        <textarea
                                            value={newItemDescriptionAr}
                                            onChange={(e) => setNewItemDescriptionAr(e.target.value)}
                                            rows={6}
                                            className="input w-full min-h-[100px] resize-y"
                                            placeholder="وصف العنصر"
                                            dir="rtl"
                                        />
                                    </div>
                                </div>

                                {quickAddError && (
                                    <div className="mt-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-600">
                                        {quickAddError}
                                    </div>
                                )}

                                <div className="mt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowQuickAdd(false);
                                            setQuickAddError("");
                                            setNewItemName("");
                                            setNewItemNameAr("");
                                            setNewItemDescription("");
                                            setNewItemDescriptionAr("");
                                        }}
                                        className="rounded-lg border border-light-300 px-4 py-2 text-sm font-medium text-light-700 hover:bg-light-50"
                                    >
                                        {tr("cancel", "Cancel")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCreateItemInline}
                                        disabled={isCreatingItem}
                                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                                    >
                                        {isCreatingItem ? (
                                            <>
                                                <Loader2 size={14} className="mr-2 inline animate-spin" />
                                                {tr("creating", "Creating...")}
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={14} className="mr-2 inline" />
                                                {tr("create_item", "Create Item")}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Form Actions */}
                <div className="flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (editPackageId) {
                                resetForm();
                            } else {
                                navigate("/packages");
                            }
                        }}
                        className="rounded-lg border border-light-300 px-6 py-2.5 text-sm font-medium text-light-700 transition hover:bg-light-50 dark:border-dark-600 dark:text-dark-300 dark:hover:bg-dark-800"
                    >
                        {tr("cancel", "Cancel")}
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <Loader2 size={16} className="mr-2 inline animate-spin" />
                        ) : editPackageId ? (
                            <Check size={16} className="mr-2 inline" />
                        ) : (
                            <Plus size={16} className="mr-2 inline" />
                        )}
                        {isSubmitting
                            ? editPackageId ? tr("updating", "Updating...") : tr("creating", "Creating...")
                            : editPackageId ? tr("update_package", "Update Package") : tr("create_package", "Create Package")}
                    </button>
                </div>

                {hasPendingTempItems && (
                    <p className="text-right text-xs text-amber-600 dark:text-amber-400">
                        {tr("pending_items_note", "Some items are still syncing...")}
                    </p>
                )}
            </div>
        </div>
    );
};

export default AddPackagePage;