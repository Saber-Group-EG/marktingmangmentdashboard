import React, { useState, useEffect } from "react";
import { Loader2, Trash2, Edit2, Download, ChevronLeft, ChevronRight, Eye, Plus } from "lucide-react";
import LocalizedArrow from "@/components/LocalizedArrow";
import { useLang } from "@/hooks/useLang";
import { showAlert, showConfirm } from "@/utils/swal";
import { useClients, useQuotations, useDeleteQuotation, useItems } from "@/hooks/queries";
import type { Quotation, QuotationQueryParams } from "@/api/requests/quotationsService";
import { generateQuotationPDF } from "@/utils/quotationPdfGenerator";

interface PreviewQuotationProps {
    clientId?: string;
    clientName: string;
    onBack: () => void;
    onCreateNew: () => void;
    onEdit: (quotation: Quotation) => void;
    autoPreviewQuotationId?: string;
    autoDownloadQuotationId?: string;
}

const PreviewQuotation = ({
    clientId,
    clientName,
    onBack,
    onCreateNew,
    onEdit,
    autoPreviewQuotationId,
    autoDownloadQuotationId,
}: PreviewQuotationProps) => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize] = useState<number>(20);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [autoPreviewDone, setAutoPreviewDone] = useState<boolean>(false);
    const [autoDownloadDone, setAutoDownloadDone] = useState<boolean>(false);

    const { data: clients = [], isLoading: clientsLoading } = useClients();


    const { data: itemsResponse, isLoading: itemsLoading } = useItems({ limit: 1000 });
    const items = itemsResponse?.data || [];

    // Small helper to return a localized name for different possible shapes

   
    // For custom quotations (no real clientId) we may get a stub id like `custom-...`.
    // Avoid sending such stub ids to the API — the backend doesn't accept them and returns 500.
    const isCustomStubId = typeof clientId === "string" && clientId.startsWith("custom-");

    // Determine whether we actually need to fetch quotations:
    // - fetch when we have a real clientId (not a custom stub and not 'global')
    // - or when we have a clientName to filter by
    const shouldFetchQuotations = Boolean((clientId && !isCustomStubId && clientId !== "global") || clientName);

    // Build query params and keep a reasonable page size (avoid limit=1000)
    const quotationsParams: QuotationQueryParams = {
        page: currentPage,
        limit: pageSize,
        status: statusFilter || undefined,
        ...(clientId && !isCustomStubId && clientId !== "global" ? { clientId } : {}),
    };

    const {
        data: quotationsResponse,
        isLoading: quotationsLoading,
        refetch: refetchQuotations,
    } = useQuotations(quotationsParams, { enabled: shouldFetchQuotations });
    const quotations = quotationsResponse?.data || [];
    const totalQuotations = quotationsResponse?.meta?.total || 0;

    // Ensure we refetch when the clientId or clientName changes
    React.useEffect(() => {
        if (!shouldFetchQuotations) return;
        try {
            refetchQuotations();
        } catch (e) {
            // swallow errors here
        }
    }, [clientId, clientName, shouldFetchQuotations, refetchQuotations]);

    // Helper function to resolve client name from various quotation structures
    const resolveClientName = (quotation: any) => {
        try {
            if (quotation.client && typeof quotation.client === "object") {
                return quotation.client.business?.businessName || quotation.client.personal?.fullName || "";
            }

            if (quotation.clientId && typeof quotation.clientId === "object") {
                const cid = quotation.clientId._id || quotation.clientId.id || quotation.clientId;
                const client = clients.find((c) => String(c.id) === String(cid) || String(c._id) === String(cid));
                if (client) return client.business?.businessName || client.personal?.fullName || "";
            }

            if (quotation.clientId && typeof quotation.clientId === "string") {
                const client = clients.find((c) => String(c.id) === String(quotation.clientId) || String(c._id) === String(quotation.clientId));
                if (client) return client.business?.businessName || client.personal?.fullName || "";
            }

            if (quotation.clientName) return quotation.clientName;
            if (quotation.customName) return quotation.customName;

            return "";
        } catch (e) {
            return "";
        }
    };

    // Filter quotations for the selected client
    const displayedQuotations =
        clientId && !isCustomStubId && clientId !== "global"
            ? quotations.filter((q: any) => {
                  if (!q) return false;
                  let qClientId: any = null;
                  if (typeof q.clientId === "string") qClientId = q.clientId;
                  else if (q.clientId && typeof q.clientId === "object") qClientId = q.clientId._id || q.clientId.id || q.clientId;
                  else if (typeof q.client === "string") qClientId = q.client;
                  else if (q.client && typeof q.client === "object") qClientId = q.client._id || q.client.id || q.client;

                  return String(qClientId) === String(clientId);
              })
            : clientName
              ? quotations.filter((q: any) => {
                    if (!q) return false;
                    try {
                        const resolved = (resolveClientName(q) || "").toString().trim().toLowerCase();
                        const target = clientName.toString().trim().toLowerCase();
                        return resolved === target;
                    } catch (e) {
                        return false;
                    }
                })
              : quotations;

    const deleteQuotationMutation = useDeleteQuotation();

    const handleDeleteQuotation = async (id: string) => {
        const confirmed = await showConfirm(
            t("confirm_delete_quotation") || "Are you sure you want to delete this quotation?",
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) return;

        try {
            await deleteQuotationMutation.mutateAsync(id);
            showAlert(t("quotation_deleted") || "Quotation deleted successfully", "success");
        } catch (error) {
            showAlert(t("failed_to_delete_quotation") || "Failed to delete quotation", "error");
        }
    };

    // Updated handlePreviewPDF - opens PDF in new tab
    const handlePreviewPDF = async (quotation: Quotation) => {
        // Wait for necessary data to be available
        const waitForLoaded = async (timeout = 10000) => {
            const start = Date.now();
            while (true) {
                if (!clientsLoading && !itemsLoading && !quotationsLoading) return true;
                if (Date.now() - start > timeout) return false;
                await new Promise((r) => setTimeout(r, 100));
            }
        };

        const loaded = await waitForLoaded(10000);
        if (!loaded) {
            showAlert(t("data_still_loading") || "Data is still loading. Please try again in a moment.", "warning");
            return;
        }

        try {
            const client = clients.find((c) => c.id === quotation.clientId);
            const clientNameForPdf = client?.business?.businessName || "";

            const pdfBlob = await generateQuotationPDF({
                quotation,
                clientName: clientNameForPdf,
                lang: lang as "ar" | "en",
                t: tr,
                items,
            });

            const blobUrl = URL.createObjectURL(pdfBlob);
            const previewWindow = window.open(blobUrl, '_blank');
            
            if (!previewWindow) {
                showAlert(t("popup_blocked") || "Pop-up blocked. Please allow pop-ups for this site.", "error");
            }
            
            // Clean up blob URL after a delay
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        } catch (error: any) {
            console.error("PDF Generation Error:", error);
            showAlert(`${t("failed_to_generate_preview") || "Failed to generate preview"}: ${error?.message || "Please try again."}`, "error");
        }
    };

    // Updated handleDownloadPDF - downloads the PDF file
    const handleDownloadPDF = async (id: string) => {
        setIsDownloading(id);
        try {
            const quotation = quotations.find((q) => q._id === id);
            if (!quotation) {
                showAlert(t("quotation_not_found") || "Quotation not found", "warning");
                return;
            }

            const client = clients.find((c) => c.id === quotation.clientId);
            const clientNameForPdf = client?.business?.businessName || "";

            const pdfBlob = await generateQuotationPDF({
                quotation,
                clientName: clientNameForPdf,
                lang: lang as "ar" | "en",
                t: tr,
                items,
            });

            const blobUrl = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `quotation-${quotation.quotationNumber || Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up blob URL
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            showAlert(t("failed_to_generate_pdf") || "Failed to generate PDF. Please try again.", "error");
        } finally {
            setIsDownloading(null);
        }
    };

    // Auto preview / download when requested by parent
    useEffect(() => {
        if (!autoPreviewQuotationId && !autoDownloadQuotationId) return;
        if (clientsLoading || itemsLoading || quotationsLoading) return;

        if (autoPreviewQuotationId && !autoPreviewDone) {
            const q = quotations.find(
                (x: any) => String(x._id) === String(autoPreviewQuotationId) || String(x.id) === String(autoPreviewQuotationId),
            );
            if (q) {
                (async () => {
                    try {
                        await handlePreviewPDF(q as Quotation);
                    } catch (e) {
                        // ignore
                    }
                    setAutoPreviewDone(true);
                })();
            } else {
                setAutoPreviewDone(true);
            }
        }

        if (autoDownloadQuotationId && !autoDownloadDone) {
            (async () => {
                try {
                    await handleDownloadPDF(autoDownloadQuotationId);
                } catch (e) {
                    // ignore
                }
                setAutoDownloadDone(true);
            })();
        }
    }, [
        autoPreviewQuotationId,
        autoDownloadQuotationId,
        clientsLoading,
        itemsLoading,
        quotationsLoading,
        quotations,
        autoPreviewDone,
        autoDownloadDone,
    ]);

    // Reset done flags when requested ids change
    useEffect(() => {
        setAutoPreviewDone(false);
    }, [autoPreviewQuotationId]);

    useEffect(() => {
        setAutoDownloadDone(false);
    }, [autoDownloadQuotationId]);

    const totalPages = Math.ceil(totalQuotations / pageSize);

    // If core data is still loading, show a spinner
    if (clientsLoading || itemsLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="text-light-500 animate-spin" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <button onClick={onBack} className="btn-ghost rounded-xl">
                            <LocalizedArrow size={20} />
                        </button>
                        <div>
                            <span className="inline-flex items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                                Quotation Preview
                            </span>
                            <h2 className="text-light-900 dark:text-dark-50 mt-3 text-xl font-bold sm:text-2xl">{clientName}</h2>
                            <p className="text-light-600 dark:text-dark-300 mt-1 text-sm">{tr("quotations", "Quotations")}</p>
                        </div>
                    </div>
                    <button onClick={onCreateNew} className="btn-primary rounded-xl">
                        <Plus size={16} className="mr-2" />
                        {tr("create_new", "Create New")}
                    </button>
                </div>
            </section>

            {/* Empty State */}
            {!quotationsLoading && displayedQuotations.length === 0 && (
                <div className="rounded-3xl border border-light-200/80 bg-white/90 p-6 shadow-sm dark:border-dark-700/80 dark:bg-dark-900/70">
                    <div className="flex flex-col items-center justify-center py-12">
                        <p className="text-light-600 dark:text-dark-400 mb-4 max-w-lg text-center text-lg">
                            {tr("no_quotations_for_client", "There are no quotations for this client")}
                        </p>
                        <div className="mt-4">
                            <button onClick={onCreateNew} className="btn-primary rounded-xl px-6">
                                {tr("create_quotation", "Create Quotation")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quotations List */}
            {displayedQuotations.length > 0 && (
                <div className="rounded-3xl border border-light-200/80 bg-white/90 p-5 shadow-sm dark:border-dark-700/80 dark:bg-dark-900/70 sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-light-900 dark:text-dark-50 text-lg font-semibold">{tr("existing_quotations", "Existing Quotations")}</h3>
                    </div>

                    {/* Filters */}
                    <div className="mb-4 flex items-center gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="input rounded-xl"
                        >
                            <option value="">{tr("all_statuses", "All Statuses")}</option>
                            <option value="draft">{tr("draft", "Draft")}</option>
                            <option value="sent">{tr("sent", "Sent")}</option>
                            <option value="approved">{tr("approved", "Approved")}</option>
                            <option value="rejected">{tr("rejected", "Rejected")}</option>
                            <option value="expired">{tr("expired", "Expired")}</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        {displayedQuotations.map((quotation) => (
                            <div
                                key={quotation._id}
                                className="rounded-2xl border border-light-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-dark-700/80 dark:bg-dark-800/70"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="mb-2 flex items-center gap-3">
                                            <h4 className="text-light-900 dark:text-dark-50 font-semibold">
                                                {resolveClientName(quotation) || quotation.quotationNumber}
                                            </h4>
                                            <span
                                                className={`rounded px-2 py-1 text-xs ${
                                                    quotation.status === "approved"
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                        : quotation.status === "rejected"
                                                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                          : quotation.status === "sent"
                                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                                                }`}
                                            >
                                                {t(quotation.status) || quotation.status}
                                            </span>
                                        </div>
                                        <p className="text-light-600 dark:text-dark-400 mb-1 text-sm">
                                            {new Date(quotation.createdAt).toLocaleString()}
                                        </p>
                                        {quotation.note && <p className="text-light-600 dark:text-dark-400 mb-2 text-sm italic">{quotation.note}</p>}
                                        
                                        {/* Rest of the component remains the same */}
                                        <p className="text-light-900 dark:text-dark-50 font-bold">
                                            {quotation.total} {lang === "ar" ? "ج.م" : "EGP"}
                                            {quotation.isTotalOverridden && (
                                                <span className="text-light-600 dark:text-dark-400 ml-2 text-xs">
                                                    ({t("overridden") || "overridden"})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onEdit(quotation)}
                                            className="btn-ghost rounded-xl"
                                            title={tr("edit", "Edit")}
                                            disabled={quotation.status === "approved"}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handlePreviewPDF(quotation)}
                                            className="btn-ghost text-blue-600 rounded-xl"
                                            title={tr("preview_pdf", "Preview PDF")}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadPDF(quotation._id)}
                                            className="btn-ghost rounded-xl"
                                            title={tr("download_pdf", "Download PDF")}
                                            disabled={isDownloading === quotation._id}
                                        >
                                            {isDownloading === quotation._id ? (
                                                <Loader2 size={16} className="text-light-500 animate-spin" />
                                            ) : (
                                                <Download size={16} />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuotation(quotation._id)}
                                            className="btn-ghost text-danger-500 rounded-xl"
                                            title={tr("delete", "Delete")}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="border-light-200 dark:border-dark-700 mt-6 flex items-center justify-between border-t pt-4">
                            <div className="text-light-600 dark:text-dark-400 text-sm">
                                {tr("showing", "Showing")} {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalQuotations)}{" "}
                                {tr("of", "of")} {totalQuotations}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="btn-ghost rounded-xl"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-light-900 dark:text-dark-50">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="btn-ghost rounded-xl"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Loading State */}
            {quotationsLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="text-light-500 animate-spin" size={32} />
                </div>
            )}
        </div>
    );
};

export default PreviewQuotation;