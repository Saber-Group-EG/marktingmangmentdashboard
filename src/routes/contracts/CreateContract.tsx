import { useState, useEffect, useMemo, KeyboardEvent } from "react";
import { Loader2, FileCheck, Plus, Edit2, Trash2, Check, X, GripVertical, Sparkles } from "lucide-react";
import LocalizedArrow from "@/components/LocalizedArrow";
import { useLang } from "@/hooks/useLang";
import { showAlert, showToast } from "@/utils/swal";
import { useCreateContract, useUpdateContract, useQuotations, useItems, useContracts, useCategories } from "@/hooks/queries";
import { getCategoryDisplayName } from "@/api/requests/categoriesService";
import { useContractTerms } from "@/hooks/queries/useContractTermsQuery";
import { getQuotationById } from "@/api/requests/quotationsService";
import { getContractById, type Contract } from "@/api/requests/contractsService";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";

interface CreateContractProps {
    clientId?: string;
    clientName: string;
    onBack: () => void;
    onSuccess?: (contractId?: string) => void;
    editContract?: Contract | null;
    quotationId?: string; // If converting from quotation
}

const CreateContract = ({ clientId, clientName, onBack, onSuccess, editContract, quotationId }: CreateContractProps) => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const v = t(key);
        return v && v !== key ? v : fallback;
    };

    const createContractMutation = useCreateContract();
    const updateContractMutation = useUpdateContract();

    // Fetch quotations and resolve only those belonging to the selected client.
    // Some backends may ignore clientId filter or return different response shapes,
    // so we safely normalize and filter on the frontend as well.
    const { data: quotationsResponse, isLoading: quotationsLoading } = useQuotations(
        { page: 1, limit: 1000, clientId },
        { enabled: !!clientId },
    );

    const clientQuotations = useMemo(() => {
        const normalizeId = (value: any): string => {
            if (!value) return "";
            if (typeof value === "string") return value;
            if (typeof value === "object") return String(value._id || value.id || "");
            return String(value);
        };

        const source = Array.isArray((quotationsResponse as any)?.data)
            ? (quotationsResponse as any).data
            : Array.isArray((quotationsResponse as any)?.quotations)
              ? (quotationsResponse as any).quotations
              : Array.isArray((quotationsResponse as any)?.data?.quotations)
                ? (quotationsResponse as any).data.quotations
                : [];

        const selectedClientId = normalizeId(clientId);
        if (!selectedClientId) return [];

        return source.filter((q: any) => {
            const qClientId = normalizeId(q?.clientId || q?.client);
            return qClientId && qClientId === selectedClientId;
        });
    }, [quotationsResponse, clientId]);

    // Fetch all contracts to allow loading terms from existing contracts
    const { data: contractsResponse, isLoading: contractsLoading } = useContracts({ page: 1, limit: 1000 });
    const allContracts = contractsResponse?.data || [];

    // Fetch items for name resolution in subscription terms (used in generateSubscriptionTerm)
    const { data: itemsData, isLoading: itemsLoading } = useItems({ page: 1, limit: 1000 });
    const items = itemsData?.data || [];

    // Fetch predefined terms
    const { data: termsResponse, isLoading: termsLoading } = useContractTerms({ page: 1, limit: 100 });
    const predefinedTerms = Array.isArray(termsResponse) ? termsResponse : termsResponse?.data || [];
    const getTermId = (term: any) => String(term?._id ?? term?.id ?? "");
    const { data: termCategoriesResponse } = useCategories({ type: "term", page: 1 });
    const termCategories = termCategoriesResponse?.categories || [];

    const getCategoryId = (value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return String(value._id || value.id || "");
    };

    const [selectedTermCategory, setSelectedTermCategory] = useState<string>("all");

    const isSaving = createContractMutation.isPending || updateContractMutation.isPending;
    // Wait until quotations, items, contracts and predefined terms are all loaded before rendering the page
    const isLoading = quotationsLoading || itemsLoading || termsLoading || contractsLoading;

    const filteredPredefinedTerms = useMemo(() => {
        if (selectedTermCategory === "all") return predefinedTerms;
        return predefinedTerms.filter((term: any) => getCategoryId((term as any).category) === selectedTermCategory);
    }, [predefinedTerms, selectedTermCategory]);

    // Form state
    const [inputKey, setInputKey] = useState<string>("");
    const [inputKeyAr, setInputKeyAr] = useState<string>("");
    const [inputValue, setInputValue] = useState<string>("");
    const [inputValueAr, setInputValueAr] = useState<string>("");
    const [contractTermsList, setContractTermsList] = useState<
        Array<{ termId?: string; key: string; keyAr: string; value: string; valueAr: string; isCustom: boolean }>
    >(
        (editContract?.terms || []).map((termItem: any) => {
            // Normalize different shapes coming from the backend. The backend may return:
            // - custom terms with customKey/customValue
            // - non-custom terms as { term: "id" }
            // - non-custom terms as { term: { _id, key, keyAr, value, valueAr } }
            // - or sometimes the term object may be present at the top level
            if (termItem?.isCustom) {
                return {
                    key: termItem.customKey || termItem.key || "",
                    keyAr: termItem.customKeyAr || termItem.keyAr || "",
                    value: termItem.customValue || termItem.value || "",
                    valueAr: termItem.customValueAr || termItem.valueAr || "",
                    isCustom: true,
                };
            } else {
                const rawTerm = termItem?.term ?? termItem;
                const termId = typeof rawTerm === "string" ? rawTerm : rawTerm?._id ?? rawTerm?.id ?? termItem?.termId ?? "";
                const key = rawTerm?.key ?? termItem?.key ?? "";
                const keyAr = rawTerm?.keyAr ?? termItem?.keyAr ?? "";
                const value = rawTerm?.value ?? termItem?.value ?? "";
                const valueAr = rawTerm?.valueAr ?? termItem?.valueAr ?? "";

                return {
                    termId: termId,
                    key,
                    keyAr,
                    value,
                    valueAr,
                    isCustom: false,
                };
            }
        }),
    );
    const [editingTermIndex, setEditingTermIndex] = useState<number | null>(null);
    const [editingTermKey, setEditingTermKey] = useState<string>("");
    const [editingTermKeyAr, setEditingTermKeyAr] = useState<string>("");
    const [editingTermValue, setEditingTermValue] = useState<string>("");
    const [editingTermValueAr, setEditingTermValueAr] = useState<string>("");
    const [startDate, setStartDate] = useState<Dayjs | null>(editContract?.startDate ? dayjs(editContract.startDate) : null);
    const [endDate, setEndDate] = useState<Dayjs | null>(editContract?.endDate ? dayjs(editContract.endDate) : null);
    const [contractNote, setContractNote] = useState<string>(editContract?.note || "");
    const [status, setStatus] = useState<"draft" | "active" | "completed" | "cancelled" | "renewed">(editContract?.status || "draft");
    const [selectedQuotationId, setSelectedQuotationId] = useState<string>(
        quotationId ||
            (typeof (editContract as any)?.quotation === "string"
                ? (editContract as any).quotation
                : (editContract as any)?.quotation?._id ||
                  (typeof editContract?.quotationId === "string" ? editContract.quotationId : editContract?.quotationId?._id || "")),
    );
    const [selectedContractId, setSelectedContractId] = useState<string>("");
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Drag and drop handlers
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newTerms = [...contractTermsList];
        const draggedItem = newTerms[draggedIndex];
        newTerms.splice(draggedIndex, 1);
        newTerms.splice(index, 0, draggedItem);

        setContractTermsList(newTerms);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    // Load quotation data if quotationId is provided
    useEffect(() => {
        if (quotationId && !editContract) {
            loadQuotationData(quotationId);
        }
    }, [quotationId]);

    // Hydrate predefined terms in selected contract terms list when a contract stores only term IDs
    useEffect(() => {
        if (!predefinedTerms.length) return;

        setContractTermsList((prev) => {
            let changed = false;
            const next = prev.map((ct: any) => {
                if (ct.isCustom || !ct.termId) return ct;
                if (ct.key || ct.keyAr || ct.value || ct.valueAr) return ct;

                const found = predefinedTerms.find((p: any) => getTermId(p) === String(ct.termId));
                if (!found) return ct;

                changed = true;
                return {
                    ...ct,
                    key: found.key || "",
                    keyAr: found.keyAr || "",
                    value: found.value || "",
                    valueAr: found.valueAr || "",
                };
            });

            return changed ? next : prev;
        });
    }, [predefinedTerms]);

    const loadQuotationData = async (qId: string) => {
        try {
            const response = await getQuotationById(qId);
            const quotation = response.data;

            // Pre-fill dates: prefer explicit quotation start/end fields, fall back to validUntil
            const qStart = (quotation as any).startDate || (quotation as any).validFrom || null;
            const qEnd = (quotation as any).endDate || (quotation as any).validUntil || null;

            if (qStart) {
                setStartDate(dayjs(qStart));
            } else {
                // If no start provided, default to now
                setStartDate(dayjs());
            }

            if (qEnd) {
                setEndDate(dayjs(qEnd));
            }

            // Do not auto-generate subscription term here — user must click the button to add it
        } catch (error: any) {
            console.error("Failed to load quotation:", error);
        }
    };

    const generateSubscriptionTerm = (quotation: any): boolean => {
        if (!quotation.packages || quotation.packages.length === 0) return false;

        // Helper: conservative keyword classifiers for ads and posts
        const adKeywords = ["إعلان", "إعلانات", "ad", "ads", "إعلان توظيف", "توظيف"];
        const postKeywords = ["منشور", "بوست", "post", "posts", "منشورات"];

        // Normalize packages into usable structure and prefer real item names
        const packagesList: any[] = quotation.packages.map((pkg: any) => {
            const pkgObj = typeof pkg === "object" ? pkg : {};
            const pkgNameAr = pkgObj.nameAr || pkgObj.ar || pkgObj.name || "باقة";
            const pkgNameEn = pkgObj.nameEn || pkgObj.en || pkgObj.name || "Package";

            const pkgItems = (pkgObj.items || []).map((it: any) => {
                // Extract quantity and item ID from the structure: { item: "id", quantity: number }
                let quantity = 1;
                let itemId: string | null = null;

                if (typeof it === "string") {
                    // Item is just a string ID
                    itemId = it;
                } else if (it && typeof it === "object") {
                    // Item is an object with { item: "id", quantity: number }
                    itemId = it.item || it._id;
                    quantity = typeof it.quantity !== "undefined" ? it.quantity : 1;
                }

                // Try to resolve item from items list using the ID
                let resolvedItem: any = null;
                if (itemId && items.length > 0) {
                    resolvedItem = items.find((i: any) => String(i._id) === String(itemId));
                }

                // Get names from resolved item
                const itemNameAr = (resolvedItem as any)?.nameAr || resolvedItem?.ar || resolvedItem?.name || "عنصر";
                const itemNameEn = (resolvedItem as any)?.nameEn || (resolvedItem as any)?.en || resolvedItem?.name || "Item";

                // classify
                const lower = (itemNameAr + " " + itemNameEn).toLowerCase();
                const isAd = adKeywords.some((k) => lower.includes(k));
                const isPost = postKeywords.some((k) => lower.includes(k));

                return { nameAr: itemNameAr, nameEn: itemNameEn, quantity, isAd, isPost };
            });

            return { nameAr: pkgNameAr, nameEn: pkgNameEn, items: pkgItems };
        });

        // Build items lines using real item names
        const itemsListAr = packagesList
            .flatMap((pkg: any) => pkg.items.map((item: any) => `  - ${item.nameAr || item.nameEn} (${item.quantity})`))
            .join("\n");

        const itemsListEn = packagesList
            .flatMap((pkg: any) => pkg.items.map((item: any) => `  - ${item.nameEn || item.nameAr} (${item.quantity})`))
            .join("\n");

        // Totals
        const totalAds = packagesList
            .flatMap((p: any) => p.items)
            .filter((it: any) => it.isAd)
            .reduce((s: number, i: any) => s + i.quantity, 0);
        const totalPosts = packagesList
            .flatMap((p: any) => p.items)
            .filter((it: any) => it.isPost)
            .reduce((s: number, i: any) => s + i.quantity, 0);
        const totalAllItems = packagesList.flatMap((p: any) => p.items).reduce((s: number, i: any) => s + i.quantity, 0);

        const postsPerDay = Math.ceil((totalPosts || totalAllItems) / 30) || 0;
        const postsPerHour = Math.max(0, Math.ceil((totalPosts || totalAllItems) / (30 * 24)));

        const packageNamesAr = packagesList.map((p: any) => p.nameAr).join("، ");
        const packageNamesEn = packagesList.map((p: any) => p.nameEn).join(", ");

        // Use the exact text template requested and fill placeholders
        const adsTextAr = totalAds > 0 ? `${totalAds}` : `...`;
        const postsDailyText = postsPerDay > 0 ? `${postsPerDay}` : `...`;

        const valueAr = `التعاقد على الباقة (${packageNamesAr} ) التالية منصات التواصل الاجتماعي بقيمة: حيث مصري / شهرياً وتشمل التالي ( ويتم رفع نسخة من الباقة المتفق عليها بكافة تفاصيلها مع التعاقد )  \n\nالاشتراك في الباقة المتفق عليها: ${packageNamesAr}\n\nمحتوى الباقة:\n${itemsListAr}\n\nنشر وإعداد المحتوى الإعلاني والتسويقي لعدد (${adsTextAr}) إعلاناً شهرياً "من أي من التالي بناءاً على خطط كل شهر ( صور - مقاطع فيديو قصيرة - إعلانات توظيف - إعلانات عن فروع جديدة - تعديل للمشاركات )" بمعدل النشر (${postsPerHour}) كل ساعة.  تقدم خطة شهرية في بداية كل شهر، وتقرير تفصيلي بوضع جميع إنجازات ومهام الصفحة في نهاية الشهر.  تقديم استراتيجية سنوية ( للسوشيال ميديا ).  تغيير غلاف الصفحة مرة كل شهر.  نشر المحتوى على كل من المنصات التالية ( فيس بوك، إنستجرام، تيك توك ) مع عدد (${postsDailyText}) منشور يومياً على جميع المنصات`;

        const valueEn = `Subscription to the following social media channels:  \n\nAgreed Package: ${packageNamesEn}\n\nPackage Contents:\n${itemsListEn}\n\nPublishing and preparing promotional/marketing content for (${adsTextAr}) ads monthly "from any of the following based on the content of each month (images - short videos - recruitment ads - ads for new branches - post edits)" with a publishing rate of (${postsPerHour}) per hour.  The monthly plan is provided at the beginning of each month, and a detailed report of all achievements and page tasks is provided at the end of the month.  Provision of an annual strategy (for social media).  Change of the page cover once a month.  Publishing content on each of the following platforms (Facebook, Instagram, TikTok) with a number of (${postsDailyText}) posts daily across all platforms.`;

        const newTerm = {
            key: "Social Media Subscription",
            keyAr: "اشتراك وسائل التواصل الاجتماعي",
            value: valueEn,
            valueAr: valueAr,
            isCustom: true,
        };
        // Check against current list to avoid adding duplicates
        const exists = contractTermsList.some((t) => t.isCustom && (t.key === newTerm.key || t.keyAr === newTerm.keyAr));
        if (exists) {
            showToast(tr("term_already_added", "This term already exists"), "warning");
            return false;
        }

        setContractTermsList((prev) => [...prev, newTerm]);
        return true;
    };

    const loadContractTerms = async (contractId: string) => {
        try {
            const res = await getContractById(contractId);
            // getContractById may return the Contract directly or an object with a `data` field (e.g., Axios response),
            // so handle both shapes safely.
            const contract: any = res && (res as any).data ? (res as any).data : res;

            if (!contract.terms || contract.terms.length === 0) {
                showToast(tr("no_terms_in_contract", "This contract has no terms"), "warning");
                return;
            }

            // Map contract terms to the format we need (robust to several backend shapes)
            const loadedTerms = contract.terms.map((termItem: any) => {
                if (termItem?.isCustom) {
                    return {
                        key: termItem.customKey || termItem.key || "",
                        keyAr: termItem.customKeyAr || termItem.keyAr || "",
                        value: termItem.customValue || termItem.value || "",
                        valueAr: termItem.customValueAr || termItem.valueAr || "",
                        isCustom: true,
                    };
                } else {
                    const rawTerm = termItem?.term ?? termItem;
                    const termId = typeof rawTerm === "string" ? rawTerm : rawTerm?._id ?? rawTerm?.id ?? termItem?.termId ?? "";
                    const key = rawTerm?.key ?? termItem?.key ?? "";
                    const keyAr = rawTerm?.keyAr ?? termItem?.keyAr ?? "";
                    const value = rawTerm?.value ?? termItem?.value ?? "";
                    const valueAr = rawTerm?.valueAr ?? termItem?.valueAr ?? "";

                    return {
                        termId: termId,
                        key,
                        keyAr,
                        value,
                        valueAr,
                        isCustom: false,
                    };
                }
            });

            setContractTermsList(loadedTerms);
            showToast(tr("terms_loaded", "Terms loaded successfully"), "success");
        } catch (error: any) {
            console.error("Failed to load contract terms:", error);
            showAlert(t("failed_to_load_contract") || "Failed to load contract terms", "error");
        }
    };

    const addPredefinedTerm = (termId: string) => {
        const term = predefinedTerms.find((t: any) => getTermId(t) === String(termId));
        if (!term) return;

        // Prevent adding the same predefined term more than once
        const exists = contractTermsList.some((ct) => ct.termId === termId);
        if (exists) {
            showToast(tr("term_already_added", "This term already exists"), "warning");
            return;
        }

        const newTerm = {
            termId: getTermId(term),
            key: term.key,
            keyAr: term.keyAr,
            value: term.value || "",
            valueAr: term.valueAr || "",
            isCustom: false,
        };

        setContractTermsList((prev) => [...prev, newTerm]);
    };

    const addCustomTerm = () => {
        const key = inputKey.trim();
        const keyAr = inputKeyAr.trim();
        const value = inputValue.trim();
        const valueAr = inputValueAr.trim();

        if (!key || !keyAr) {
            showAlert(t("term_keys_required") || "Term keys in both languages are required", "warning");
            return;
        }

        const newTerm = {
            key,
            keyAr,
            value,
            valueAr,
            isCustom: true,
        };

        setContractTermsList([...contractTermsList, newTerm]);
        setInputKey("");
        setInputKeyAr("");
        setInputValue("");
        setInputValueAr("");
    };

    const handleCustomTermKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addCustomTerm();
        }
    };

    const startEditTerm = (index: number) => {
        const term = contractTermsList[index];
        setEditingTermIndex(index);
        setEditingTermKey(term.key);
        setEditingTermKeyAr(term.keyAr);
        setEditingTermValue(term.value);
        setEditingTermValueAr(term.valueAr);
    };

    const saveEditTerm = () => {
        if (editingTermIndex === null) return;

        if (!editingTermKey.trim() || !editingTermKeyAr.trim()) {
            showAlert(t("term_keys_required") || "Term keys in both languages are required", "warning");
            return;
        }

        const updatedTerms = [...contractTermsList];
        const existingTerm = updatedTerms[editingTermIndex];
        updatedTerms[editingTermIndex] = {
            ...existingTerm,
            key: editingTermKey.trim(),
            keyAr: editingTermKeyAr.trim(),
            value: editingTermValue.trim(),
            valueAr: editingTermValueAr.trim(),
        };

        setContractTermsList(updatedTerms);
        setEditingTermIndex(null);
        setEditingTermKey("");
        setEditingTermKeyAr("");
        setEditingTermValue("");
        setEditingTermValueAr("");
    };

    const cancelEditTerm = () => {
        setEditingTermIndex(null);
        setEditingTermKey("");
        setEditingTermKeyAr("");
        setEditingTermValue("");
        setEditingTermValueAr("");
    };

    const removeTerm = (index: number) => {
        setContractTermsList(contractTermsList.filter((_, i) => i !== index));
    };

    // Deprecated helper removed

    const handleSave = async () => {
        if (!clientId) {
            showAlert(t("client_required") || "Client is required", "warning");
            return;
        }

        if (!startDate || !endDate) {
            showAlert(t("dates_required") || "Start and end dates are required", "warning");
            return;
        }

        if (endDate.isBefore(startDate)) {
            showAlert(t("end_date_after_start") || "End date must be after start date", "warning");
            return;
        }

        const contractData = {
            clientId,
            quotation: selectedQuotationId || undefined,
            terms:
                contractTermsList.length > 0
                    ? contractTermsList.map((term, index) => {
                          if (term.isCustom) {
                              return {
                                  customKey: term.key,
                                  customKeyAr: term.keyAr,
                                  customValue: term.value,
                                  customValueAr: term.valueAr,
                                  order: index,
                                  isCustom: true,
                              };
                          } else {
                              return {
                                  term: term.termId,
                                  order: index,
                                  isCustom: false,
                              };
                          }
                      })
                    : [],
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status,
            note: contractNote.trim() || undefined,
        };

        try {
            if (editContract) {
                await updateContractMutation.mutateAsync({
                    id: editContract._id,
                    data: contractData,
                });
                showToast(t("contract_updated") || "Contract updated successfully", "success");
            } else {
                const result = await createContractMutation.mutateAsync(contractData);
                showToast(t("contract_created") || "Contract created successfully", "success");
                if (onSuccess) {
                    onSuccess(result._id);
                }
            }
            onBack();
        } catch (error: any) {
            const errorMsg = error?.response?.data?.message || error?.message || t("failed_to_save_contract") || "Failed to save contract";
            showAlert(errorMsg, "error");
        }
    };

    // Show loading state while data is being fetched
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <Loader2 className="text-light-500 mx-auto mb-4 h-12 w-12 animate-spin" />
                    <p className="text-light-600 dark:text-dark-400">{t("loading_contract_data") || "Loading contract data..."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <style>{`.custom-date-input{color:var(--color-light-900) !important;} .dark .custom-date-input{color:var(--color-white) !important;} .custom-date-input::placeholder{color:var(--color-light-400) !important;} .dark .custom-date-input::placeholder{color:var(--color-dark-50) !important;}`}</style>
            {/* Header */}
            <div className="relative overflow-hidden rounded-[1.75rem] border border-light-200 bg-white p-5 shadow-sm dark:border-dark-800 dark:bg-dark-900 sm:p-6">
                <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-light-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-14 -left-14 h-40 w-40 rounded-full bg-secdark-700/10 blur-3xl" />

                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="btn-secondary"
                        >
                            <LocalizedArrow className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="text-light-500 dark:text-dark-400 text-[11px] font-black uppercase tracking-wider">
                                {editContract ? tr("update_contract", "Update Contract") : tr("create_contract", "Create Contract")}
                            </p>
                            <h1 className="text-light-900 dark:text-dark-50 text-2xl font-black tracking-tight">
                                {editContract ? tr("edit_contract", "Edit Contract") : tr("create_contract", "Create Contract")}
                            </h1>
                            <p className="text-light-600 dark:text-dark-400 mt-1 text-sm">
                                {tr("for_client", "For")}: {clientName}
                            </p>
                        </div>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-light-200 bg-light-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                        <Sparkles size={13} />
                        Contract Builder
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="card rounded-[1.75rem] border-light-200/80 bg-white/90 shadow-sm dark:border-dark-800 dark:bg-dark-900/90">
                <div className="space-y-6">
                    {/* Quotation Selector */}
                    {/* Contract Template Selector */}
                    {allContracts.length > 0 && !editContract && (
                        <div className="rounded-2xl border border-light-200 bg-white/70 p-4 dark:border-dark-700 dark:bg-dark-800/50">
                            <label className="text-light-700 dark:text-dark-300 mb-2 block text-sm font-medium">
                                {t("load_terms_from_contract") || "Load Terms from Existing Contract"} ({t("optional") || "optional"})
                            </label>
                            <select
                                value={selectedContractId}
                                onChange={(e) => setSelectedContractId(e.target.value)}
                                className="input w-full"
                            >
                                <option value="">{t("select_contract") || "-- Select a contract --"}</option>
                                {allContracts.map((c: any) => {
                                    const contractNumber = c.contractNumber || c._id?.slice(-6) || "N/A";
                                    const clientDisplayName =
                                        typeof c.clientId === "string"
                                            ? c.clientName || c.customClientName
                                            : c.clientId?.business?.businessName || c.clientId?.personal?.fullName || c.clientName || "Unknown";
                                    return (
                                        <option
                                            key={c._id}
                                            value={c._id}
                                        >
                                            {contractNumber} - {clientDisplayName}
                                        </option>
                                    );
                                })}
                            </select>
                            {selectedContractId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        loadContractTerms(selectedContractId);
                                        setSelectedContractId("");
                                    }}
                                    className="btn-ghost mt-2 flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    {t("load_terms") || "Load Terms from Contract"}
                                </button>
                            )}
                        </div>
                    )}

                    {!editContract && (
                        <div className="rounded-2xl border border-light-200 bg-white/70 p-4 dark:border-dark-700 dark:bg-dark-800/50">
                            <label className="text-light-700 dark:text-dark-300 mb-2 block text-sm font-medium">
                                {t("select_quotation") || "Select Quotation (Optional)"}
                            </label>
                            <select
                                value={selectedQuotationId}
                                onChange={(e) => {
                                    const qId = e.target.value;
                                    setSelectedQuotationId(qId);
                                    if (qId) {
                                        loadQuotationData(qId);
                                    } else {
                                        // Clear any pre-filled dates when no quotation is selected
                                        setStartDate(null);
                                        setEndDate(null);
                                    }
                                }}
                                disabled={quotationsLoading || clientQuotations.length === 0}
                                className="input w-full"
                            >
                                <option value="">{t("none") || "None - Create New"}</option>
                                {!quotationsLoading && clientQuotations.length === 0 && (
                                    <option value="" disabled>
                                        {t("no_quotations_yet") || "No quotations yet"}
                                    </option>
                                )}
                                {clientQuotations.map((q: any) => (
                                    <option
                                        key={q._id}
                                        value={q._id}
                                    >
                                        {q.quotationNumber || `Quotation ${q._id.slice(-6)}`} - {(q.total || 0).toFixed(2)}{" "}
                                        {lang === "ar" ? "ج.م" : "EGP"}
                                    </option>
                                ))}
                            </select>
                                {selectedQuotationId && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const response = await getQuotationById(selectedQuotationId);
                                            const added = generateSubscriptionTerm(response.data);
                                            if (added) {
                                                showToast(tr("term_generated", "Subscription term generated successfully"), "success");
                                            }
                                        } catch (error) {
                                            console.error("Failed to generate term:", error);
                                            showAlert(t("failed_to_generate_term") || "Failed to generate subscription term", "error");
                                        }
                                    }}
                                    className="btn-ghost mt-2 flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    {t("generate_subscription_term") || "Generate Subscription Term from Package"}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Dates Section */}
                    <div className="rounded-2xl border border-light-200 bg-white/70 p-4 dark:border-dark-700 dark:bg-dark-800/50">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <label className="text-light-700 dark:text-dark-300 mb-2 block text-sm font-medium">
                                {t("start_date") || "Start Date"} *
                            </label>
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DatePicker
                                    value={startDate}
                                    onChange={(newValue) => setStartDate(newValue)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            className: "input h-10",
                                            inputProps: {
                                                placeholder: "MM/DD/YYYY",
                                                className:
                                                    "text-sm text-light-900 dark:text-white placeholder-light-500 dark:placeholder-dark-50 custom-date-input",
                                            },
                                        },
                                    }}
                                />
                            </LocalizationProvider>
                        </div>

                        <div>
                            <label className="text-light-700 dark:text-dark-300 mb-2 block text-sm font-medium">
                                {t("end_date") || "End Date"} *
                            </label>
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DatePicker
                                    value={endDate}
                                    onChange={(newValue) => setEndDate(newValue)}
                                    minDate={startDate || undefined}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            className: "input h-10",
                                            inputProps: {
                                                placeholder: "MM/DD/YYYY",
                                                className:
                                                    "text-sm text-light-900 dark:text-white placeholder-light-500 dark:placeholder-dark-50 custom-date-input",
                                            },
                                        },
                                    }}
                                />
                            </LocalizationProvider>
                        </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="rounded-2xl border border-light-200 bg-white/70 p-4 dark:border-dark-700 dark:bg-dark-800/50">
                        <label className="text-light-700 dark:text-dark-300 mb-2 block text-sm font-medium">{t("status") || "Status"}</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            className="input w-full"
                        >
                            <option value="draft">{t("draft") || "Draft"}</option>
                            <option value="active">{t("active") || "Active"}</option>
                            <option value="completed">{t("completed") || "Completed"}</option>
                            <option value="cancelled">{t("cancelled") || "Cancelled"}</option>
                            <option value="renewed">{t("renewed") || "Renewed"}</option>
                        </select>
                    </div>

                    {/* Contract Terms Management */}
                    <div className="rounded-2xl border border-light-200 bg-white/70 p-4 dark:border-dark-700 dark:bg-dark-800/50">
                        <label className="text-light-700 dark:text-dark-300 mb-2 block text-sm font-medium">
                            {t("contract_terms") || "Contract Terms"}
                        </label>

                        <div className="rounded-2xl border border-light-200 bg-white/80 p-4 dark:border-dark-700 dark:bg-dark-900/60">
                            {/* Display existing terms */}
                            {contractTermsList.length > 0 && (
                                <div className="mb-4 grid gap-3">
                                    {contractTermsList.map((term, index) => (
                                        <div
                                            key={index}
                                            draggable={editingTermIndex !== index}
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                            className={`border-light-600 text-light-900 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-50 flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 transition-all ${
                                                draggedIndex === index ? "scale-95 opacity-50" : "cursor-move hover:shadow-md"
                                            } ${editingTermIndex === index ? "cursor-default" : ""}`}
                                        >
                                            {editingTermIndex === index ? (
                                                <div className="w-full">
                                                    <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                                        <input
                                                            value={editingTermKey}
                                                            onChange={(e) => setEditingTermKey(e.target.value)}
                                                            className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 focus:border-light-500 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none"
                                                            placeholder={t("term_key") || "Term Key"}
                                                        />
                                                        <input
                                                            value={editingTermKeyAr}
                                                            onChange={(e) => setEditingTermKeyAr(e.target.value)}
                                                            className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 focus:border-light-500 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none"
                                                            placeholder={t("term_key_ar") || "المفتاح (بالعربية)"}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                        <textarea
                                                            value={editingTermValue}
                                                            onChange={(e) => setEditingTermValue(e.target.value)}
                                                            rows={4}
                                                            className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 resize-vertical w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none"
                                                            placeholder={t("term_value") || "Value"}
                                                        />
                                                        <textarea
                                                            value={editingTermValueAr}
                                                            onChange={(e) => setEditingTermValueAr(e.target.value)}
                                                            rows={4}
                                                            className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 resize-vertical w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none"
                                                            placeholder={t("term_value_ar") || "القيمة (بالعربية)"}
                                                        />
                                                    </div>
                                                    <div className="mt-2 flex justify-end gap-2">
                                                        <button
                                                            onClick={saveEditTerm}
                                                            className="btn-ghost flex items-center gap-2"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            onClick={cancelEditTerm}
                                                            className="btn-ghost flex items-center gap-2"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="text-light-400 dark:text-dark-600 flex shrink-0 items-center justify-center"
                                                        style={{ cursor: "grab" }}
                                                    >
                                                        <GripVertical size={18} />
                                                    </div>
                                                    <div className="flex flex-1 flex-col">
                                                        <span className="text-light-900 dark:text-dark-50 text-sm font-semibold">
                                                            {lang === "ar" ? term.keyAr : term.key}
                                                        </span>
                                                        {(term.value || term.valueAr) && (
                                                            <span className="text-light-600 dark:text-dark-400 mt-1 text-xs">
                                                                {lang === "ar" ? term.valueAr : term.value}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            onClick={() => startEditTerm(index)}
                                                            className="btn-ghost flex items-center gap-2"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => removeTerm(index)}
                                                            className="btn-ghost text-danger-500 flex items-center gap-2"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Predefined Terms Selection */}
                            {predefinedTerms.length > 0 && (
                                <div className="mb-4">
                                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-light-700 dark:text-dark-300 text-sm font-medium">
                                            {t("select_predefined_terms") || "Select Predefined Terms"}
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTermCategory("all")}
                                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                                    selectedTermCategory === "all"
                                                        ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                                        : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:bg-dark-700"
                                                }`}
                                            >
                                                {t("all_terms")}
                                                <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                                                    selectedTermCategory === "all"
                                                        ? "bg-white/20 text-white"
                                                        : "bg-light-200 text-light-600 dark:bg-dark-700 dark:text-dark-400"
                                                }`}>
                                                    {predefinedTerms.length}
                                                </span>
                                            </button>

                                            {termCategories.map((category) => {
                                                const count = predefinedTerms.filter(
                                                    (term: any) => getCategoryId((term as any).category) === category._id,
                                                ).length;
                                                if (count === 0) return null;

                                                return (
                                                    <button
                                                        key={category._id}
                                                        type="button"
                                                        onClick={() => setSelectedTermCategory(category._id)}
                                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                                            selectedTermCategory === category._id
                                                                ? "border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30"
                                                                : "border-light-300 bg-white text-light-700 hover:border-light-400 hover:bg-light-50 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 dark:hover:bg-dark-700"
                                                        }`}
                                                    >
                                                        {getCategoryDisplayName(category, lang)}
                                                        <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs ${
                                                            selectedTermCategory === category._id
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

                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {filteredPredefinedTerms.map((term) => {
                                            const id = getTermId(term);
                                            const isSelected = contractTermsList.some((ct) => String(ct.termId || "") === id);
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => addPredefinedTerm(id)}
                                                    className={`flex flex-col items-start rounded-lg p-3 text-left text-sm transition-colors ${
                                                        isSelected
                                                            ? "btn-primary"
                                                            : "border-light-300 dark:border-dark-600 bg-light-50 hover:bg-light-100 dark:bg-dark-800 dark:hover:bg-dark-700 text-light-900 dark:text-dark-50 border"
                                                    }`}
                                                >
                                                    <span className="font-medium">{lang === "ar" ? term.keyAr : term.key}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Add Custom Term */}
                            <div className="border-light-300 dark:border-dark-600 dark:bg-dark-900 rounded-lg border bg-white p-3">
                                <h4 className="text-light-700 dark:text-dark-300 mb-2 text-sm font-medium">
                                    {t("or_add_custom_term") || "Or Add Custom Term"}
                                </h4>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                    <input
                                        value={inputKey}
                                        onChange={(e) => setInputKey(e.target.value)}
                                        onKeyDown={handleCustomTermKeyDown}
                                        placeholder={t("term_key") || "Term Key (e.g., Payment)"}
                                        className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 focus:border-light-500 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none"
                                    />
                                    <input
                                        value={inputKeyAr}
                                        onChange={(e) => setInputKeyAr(e.target.value)}
                                        onKeyDown={handleCustomTermKeyDown}
                                        placeholder={t("term_key_ar") || "المفتاح (مثال: الدفع)"}
                                        className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 focus:border-light-500 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus:outline-none"
                                    />
                                    <input
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleCustomTermKeyDown}
                                        placeholder={t("term_value") || "Value (e.g., 50% advance)"}
                                        className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 focus:border-light-500 w-full rounded-lg border bg-white px-2 py-2 text-sm transition-colors focus:outline-none"
                                    />
                                    <input
                                        value={inputValueAr}
                                        onChange={(e) => setInputValueAr(e.target.value)}
                                        onKeyDown={handleCustomTermKeyDown}
                                        placeholder={t("term_value_ar") || "القيمة (مثال: 50% مقدم)"}
                                        className="text-light-900 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-50 focus:border-light-500 w-full rounded-lg border bg-white px-2 py-2 text-sm transition-colors focus:outline-none"
                                    />
                                    <button
                                        onClick={addCustomTerm}
                                        className="btn-primary flex w-full items-center justify-center gap-2 xl:w-auto"
                                    >
                                        <Plus size={14} />
                                        {t("add")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="rounded-2xl border border-light-200 bg-white/70 p-4 dark:border-dark-700 dark:bg-dark-800/50">
                        <label className="text-light-700 dark:text-dark-300 mb-2 block text-sm font-medium">{t("notes") || "Notes"}</label>
                        <textarea
                            value={contractNote}
                            onChange={(e) => setContractNote(e.target.value)}
                            rows={3}
                            className="input w-full resize-none"
                            placeholder={t("add_notes") || "Add any additional notes..."}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="btn-primary flex-1"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="text-light-500 h-5 w-5 animate-spin" />
                                    {t("saving") || "Saving..."}
                                </>
                            ) : (
                                <>
                                    <FileCheck className="h-5 w-5" />
                                    {editContract ? t("update_contract") || "Update Contract" : t("create_contract") || "Create Contract"}
                                </>
                            )}
                        </button>
                        <button
                            onClick={onBack}
                            disabled={isSaving}
                            className="btn-ghost"
                        >
                            {t("cancel") || "Cancel"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateContract;
