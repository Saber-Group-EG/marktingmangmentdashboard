import { useEffect, useMemo, useState } from "react";
import { Plus, FileText, Loader2, Trash2, Check, X } from "lucide-react";
import LocalizedArrow from "@/components/LocalizedArrow";
import { useLang } from "@/hooks/useLang";
import { showAlert, showToast } from "@/utils/swal";
import { useCreateQuotation, useUpdateQuotation, useItems, usePackages, useCategories } from "@/hooks/queries";
import { getCategoryDisplayName } from "@/api/requests/categoriesService";
import { getQuotationById } from "@/api/requests/quotationsService";
import type { CustomService, CreateQuotationPayload } from "@/api/requests/quotationsService";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";

interface CreateQuotationProps {
    clientId?: string;
    clientName: string;
    onBack: () => void;
    onSuccess?: (clientId?: string, clientName?: string) => void;
    editQuotation?: any;
}

const getEntityId = (entity: any): string => String(entity?._id ?? entity?.id ?? "");

const getCategoryId = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return String(value._id || value.id || "");
};

const CreateQuotation = ({ clientId, clientName, onBack, onSuccess, editQuotation }: CreateQuotationProps) => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const { data: packagesResponse } = usePackages({ limit: 1000 });
    const allPackagesCatalog = packagesResponse?.data || [];
    const { data: itemsResponse } = useItems({ limit: 1000 });
    const items = itemsResponse?.data || [];
    const { data: packageCategoriesResponse } = useCategories({ type: "package", page: 1 });
    const packageCategories = packageCategoriesResponse?.categories || [];

    const createQuotationMutation = useCreateQuotation();
    const updateQuotationMutation = useUpdateQuotation();
    const isSaving = createQuotationMutation.isPending || updateQuotationMutation.isPending;

    const [selectedPackageCategory, setSelectedPackageCategory] = useState<string>("all");
    const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
    const [customServices, setCustomServices] = useState<CustomService[]>([]);
    const [enteredClientName, setEnteredClientName] = useState<string>(editQuotation?.clientName || clientName || "");
    const [quotationNote, setQuotationNote] = useState<string>(editQuotation?.note || "");
    const [discountValue, setDiscountValue] = useState<string>(editQuotation?.discountValue?.toString() || "");
    const [discountType, setDiscountType] = useState<"percentage" | "fixed">(editQuotation?.discountType || "percentage");
    const [overriddenTotal] = useState<string>(editQuotation?.overriddenTotal?.toString() || "");
    const [validUntil, setValidUntil] = useState<string>(editQuotation?.validUntil ? editQuotation.validUntil.split("T")[0] : "");
    const [customServiceName, setCustomServiceName] = useState<string>("");
    const [customNameAr, setCustomNameAr] = useState<string>("");
    const [customPrice, setCustomPrice] = useState<string>("");

    useEffect(() => {
        if (editQuotation) {
            setEnteredClientName(editQuotation.clientName || clientName || "");
            setSelectedPackages((editQuotation.packages || []).map((p: any) => (typeof p === "string" ? p : getEntityId(p))).filter(Boolean));
            setCustomServices(editQuotation.customServices || []);
            setQuotationNote(editQuotation.note || "");
            setDiscountValue(editQuotation.discountValue?.toString() || "");
            setDiscountType(editQuotation.discountType || "percentage");
            setValidUntil(editQuotation.validUntil ? editQuotation.validUntil.split("T")[0] : "");
        }
    }, [clientName, editQuotation]);

    const filteredPackages = useMemo(() => {
        if (selectedPackageCategory === "all") return allPackagesCatalog;
        return allPackagesCatalog.filter((pkg: any) => getCategoryId((pkg as any).category) === selectedPackageCategory);
    }, [allPackagesCatalog, selectedPackageCategory]);

    const togglePackage = (packageId: string) => {
        setSelectedPackages((prev) => (prev.includes(packageId) ? prev.filter((id) => id !== packageId) : [...prev, packageId]));
    };

    const addCustomService = () => {
        const name = customServiceName.trim();
        const nameAr = customNameAr.trim();
        const price = parseFloat(customPrice);
        if ((!name && !nameAr) || isNaN(price) || price <= 0) return;

        setCustomServices((prev) => [
            ...prev,
            {
                id: `custom_${Date.now()}`,
                en: name || nameAr,
                ar: nameAr || name,
                price,
            },
        ]);
        setCustomServiceName("");
        setCustomNameAr("");
        setCustomPrice("");
    };

    const removeCustomService = (id: string) => {
        setCustomServices((prev) => prev.filter((service) => service.id !== id));
    };

    const calculateSubtotal = () => {
        const packagesTotal = selectedPackages.reduce((sum, pkgId) => {
            const pkg = allPackagesCatalog.find((entry: any) => getEntityId(entry) === String(pkgId));
            return sum + (Number(pkg?.price) || 0);
        }, 0);

        const customTotal = customServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0);
        return packagesTotal + customTotal;
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const discount = parseFloat(discountValue) || 0;
        const discountAmount = discountType === "percentage" ? (subtotal * discount) / 100 : Math.min(discount, subtotal);
        return subtotal - discountAmount;
    };

    const handleCreateOrUpdateQuotation = async () => {
        if (selectedPackages.length === 0 && customServices.length === 0) {
            showAlert(t("please_select_services") || "Please select at least one service", "warning");
            return;
        }

        if (!clientId && !enteredClientName.trim()) {
            showAlert(t("please_enter_client_name") || "Please enter client name", "warning");
            return;
        }

        try {
            const payload: CreateQuotationPayload = {
                packages: selectedPackages.length > 0 ? selectedPackages : undefined,
                customServices: customServices.length > 0 ? customServices : undefined,
                clientName: clientId ? undefined : enteredClientName || undefined,
                discountValue: parseFloat(discountValue) || 0,
                discountType,
                note: quotationNote || undefined,
                validUntil: validUntil || undefined,
            };

            if (clientId && clientId !== "global") {
                payload.clientId = clientId;
            }
            if (overriddenTotal) {
                payload.overriddenTotal = parseFloat(overriddenTotal);
            }

            let result: any = null;
            if (editQuotation?._id) {
                result = await updateQuotationMutation.mutateAsync({ id: editQuotation._id, payload });
                showToast(t("quotation_updated_successfully") || "Quotation updated successfully!", "success");
            } else {
                result = await createQuotationMutation.mutateAsync(payload);
                showToast(t("quotation_created_successfully") || "Quotation created successfully!", "success");
            }

            const createdOrUpdated = result?.data ?? result;
            const extractClientId = (maybe: any): string | undefined => {
                if (!maybe) return undefined;
                if (typeof maybe === "string") return maybe;
                if (typeof maybe === "object") return maybe._id ?? maybe.id ?? undefined;
                return undefined;
            };

            let resultingClientId = extractClientId(createdOrUpdated?.clientId) ?? extractClientId(clientId);
            const navClientName = createdOrUpdated?.clientName ?? clientName ?? enteredClientName;

            if (!resultingClientId && createdOrUpdated?._id) {
                try {
                    const full = await getQuotationById(createdOrUpdated._id);
                    const fullData = full?.data ?? full;
                    resultingClientId = extractClientId(fullData?.clientId) ?? resultingClientId;
                } catch {
                    // Best effort only.
                }
            }

            if (onSuccess) {
                onSuccess(resultingClientId, navClientName);
            } else {
                onBack();
            }
        } catch (error: any) {
            showAlert(error?.response?.data?.message || t("failed_to_save_quotation") || "Failed to save quotation", "error");
        }
    };

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex items-start gap-4">
                    <button onClick={onBack} className="btn-ghost rounded-xl">
                        <LocalizedArrow size={20} />
                    </button>
                    <div>
                        <span className="inline-flex items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                            Quotation Builder
                        </span>
                        <h2 className="text-light-900 dark:text-dark-50 mt-3 text-xl font-bold sm:text-2xl">
                            {editQuotation ? tr("edit_quotation", "Edit Quotation") : tr("create_quotation", "Create Quotation")}
                        </h2>
                        <p className="text-light-600 dark:text-dark-300 mt-1 text-sm">{clientName}</p>
                    </div>
                </div>
            </section>

            <div className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                {!clientId && (
                    <div className="mb-6">
                        <label className="text-dark-700 dark:text-dark-400 mb-2 block text-sm font-semibold">
                            {t("client_name") || "Client Name"} *
                        </label>
                        <input
                            type="text"
                            value={enteredClientName}
                            onChange={(e) => setEnteredClientName(e.target.value)}
                            placeholder={t("enter_client_name") || "Enter client name..."}
                            className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                        />
                    </div>
                )}

                <div className="mb-6">
                    <h4 className="text-light-900 dark:text-dark-50 mb-3 font-semibold">{t("select_packages") || "Select Packages"}</h4>

                    <div className="mb-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedPackageCategory("all")}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                                selectedPackageCategory === "all"
                                    ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                    : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:bg-dark-700"
                            }`}
                        >
                            {tr("all", "All")}
                            <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                                selectedPackageCategory === "all"
                                    ? "bg-white/20 text-white"
                                    : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                            }`}>
                                {allPackagesCatalog.length}
                            </span>
                        </button>

                        {packageCategories.map((category) => {
                            const count = allPackagesCatalog.filter((pkg: any) => getCategoryId((pkg as any).category) === category._id).length;
                            if (count === 0) return null;

                            return (
                                <button
                                    key={category._id}
                                    type="button"
                                    onClick={() => setSelectedPackageCategory(category._id)}
                                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                                        selectedPackageCategory === category._id
                                            ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                            : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:bg-dark-700"
                                    }`}
                                >
                                    {getCategoryDisplayName(category, lang)}
                                    <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
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

                    {allPackagesCatalog.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredPackages.map((pkg: any) => {
                                const pkgId = getEntityId(pkg);
                                if (!pkgId) return null;
                                const isSelected = selectedPackages.includes(pkgId);
                                const pkgItems: Array<{ label: string; quantity?: number | string | boolean }> = (pkg.items || []).map((it: any) => {
                                    const inner = (it && (it.item || it)) || {};
                                    let name = inner?.name || inner?.nameEn || inner?.nameAr || "(item)";
                                    const quantity = typeof it?.quantity !== "undefined" ? it.quantity : inner?.quantity;

                                    if ((!name || name === "(item)") && inner) {
                                        const itemId = typeof inner === "string" ? inner : inner?._id || inner?.id;
                                        if (itemId) {
                                            const found = items.find((i: any) => String(i._id) === String(itemId) || String(i.id) === String(itemId));
                                            if (found) name = found.name || found.ar || name;
                                        }
                                    }

                                    return { label: name || "(item)", quantity };
                                });

                                return (
                                    <button
                                        key={pkgId}
                                        type="button"
                                        onClick={() => togglePackage(pkgId)}
                                        className={`cursor-pointer rounded-lg border px-3 py-3 text-left transition-all hover:shadow-md ${
                                            isSelected
                                                ? "border-light-500 bg-light-500 dark:bg-secdark-700 dark:border-secdark-700 text-white shadow-sm"
                                                : "border-light-600 dark:border-dark-700 dark:bg-dark-800 text-light-900 dark:text-dark-50 hover:border-light-500 dark:hover:border-secdark-700 bg-white"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className={`mb-1 text-sm font-medium ${isSelected ? "text-white" : "text-light-900 dark:text-dark-50"}`}>
                                                    {lang === "ar" ? pkg.nameAr : pkg.nameEn}
                                                </div>
                                                {pkg.description && (
                                                    <div className={`line-clamp-2 text-xs ${isSelected ? "text-white opacity-90" : "text-light-600 dark:text-dark-400"}`}>
                                                        {pkg.description}
                                                    </div>
                                                )}
                                                {pkgItems.length > 0 && (
                                                    <div className="mt-2">
                                                        <div className={`flex flex-wrap gap-2 ${isSelected ? "text-white/90" : "text-light-600 dark:text-dark-400"}`}>
                                                            {pkgItems.map((item, index) => (
                                                                <div
                                                                    key={index}
                                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                                                                        isSelected
                                                                            ? "bg-white/10 text-white"
                                                                            : "bg-light-50 text-light-900 dark:bg-dark-700 dark:text-dark-50"
                                                                    }`}
                                                                >
                                                                    <span className="truncate">{item.label}</span>
                                                                    {typeof item.quantity !== "undefined" &&
                                                                        (typeof item.quantity === "boolean" ? (
                                                                            <span className="ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs">
                                                                                {item.quantity ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-red-600" />}
                                                                            </span>
                                                                        ) : typeof item.quantity === "number" ? (
                                                                            <span className="bg-light-100 dark:bg-dark-700 text-light-900 dark:text-dark-50 ml-2 inline-block rounded-md px-2 py-0.5 text-xs">
                                                                                x{item.quantity}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="bg-light-100 dark:bg-dark-700 text-light-900 dark:text-dark-50 ml-2 inline-block rounded-md px-2 py-0.5 text-xs">
                                                                                {String(item.quantity)}
                                                                            </span>
                                                                        ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`text-sm font-semibold whitespace-nowrap ${isSelected ? "text-white" : "text-light-900 dark:text-dark-50"}`}>
                                                {pkg.price} {lang === "ar" ? "ج.م" : "EGP"}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="border-light-600 dark:border-dark-700 text-light-600 dark:text-dark-400 rounded-lg border border-dashed px-4 py-3 text-sm">
                            {t("no_packages_available") || "No packages available"}
                        </div>
                    )}
                </div>

                <div className="mb-6">
                    <h4 className="text-light-900 dark:text-dark-50 mb-3 font-semibold">{t("custom_services") || "Custom Services"}</h4>

                    {customServices.length > 0 && (
                        <div className="mb-3 space-y-2">
                            {customServices.map((service) => (
                                <div key={service.id} className="border-light-600 dark:border-dark-700 bg-light-50 dark:bg-dark-800 flex items-center justify-between rounded-lg border px-4 py-2">
                                    <div>
                                        <div className="text-light-900 dark:text-dark-50 font-medium">{lang === "ar" ? service.ar : service.en}</div>
                                        <div className="text-light-600 dark:text-dark-400 text-sm">
                                            {service.price} {lang === "ar" ? "ج.م" : "EGP"}
                                        </div>
                                    </div>
                                    <button onClick={() => removeCustomService(service.id)} className="btn-ghost text-danger-500" title={t("remove") || "Remove"}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[150px] flex-1">
                            <input
                                type="text"
                                value={customServiceName}
                                onChange={(e) => setCustomServiceName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addCustomService();
                                    }
                                }}
                                placeholder={t("service_name_en") || "Service name (English)"}
                                className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="min-w-[150px] flex-1">
                            <input
                                type="text"
                                value={customNameAr}
                                onChange={(e) => setCustomNameAr(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addCustomService();
                                    }
                                }}
                                placeholder={t("service_name_ar") || "اسم الخدمة (بالعربية)"}
                                className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="w-32">
                            <input
                                type="number"
                                value={customPrice}
                                onChange={(e) => setCustomPrice(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addCustomService();
                                    }
                                }}
                                placeholder={t("price") || "Price"}
                                className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                            />
                        </div>
                        <button type="button" onClick={addCustomService} className="btn-ghost flex items-center gap-2 px-3 py-2">
                            <Plus size={14} />
                            {t("add") || "Add"}
                        </button>
                    </div>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="text-dark-700 dark:text-dark-400 mb-2 block text-sm">{t("valid_until") || "Valid Until"}</label>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                value={validUntil ? dayjs(validUntil) : null}
                                onChange={(newValue: Dayjs | null) => setValidUntil(newValue ? newValue.format("YYYY-MM-DD") : "")}
                                slotProps={{
                                    textField: {
                                        size: "small",
                                        className:
                                            "border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-white dark:bg-dark-800 px-3 py-2 text-sm",
                                    },
                                }}
                            />
                        </LocalizationProvider>
                    </div>
                    <div>
                        <label className="text-dark-700 dark:text-dark-400 mb-2 block text-sm">{t("note") || "Note"}</label>
                        <textarea
                            value={quotationNote}
                            onChange={(e) => setQuotationNote(e.target.value)}
                            rows={3}
                            className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <div>
                        <label className="text-dark-700 dark:text-dark-400 mb-2 block text-sm">{t("discount_type") || "Discount Type"}</label>
                        <select
                            value={discountType}
                            onChange={(e) => setDiscountType(e.target.value as any)}
                            className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                        >
                            <option value="percentage">{t("percentage") || "Percentage"}</option>
                            <option value="fixed">{t("fixed") || "Fixed Amount"}</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-dark-700 dark:text-dark-400 mb-2 block text-sm">{t("discount_value") || "Discount Value"}</label>
                        <input
                            type="number"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                            className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-dark-700 dark:text-dark-400 mb-2 block text-sm">{t("total_override") || "Total Override"}</label>
                        <input
                            type="number"
                            value={overriddenTotal}
                            disabled
                            className="border-light-600 dark:border-dark-700 text-light-900 dark:text-dark-50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm opacity-70"
                        />
                    </div>
                </div>

                <div className="border-light-600 dark:border-dark-700 flex items-center justify-between border-t pt-4">
                    <div>
                        <p className="text-light-900 dark:text-dark-50 text-base">
                            {t("subtotal") || "Subtotal"}: {calculateSubtotal().toFixed(2)} {lang === "ar" ? "ج.م" : "EGP"}
                        </p>
                        <p className="text-light-900 dark:text-dark-50 text-lg font-bold">
                            {t("total") || "Total"}: {calculateTotal().toFixed(2)} {lang === "ar" ? "ج.م" : "EGP"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="btn-ghost">
                            {t("cancel") || "Cancel"}
                        </button>
                        <button onClick={handleCreateOrUpdateQuotation} disabled={isSaving} className="btn-primary flex items-center gap-2">
                            {isSaving ? <Loader2 size={16} className="text-light-500 animate-spin" /> : <FileText size={16} />}
                            {editQuotation ? t("update_quotation") || "Update Quotation" : t("create_quotation") || "Create Quotation"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateQuotation;
