import { useState } from "react";
import { Loader2, Eye, Edit2, Trash2, Download } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useClients, useQuotations, useItems, useDeleteQuotation } from "@/hooks/queries";
import { showConfirm, showAlert } from "@/utils/swal";
import type { Client } from "@/api/interfaces/clientinterface";
import type { Quotation } from "@/api/requests/quotationsService";
import CreateQuotation from "./CreateQuotation";
import CustomQuotation from "./CustomQuotation";
import PreviewQuotation from "./PreviewQuotation";
import { generateQuotationPDF, downloadQuotationPDF } from "@/utils/quotationPdfGenerator";

type View = "list" | "create" | "preview" | "custom";

const QuotationsPage = () => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const [currentView, setCurrentView] = useState<View>("list");
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
    const [customCreateName] = useState<string | null>(null);
    const [autoPreviewQuotationId, setAutoPreviewQuotationId] = useState<string | null>(null);
    const [autoDownloadQuotationId, setAutoDownloadQuotationId] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    const { data: clients = [], isLoading: clientsLoading } = useClients();
    const { data: allQuotationsResponse } = useQuotations({ page: 1, limit: 1000 });

    const allQuotations: any[] = Array.isArray(allQuotationsResponse)
        ? allQuotationsResponse
        : allQuotationsResponse?.data && Array.isArray(allQuotationsResponse.data)
          ? allQuotationsResponse.data
          : [];

    const handleCreateQuotation = (client: Client) => {
        setSelectedClient(client);
        setEditingQuotation(null);
        setAutoPreviewQuotationId(null);
        setAutoDownloadQuotationId(null);
        setCurrentView("create");
    };

    const handleShowQuotations = (client: Client) => {
        setSelectedClient(client);
        setAutoPreviewQuotationId(null);
        setAutoDownloadQuotationId(null);
        setCurrentView("preview");
    };

    const handleCreateCustomQuotation = () => {
        setSelectedClient({ business: { businessName: t("custom_quotation") || "Custom Quotation" } } as Client);
        setEditingQuotation(null);
        setAutoPreviewQuotationId(null);
        setAutoDownloadQuotationId(null);
        setCurrentView("create");
    };

    const handleBack = () => {
        setCurrentView("list");
        setSelectedClient(null);
        setEditingQuotation(null);
        setAutoPreviewQuotationId(null);
        setAutoDownloadQuotationId(null);
    };

    const handleEditQuotation = (quotation: Quotation) => {
        setEditingQuotation(quotation);
        setAutoPreviewQuotationId(null);
        setAutoDownloadQuotationId(null);
        setCurrentView("create");
    };

    // Group custom quotations (those without clientId) by their clientName/customName
    const customQuotationsByName: { name: string; quotations: any[] }[] = (() => {
        const map = new Map<string, { name: string; quotations: any[] }>();
        allQuotations.forEach((q: any) => {
            if (!q) return;
            const hasClientId = q.clientId || q.client;
            if (hasClientId) return; // skip quotations attached to real clients

            const rawName = (q.clientName || q.customName || q.customClientName || "") as string;
            const displayName = rawName.trim() || t("unnamed_custom_quotation") || "Unnamed";
            const key = displayName.trim().toLowerCase();

            if (!map.has(key)) map.set(key, { name: displayName, quotations: [] });
            map.get(key)!.quotations.push(q);
        });

        return Array.from(map.values());
    })();

    // Build a map of quotation counts per client id (for quotations that reference a client)
    const quotationsCountByClientId: Record<string, number> = (() => {
        const counts: Record<string, number> = {};
        allQuotations.forEach((q: any) => {
            if (!q) return;
            // Determine client id from different shapes
            const cid = q.clientId || (q.client && (q.client._id || q.client.id));
            if (!cid) return;
            const key = String(cid);
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    })();

    // Combine clients and custom groups into a single list and sort by name so they show together
    type CombinedItem =
        | { type: "client"; id: string; name: string; client: Client; quotationCount: number }
        | { type: "custom"; id: string; name: string; quotations: any[] };

    const combinedItems: CombinedItem[] = [];

    // add clients
    clients.forEach((client) => {
        const id = (client as any).id || (client as any)._id || "";
        const name = client.business?.businessName || client.personal?.fullName || t("unnamed_client") || "Unnamed";
        const count = quotationsCountByClientId[String(id)] || 0;
        combinedItems.push({ type: "client", id: String(id), name, client, quotationCount: count });
    });

    // add custom groups
    customQuotationsByName.forEach((g) => {
        combinedItems.push({ type: "custom", id: `custom-${g.name}`, name: g.name, quotations: g.quotations });
    });

    // Sort alphabetically by name so clients and custom groups appear interleaved
    combinedItems.sort((a, b) => a.name.localeCompare(b.name));

    // Individual custom quotations (those without clientId/client object)
    const customQuotations: any[] = allQuotations.filter((q: any) => {
        if (!q) return false;
        const hasClientId = q.clientId || q.client;
        return !hasClientId;
    });

    const deleteQuotationMutation = useDeleteQuotation();

    const handleDeleteQuotation = async (id: string) => {
        const confirmed = await showConfirm("Are you sure you want to delete this quotation?", "Yes", "No");
        if (!confirmed) return;

        try {
            await deleteQuotationMutation.mutateAsync(id);
            showAlert("Quotation deleted successfully", "success");
        } catch (error: any) {
            showAlert(error?.response?.data?.message || "Failed to delete quotation", "error");
        }
    };

    // Services and items needed to generate PDFs client-side
    const { data: itemsResponse } = useItems({ limit: 1000 });
    const items = itemsResponse?.data || [];


    // Generate PDF for a quotation (mode = 'preview' opens in new tab, 'download' saves file)
 // In QuotationsPage.tsx, update the handlers:

const handlePreviewQuotation = async (quotation: any) => {
    try {
        let clientNameForPdf = "";
        if (quotation.clientId && typeof quotation.clientId === 'object') {
            clientNameForPdf = quotation.clientId.business?.businessName || "";
        } else if (quotation.clientId && typeof quotation.clientId === 'string') {
            const client = clients.find((c) => (c as any).id === quotation.clientId || (c as any)._id === quotation.clientId);
            clientNameForPdf = client?.business?.businessName || "";
        } else if (quotation.clientName) {
            clientNameForPdf = quotation.clientName;
        } else if (quotation.customName) {
            clientNameForPdf = quotation.customName;
        }

        // Generate HTML
        const htmlContent = await generateQuotationPDF({
            quotation,
            clientName: clientNameForPdf,
            lang: lang as "ar" | "en",
            t: tr,
            items,
        });

        // Open the HTML directly so preview stays in the tab without triggering print
        const previewWindow = window.open("", "_blank");
        
        if (!previewWindow) {
            showAlert("Pop-up blocked. Please allow pop-ups for this site.", "error");
            return;
        }

        previewWindow.document.open();
        previewWindow.document.write(htmlContent);
        previewWindow.document.close();
    } catch (error: any) {
        console.error("PDF Generation Error:", error);
        showAlert(t("failed_to_generate_pdf") || "Failed to generate PDF. Please try again.", "error");
    }
};

const handleDownloadQuotation = async (quotation: any) => {
    setIsDownloading(quotation._id || quotation.id);
    try {
        let clientNameForPdf = "";
        if (quotation.clientId && typeof quotation.clientId === 'object') {
            clientNameForPdf = quotation.clientId.business?.businessName || "";
        } else if (quotation.clientId && typeof quotation.clientId === 'string') {
            const client = clients.find((c) => (c as any).id === quotation.clientId || (c as any)._id === quotation.clientId);
            clientNameForPdf = client?.business?.businessName || "";
        } else if (quotation.clientName) {
            clientNameForPdf = quotation.clientName;
        } else if (quotation.customName) {
            clientNameForPdf = quotation.customName;
        }

        // Generate HTML
        const htmlContent = await generateQuotationPDF({
            quotation,
            clientName: clientNameForPdf,
            lang: lang as "ar" | "en",
            t: tr,
            items,
        });

        // Download as PDF
        const filename = `quotation-${quotation.quotationNumber || Date.now()}.pdf`;
        await downloadQuotationPDF(htmlContent, filename);
    } catch (error: any) {
        console.error("PDF Generation Error:", error);
        showAlert(t("failed_to_generate_pdf") || "Failed to generate PDF. Please try again.", "error");
    } finally {
        setIsDownloading(null);
    }
};



    // Render Create View
    if (currentView === "create" && selectedClient) {
        const clientId = (selectedClient as any).id || (selectedClient as any)._id || undefined;
        const clientName = selectedClient.business?.businessName || selectedClient.personal?.fullName || t("custom_quotation") || "Custom Quotation";

        return (
            <div className="px-4 sm:px-6">
                <CreateQuotation
                    clientId={clientId}
                    clientName={clientName}
                    onBack={handleBack}
                    onSuccess={(newClientId?: string, newClientName?: string) => {
                        // If API returned clientId, find corresponding client and open preview for it
                        if (newClientId) {
                            const found = clients.find(
                                (c: any) => String(c.id) === String(newClientId) || String((c as any)._id) === String(newClientId),
                            );
                            if (found) return handleShowQuotations(found);

                            // If client not in list (e.g. recently created elsewhere), create a minimal stub and open preview
                            const stub = { id: newClientId, business: { businessName: newClientName || "" } } as Client;
                            return handleShowQuotations(stub);
                        }

                        // If we have a client name (custom quotation), return to list view
                        if (!newClientId && newClientName) {
                            setCurrentView("list");
                            setSelectedClient(null);
                            setEditingQuotation(null);
                            return;
                        }

                        // fallback: re-open preview for the currently selected client (if any)
                        if (selectedClient) return handleShowQuotations(selectedClient);

                        // last resort: go back to list
                        setCurrentView("list");
                    }}
                    editQuotation={editingQuotation || undefined}
                />
            </div>
        );
    }

    // Render Custom Create View (for grouped custom quotation names)
    if (currentView === "custom" && customCreateName) {
        return (
            <div className="px-4 sm:px-6">
                <CustomQuotation
                    clientName={customCreateName}
                    onBack={handleBack}
                    onSuccess={(newClientId?: string, newClientName?: string) => {
                        if (newClientId) {
                            const found = clients.find(
                                (c: any) => String(c.id) === String(newClientId) || String((c as any)._id) === String(newClientId),
                            );
                            if (found) return handleShowQuotations(found);

                            const stub = { id: newClientId, business: { businessName: newClientName || "" } } as Client;
                            return handleShowQuotations(stub);
                        }

                        if (!newClientId && newClientName) {
                            setCurrentView("list");
                            setSelectedClient(null);
                            setEditingQuotation(null);
                            return;
                        }

                        if (selectedClient) return handleShowQuotations(selectedClient);
                        setCurrentView("list");
                    }}
                />
            </div>
        );
    }

    // Render Preview View
    if (currentView === "preview" && selectedClient) {
        const clientId = (selectedClient as any).id || (selectedClient as any)._id || undefined;
        const clientName = selectedClient.business?.businessName || selectedClient.personal?.fullName || "";

        return (
            <div className="px-4 sm:px-6">
                <PreviewQuotation
                    clientId={clientId}
                    clientName={clientName}
                    onBack={handleBack}
                    onCreateNew={() => setCurrentView("create")}
                    onEdit={handleEditQuotation}
                    autoPreviewQuotationId={autoPreviewQuotationId ?? undefined}
                    autoDownloadQuotationId={autoDownloadQuotationId ?? undefined}
                />
            </div>
        );
    }

    // Render List View (Client Selection)
    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-14 h-56 w-56 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-14 h-56 w-56 rounded-full bg-secdark-700/20 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                            Quotation Workspace
                        </span>
                        <h1 className="title mt-3 text-2xl sm:text-3xl">{tr("quotations", "Quotations")}</h1>
                        <p className="text-light-600 dark:text-dark-300 mt-1 text-sm sm:text-base">
                            {tr("create_and_manage_quotations", "Create and manage quotations")}
                        </p>
                    </div>

                    <button
                        onClick={handleCreateCustomQuotation}
                        className="btn-primary rounded-xl"
                        title={tr("create_global_quotation", "Create Custom Quotation")}
                    >
                        {tr("custom_quotation", "Custom Quotation")}
                    </button>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("clients", "Clients")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{clients.length}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("all_quotations", "All Quotations")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{allQuotations.length}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("custom_quotations", "Custom Quotations")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{customQuotations.length}</p>
                </div>
            </section>

            {/* Client Selection */}
            {clientsLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2
                        className="text-light-500 animate-spin"
                        size={32}
                    />
                </div>
            ) : (
                <>
                    {/* Combined grid of clients and custom quotation groups (sorted by name) */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {combinedItems.map((item) => {
                            if (item.type === "client") {
                                const client = item.client;
                                return (
                                    <div
                                        key={`client-${item.id}`}
                                        className="flex flex-col rounded-3xl border border-light-200/80 bg-white/90 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-dark-700/80 dark:bg-dark-900/70"
                                    >
                                        <h3 className="text-light-900 dark:text-dark-50 text-lg font-semibold">{item.name}</h3>
                                        <p className="text-light-600 dark:text-dark-400 mt-1 text-sm">{client.business?.category || "-"}</p>
                                        <p className="text-light-600 dark:text-dark-300 mt-1 text-sm">
                                            {item.quotationCount} {tr("quotations", "quotations")}
                                        </p>
                                        <div className="mt-4 flex flex-col gap-2">
                                            <button
                                                onClick={() => handleCreateQuotation(client)}
                                                className="btn-primary w-full rounded-xl"
                                            >
                                                {tr("create_quotation", "Create Quotation")}
                                            </button>
                                            <button
                                                onClick={() => handleShowQuotations(client)}
                                                className="btn-ghost w-full rounded-xl"
                                            >
                                                {tr("show_quotations", "Show Quotations")}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            // skip rendering grouped custom-quotation cards here
                            return null;
                        })}
                    </div>

                    {combinedItems.length === 0 && (
                        <div className="rounded-3xl border border-light-200/80 bg-white/90 p-6 shadow-sm dark:border-dark-700/80 dark:bg-dark-900/70">
                            <div className="py-8 text-center">
                                <p className="text-light-600 dark:text-dark-300">{tr("no_clients_found", "No clients found")}</p>
                            </div>
                        </div>
                    )}

                    {/* Bottom table: show individual custom quotations only */}
                    {customQuotations.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-light-700 dark:text-dark-50 text-lg font-semibold">
                                {tr("custom_quotations", "Custom Quotations")}
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {customQuotations.map((q) => (
                                    <div
                                        key={q._id}
                                        className="rounded-2xl border border-light-200/80 bg-white/90 p-4 shadow-sm dark:border-dark-700/80 dark:bg-dark-900/70"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="mb-2 flex items-center gap-3">
                                                    <h4 className="text-light-900 dark:text-dark-50 font-semibold">
                                                        {q.clientName ||
                                                            q.customName ||
                                                            q.customClientName ||
                                                            tr("unnamed_custom_quotation", "Unnamed") ||
                                                            "Unnamed"}
                                                    </h4>
                                                    <span className="text-light-600 dark:text-dark-400 text-sm">{q.quotationNumber || "-"}</span>
                                                </div>
                                                <p className="text-light-600 dark:text-dark-400 mb-1 text-sm">
                                                    {q.createdAt ? new Date(q.createdAt).toLocaleString() : "-"}
                                                </p>
                                                {q.note && <p className="text-light-600 dark:text-dark-400 mb-2 text-sm italic">{q.note}</p>}
                                                <p className="text-light-900 dark:text-dark-50 font-bold">
                                                    {q.total ?? "-"} {lang === "ar" ? "ج.م" : "EGP"}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handlePreviewQuotation(q)}
                                                    className="btn-ghost rounded-xl"
                                                    title={tr("preview_pdf", "Preview PDF")}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadQuotation(q)}
                                                    className="btn-ghost rounded-xl"
                                                    title={tr("download_pdf", "Download PDF")}
                                                    disabled={isDownloading === (q._id || q.id)}
                                                >
                                                    {isDownloading === (q._id || q.id) ? (
                                                        <Loader2 size={16} className="text-light-500 animate-spin" />
                                                    ) : (
                                                        <Download size={16} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingQuotation(q);
                                                        setSelectedClient({
                                                            business: { businessName: q.clientName || q.customName || q.customClientName || "" },
                                                        } as Client);
                                                        setCurrentView("create");
                                                    }}
                                                    className="btn-ghost rounded-xl"
                                                    title={tr("edit", "Edit")}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteQuotation(q._id)}
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
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default QuotationsPage;

