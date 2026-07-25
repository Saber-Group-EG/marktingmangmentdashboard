import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Users, Mail, Phone, MapPin, Edit2, Target, Plus, Trash2, Globe } from "lucide-react";
import { SiBehance, SiFacebook, SiInstagram, SiTiktok, SiX } from "react-icons/si";
import { useQueryClient } from "@tanstack/react-query";
import LocalizedArrow from "@/components/LocalizedArrow";
import { useLang } from "@/hooks/useLang";
import { showAlert, showConfirm } from "@/utils/swal";
import validators from "@/constants/validators";
import type { Client, Segment } from "@/api/interfaces/clientinterface";
import {
    useClient,
    useUpdateClient,
    useDeleteClient,
    useCreateSegment,
    useUpdateSegment,
    useDeleteSegment,
    useCreateCompetitor,
    useUpdateCompetitor,
    useDeleteCompetitor,
    useCreateBranch,
    useUpdateBranch,
    useDeleteBranch,
    clientsKeys,
} from "@/hooks/queries";
import { createSegments as apiCreateSegments } from "@/api/requests/segmentService";
import { createCompetitors as apiCreateCompetitors } from "@/api/requests/competitorsService";
import { createBranches as apiCreateBranches } from "@/api/requests/branchesService";

interface ClientInfoProps {
    client?: Client | null;
    compact?: boolean;
    editing?: boolean;
    draft?: Partial<Client> | null;
    setDraft?: React.Dispatch<React.SetStateAction<Partial<Client> | null>> | null;
    fullPage?: boolean;
}

const ClientInfo: React.FC<ClientInfoProps> = ({
    client: propClient,
    compact = false,
    editing: propEditing = false,
    draft: propDraft = null,
    setDraft: propSetDraft = null,
    fullPage = false,
}) => {
    const { t } = useLang();
    const tx = (key: string, fallback: string): string => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const queryClient = useQueryClient();

    // Full page state management - call hook unconditionally but enable only when fullPage
    const { data: fetchedClient, isLoading: loading, error: queryError } = useClient(id || "", fullPage);
    const error = queryError?.message || null;

    // React Query mutations (initialize regardless so save works in nested mode)
    const updateClientMutation = useUpdateClient();
    const deleteClientMutation = useDeleteClient();
    const _createSegmentMutation = useCreateSegment();
    const updateSegmentMutation = useUpdateSegment();
    const deleteSegmentMutation = useDeleteSegment();
    const _createCompetitorMutation = useCreateCompetitor();
    const updateCompetitorMutation = useUpdateCompetitor();
    const deleteCompetitorMutation = useDeleteCompetitor();
    const _createBranchMutation = useCreateBranch();
    const updateBranchMutation = useUpdateBranch();
    const deleteBranchMutation = useDeleteBranch();

    // touch unused mutation variables to satisfy TypeScript unused-variable checks
    void _createSegmentMutation;
    void _createCompetitorMutation;
    void _createBranchMutation;

    const [localEditing, setLocalEditing] = useState<boolean>(propEditing);
    const [localDraft, setLocalDraft] = useState<Partial<Client> | null>(propDraft);
    const [expandedCompetitorId, setExpandedCompetitorId] = useState<string | null>(null);

    // Use local state for fullPage mode, props for nested mode
    const editing = fullPage ? localEditing : propEditing;
    const draft = fullPage ? localDraft : propDraft;
    const setEditing = fullPage ? setLocalEditing : () => {};
    const setDraft = fullPage ? setLocalDraft : propSetDraft || (() => {});

    // Normalize user-provided URLs so clicking them opens external sites.
    const normalizeUrl = (raw?: string) => {
        if (!raw) return "";
        const url = raw.toString().trim();
        if (url === "") return "";
        // If it already has a protocol or is protocol-relative, return as-is
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) || url.startsWith("//")) return url;
        // Otherwise assume https
        return `https://${url}`;
    };

    // Use fetched client if full page, otherwise use prop client
    const client = fullPage ? fetchedClient : propClient;

    // Determine client id: prefer route param, fall back to provided client object
    const clientId = id || (client && ((client as any)._id || (client as any).id));

    const clientObjectives: any[] = [];
    const draftDate: Date | null = null;

    useEffect(() => {
        if (fullPage && searchParams.get("edit") === "true" && client) {
            setEditing(true);
            setDraft(JSON.parse(JSON.stringify(client)) as Partial<Client>);
        }
    }, [fullPage, searchParams, client]);

    // Local inputs for per-segment temporary values (used by chip-style inputs)
    const [segmentInputs, setSegmentInputs] = useState<Record<number, { age?: string; area?: string; governorate?: string; productName?: string }>>(
        {},
    );

    const setSegmentInput = (idx: number, field: string, value: string) => {
        setSegmentInputs((prev) => ({ ...(prev || {}), [idx]: { ...(prev[idx] || {}), [field]: value } }));
    };

    // Use segments from client object or fetch separately if needed
    if (!client && !draft) {
        if (fullPage && loading) {
            return (
                <div className="flex min-h-[400px] items-center justify-center">
                    <div className="text-center">
                        <div className="border-light-500 border-t-light-500 dark:border-light-500 dark:border-t-light-500 mx-auto h-12 w-12 animate-spin rounded-full border-4"></div>
                        <p className="text-dark-500 mt-4">{t("loading") || "Loading..."}</p>
                    </div>
                </div>
            );
        }
        if (fullPage && error) {
            return (
                <div className="flex min-h-[400px] items-center justify-center">
                    <div className="space-y-4 text-center">
                        <p className="text-red-600 dark:text-red-400">{error || "Client not found"}</p>
                        <button
                            onClick={() => navigate("/clients")}
                            className="btn-primary"
                        >
                            {t("back_to_clients") || "Back to Clients"}
                        </button>
                    </div>
                </div>
            );
        }
        return null;
    }

    const data: Partial<Client> = editing && draft ? draft || {} : client || {};

    const updateDraft = (path: string, value: any): void => {
        const setDraftFn = fullPage ? setDraft : propSetDraft;
        if (!editing || !setDraftFn || !draft) return;
        setDraftFn((prev: Partial<Client> | null) => {
            const next = JSON.parse(JSON.stringify(prev || {})) as Partial<Client> & Record<string, any>;
            const parts = path.split(".");
            let cur: Record<string, any> = next as Record<string, any>;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!cur[parts[i]]) cur[parts[i]] = {};
                cur = cur[parts[i]];
            }
            cur[parts[parts.length - 1]] = value;
            return next;
        });
    };

    const ensureDraftArray = (path: string) => {
        const setDraftFn = fullPage ? setDraft : propSetDraft;
        if (!draft || !setDraftFn) return;
        setDraftFn((prev: Partial<Client> | null) => {
            const next = JSON.parse(JSON.stringify(prev || {})) as Record<string, any>;
            const parts = path.split(".");
            let cur: Record<string, any> = next as Record<string, any>;
            for (let i = 0; i < parts.length; i++) {
                const key = parts[i];
                if (i === parts.length - 1) {
                    if (!cur[key]) cur[key] = [];
                } else {
                    if (!cur[key]) cur[key] = {};
                    cur = cur[key];
                }
            }
            return next;
        });
    };

    // Local inputs for per-segment temporary values (used by chip-style inputs)
    const addSegmentChip = (idx: number, field: "ageRange" | "area" | "governorate" | "productName") => {
        const val = (
            (segmentInputs[idx] && (segmentInputs[idx] as any)[field.replace(/Range$/, "")]) ||
            (segmentInputs[idx] && (segmentInputs[idx] as any)[field]) ||
            ""
        )
            .toString()
            .trim();
        if (!val) return;
        const sanitize = field === "ageRange" ? (s: string) => s.replace(/[^0-9-]/g, "") : (s: string) => s.trim();
        const cleaned = sanitize(val);
        if (!cleaned) return;
        const existing = Array.isArray((data as any).segments?.[idx]?.[field]) ? [...((data as any).segments[idx][field] as any[])] : [];
        existing.push(cleaned);
        updateDraft(`segments.${idx}.${field}`, existing.length > 0 ? existing : "");
        setSegmentInput(idx, field.replace(/Range$/, ""), "");
        // clear the field properly in state
        setSegmentInput(idx, field as any, "");
    };

    const removeSegmentChip = (idx: number, field: string, chipIndex: number) => {
        const existing = Array.isArray((data as any).segments?.[idx]?.[field]) ? [...((data as any).segments[idx][field] as any[])] : [];
        existing.splice(chipIndex, 1);
        updateDraft(`segments.${idx}.${field}`, existing.length > 0 ? existing : "");
    };

    const startEditing = () => {
        setDraft(client ? (JSON.parse(JSON.stringify(client)) as Partial<Client>) : null);
        setEditing(true);
    };

    const openObjectivesPlanner = () => {
        if (!clientId) return;
        navigate("/strategies/manage", {
            state: {
                clientId: String(clientId),
                referrer: {
                    pathname: location.pathname || "/clients",
                    state: (location && (location as any).state) || null,
                },
            },
        });
    };

    const cancelEditing = () => {
        setDraft(null);
        setEditing(false);
    };

    // Helper function to deep compare two objects
    const hasChanges = (obj1: any, obj2: any): boolean => {
        const json1 = JSON.stringify(obj1);
        const json2 = JSON.stringify(obj2);
        return json1 !== json2;
    };

    const saveEditing = async () => {
        if (!draft || !id) return;

        try {
            const draftCopy = JSON.parse(JSON.stringify(draft)) as Record<string, any>;
            const draftSegments = draftCopy.segments || [];
            const draftCompetitors = draftCopy.competitors || [];
            const draftBranches = draftCopy.branches || [];

            delete draftCopy.segments;
            delete draftCopy.competitors;
            delete draftCopy.branches;

            const sanitizedForClient = draftCopy;

            if (sanitizedForClient.socialLinks) {
                const flat: any[] = [];
                if (Array.isArray(sanitizedForClient.socialLinks)) {
                    flat.push(...sanitizedForClient.socialLinks);
                } else if (typeof sanitizedForClient.socialLinks === "object") {
                    const business = Array.isArray(sanitizedForClient.socialLinks.business) ? sanitizedForClient.socialLinks.business : [];
                    const personal = Array.isArray(sanitizedForClient.socialLinks.personal) ? sanitizedForClient.socialLinks.personal : [];
                    const custom = Array.isArray(sanitizedForClient.socialLinks.custom) ? sanitizedForClient.socialLinks.custom : [];
                    flat.push(...business, ...personal, ...custom);
                }

                const mainPlatforms = ["Facebook", "Instagram", "TikTok", "X (Twitter)"];

                sanitizedForClient.socialLinks = flat
                    .map((l: any) => {
                        if (!l) return null;
                        let platform = "";
                        if (l.platform && typeof l.platform === "string" && l.platform.trim()) {
                            platform = l.platform.trim();
                        } else if (l.name && typeof l.name === "string" && l.name.trim()) {
                            platform = l.name.trim();
                        } else {
                            platform = "Website";
                        }
                        const url = (l.url || l.link || "").toString().trim();
                        const isMainPlatform = mainPlatforms.includes(platform);
                        if (!url && !isMainPlatform) return null;
                        return { platform, url };
                    })
                    .filter(Boolean);
            }

            if (sanitizedForClient.swot && typeof sanitizedForClient.swot === "object") {
                sanitizedForClient.swot = {
                    strengths: Array.isArray(sanitizedForClient.swot.strengths)
                        ? sanitizedForClient.swot.strengths.map((s: any) => (typeof s === "string" ? s.trim() : s)).filter(Boolean)
                        : [],
                    weaknesses: Array.isArray(sanitizedForClient.swot.weaknesses)
                        ? sanitizedForClient.swot.weaknesses.map((s: any) => (typeof s === "string" ? s.trim() : s)).filter(Boolean)
                        : [],
                    opportunities: Array.isArray(sanitizedForClient.swot.opportunities)
                        ? sanitizedForClient.swot.opportunities.map((s: any) => (typeof s === "string" ? s.trim() : s)).filter(Boolean)
                        : [],
                    threats: Array.isArray(sanitizedForClient.swot.threats)
                        ? sanitizedForClient.swot.threats.map((s: any) => (typeof s === "string" ? s.trim() : s)).filter(Boolean)
                        : [],
                };
            }

            await updateClientMutation!.mutateAsync({ clientId, data: sanitizedForClient });

            const originalSegments = client?.segments || [];
            try {
            } catch (e) {}
            // Process segments: batch-create new segments using bulk endpoint, keep updates/deletes per-item
            const segmentCreatePayloads: any[] = [];
            const segmentUpdatePromises: Promise<any>[] = [];
            const segmentDeletePromises: Promise<any>[] = [];

            // helper to normalize various population shapes into either a single number,
            // an array of numbers, or undefined. If a single numeric value is provided
            // we return a number (backend validation may expect a single number),
            // while CSV/arrays with multiple values become arrays.
            const normalizePopulation = (val: any): number | number[] | undefined => {
                if (val === undefined || val === null) return undefined;
                if (Array.isArray(val)) {
                    const nums = val.map((v: any) => Number(v)).filter((n: number) => !Number.isNaN(n));
                    if (nums.length === 0) return undefined;
                    return nums.length === 1 ? nums[0] : nums;
                }
                if (typeof val === "string") {
                    const parts = val
                        .toString()
                        .split(/[,;\n]+/)
                        .map((s: string) => s.trim())
                        .filter(Boolean);
                    const nums = parts.map((p: string) => Number(p)).filter((n: number) => !Number.isNaN(n));
                    if (nums.length === 0) return undefined;
                    return nums.length === 1 ? nums[0] : nums;
                }
                if (typeof val === "number") {
                    return Number.isNaN(val) ? undefined : val;
                }
                return undefined;
            };

            for (const segment of draftSegments) {
                const sanitized = JSON.parse(JSON.stringify(segment));
                if (sanitized._interestsText !== undefined) delete sanitized._interestsText;
                // Normalize population into either number or array depending on contents
                if (sanitized.population !== undefined) {
                    sanitized.population = normalizePopulation(sanitized.population);
                }

                if (sanitized._id) {
                    const originalSegment = originalSegments.find((s: Segment) => s._id === sanitized._id);
                    if (originalSegment) {
                        const originalSanitized = JSON.parse(JSON.stringify(originalSegment));
                        if (originalSanitized._interestsText !== undefined) delete originalSanitized._interestsText;
                        if (hasChanges(originalSanitized, sanitized)) {
                            // log the payload being sent for update to inspect population
                            try {
                            } catch (e) {}
                            segmentUpdatePromises.push(
                                updateSegmentMutation!
                                    .mutateAsync({ clientId: clientId, segmentId: sanitized._id, data: sanitized }, { onSuccess: () => {} })
                                    .catch((err) => console.error("Error updating segment:", err)),
                            );
                        }
                    }
                } else {
                    segmentCreatePayloads.push(sanitized);
                }
            }

            for (const originalSegment of originalSegments) {
                const stillExists = draftSegments.find((s: Segment) => s._id === originalSegment._id);
                if (!stillExists && originalSegment._id) {
                    segmentDeletePromises.push(
                        deleteSegmentMutation!
                            .mutateAsync({ clientId: clientId, segmentId: originalSegment._id }, { onSuccess: () => {} })
                            .catch((err) => console.error("Error deleting segment:", err)),
                    );
                }
            }

            // Batch create new segments if any
            if (segmentCreatePayloads.length > 0) {
                try {
                    try {
                    } catch (e) {}
                    await apiCreateSegments(clientId, segmentCreatePayloads);
                } catch (err) {}
            }

            // Run updates/deletes in parallel
            if (segmentUpdatePromises.length > 0 || segmentDeletePromises.length > 0) {
                await Promise.all([...segmentUpdatePromises, ...segmentDeletePromises]);
            }

            const originalCompetitors = client?.competitors || [];
            const competitorCreatePayloads: any[] = [];
            const competitorUpdatePromises: Promise<any>[] = [];
            const competitorDeletePromises: Promise<any>[] = [];

            for (const competitor of draftCompetitors) {
                const sanitized = JSON.parse(JSON.stringify(competitor));

                if (sanitized._id) {
                    const originalCompetitor = originalCompetitors.find((c: any) => c._id === sanitized._id);
                    if (originalCompetitor && hasChanges(originalCompetitor, sanitized)) {
                        competitorUpdatePromises.push(
                            updateCompetitorMutation!
                                .mutateAsync({ clientId: clientId, competitorId: sanitized._id, data: sanitized }, { onSuccess: () => {} })
                                .catch((err) => console.error("Error updating competitor:", err)),
                        );
                    }
                } else {
                    competitorCreatePayloads.push(sanitized);
                }
            }

            for (const originalCompetitor of originalCompetitors) {
                const stillExists = draftCompetitors.find((c: any) => c._id === originalCompetitor._id);
                if (!stillExists && originalCompetitor._id) {
                    competitorDeletePromises.push(
                        deleteCompetitorMutation!
                            .mutateAsync({ clientId: clientId, competitorId: originalCompetitor._id }, { onSuccess: () => {} })
                            .catch((err) => console.error("Error deleting competitor:", err)),
                    );
                }
            }

            // Bulk create new competitors if any
            if (competitorCreatePayloads.length > 0) {
                try {
                    await apiCreateCompetitors(clientId, competitorCreatePayloads);
                } catch (err) {
                    console.error("Error creating competitors (bulk):", err);
                }
            }

            if (competitorUpdatePromises.length > 0 || competitorDeletePromises.length > 0) {
                await Promise.all([...competitorUpdatePromises, ...competitorDeletePromises]);
            }

            const originalBranches = client?.branches || [];
            const branchCreatePayloads: any[] = [];
            const branchUpdatePromises: Promise<any>[] = [];
            const branchDeletePromises: Promise<any>[] = [];

            for (const branch of draftBranches) {
                const sanitized = JSON.parse(JSON.stringify(branch));

                if (sanitized._id) {
                    const originalBranch = originalBranches.find((b: any) => b._id === sanitized._id);
                    if (originalBranch && hasChanges(originalBranch, sanitized)) {
                        branchUpdatePromises.push(
                            updateBranchMutation!
                                .mutateAsync({ clientId: clientId, branchId: sanitized._id, data: sanitized }, { onSuccess: () => {} })
                                .catch((err) => console.error("Error updating branch:", err)),
                        );
                    }
                } else {
                    branchCreatePayloads.push(sanitized);
                }
            }

            for (const originalBranch of originalBranches) {
                const stillExists = draftBranches.find((b: any) => b._id === originalBranch._id);
                if (!stillExists && originalBranch._id) {
                    branchDeletePromises.push(
                        deleteBranchMutation!
                            .mutateAsync({ clientId: clientId, branchId: originalBranch._id }, { onSuccess: () => {} })
                            .catch((err) => console.error("Error deleting branch:", err)),
                    );
                }
            }

            // Bulk create new branches if any
            if (branchCreatePayloads.length > 0) {
                try {
                    await apiCreateBranches(clientId, branchCreatePayloads);
                } catch (err) {}
            }

            if (branchUpdatePromises.length > 0 || branchDeletePromises.length > 0) {
                await Promise.all([...branchUpdatePromises, ...branchDeletePromises]);
            }

            await queryClient.refetchQueries({
                queryKey: clientsKeys.detail(clientId),
                exact: true,
            });

            try {
                // Fetch fresh client from cache/server and log it for debugging
                await queryClient.fetchQuery({ queryKey: clientsKeys.detail(clientId) });
            } catch (e) {
                // ignore
            }

            setEditing(false);
            setDraft(null);

            showAlert("Client updated successfully!", "success");
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || "Failed to update client";
            showAlert(`Error: ${errorMessage}. Please try again.`, "error");
        }
    };

    const handleDeleteClient = async () => {
        if (!fullPage || !id) return;
        const confirmed = await showConfirm(
            t("confirm_delete_client") || "Are you sure you want to delete this client?",
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) {
            return;
        }

        try {
            await deleteClientMutation!.mutateAsync(id);
            showAlert("Client deleted successfully!", "success");
            navigate("/clients");
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || "Failed to delete client";
            showAlert(`Error: ${errorMessage}. Please try again.`, "error");
        }
    };

    const inputBaseClass =
        "w-full rounded-xl border border-light-200 bg-white/90 px-3 py-2 text-sm text-light-900 placeholder-light-400 shadow-sm transition-all duration-200 focus:border-light-500 focus:outline-none focus:ring-2 focus:ring-light-500/20 dark:border-dark-700 dark:bg-dark-800/80 dark:text-dark-50";

    const buttonGhostClass =
        "rounded-xl border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-500 hover:bg-light-100 dark:border-dark-700 dark:bg-dark-900/50 dark:text-dark-50 dark:hover:bg-dark-800";

    const buttonAddClass =
        "rounded-xl border border-light-200 bg-light-50 px-3 py-1 text-xs font-semibold text-light-600 hover:bg-light-100 dark:border-dark-700 dark:bg-dark-900/50 dark:text-dark-100 dark:hover:bg-dark-800";

    const surfaceClass =
        "card rounded-[1.5rem] border-light-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-dark-800 dark:bg-dark-900/90 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md";

    const sectionsCount = (editing ? draft?.segments : client?.segments)?.length || 0;
    const competitorsCount = (editing ? draft?.competitors : client?.competitors)?.length || 0;
    const branchesCount = (editing ? draft?.branches : client?.branches)?.length || 0;
    const socialLinksCount = (editing ? draft?.socialLinks?.business : client?.socialLinks?.business)?.length || 0;
    const swotItemsCount = ((editing ? draft?.swot?.strengths : client?.swot?.strengths)?.length || 0) +
        ((editing ? draft?.swot?.weaknesses : client?.swot?.weaknesses)?.length || 0) +
        ((editing ? draft?.swot?.opportunities : client?.swot?.opportunities)?.length || 0) +
        ((editing ? draft?.swot?.threats : client?.swot?.threats)?.length || 0);

    // small helpers to display validation state for a given value
    const makeInvalidClass = (invalid: boolean): string => (invalid ? " border-red-500 ring-1 ring-red-200 dark:ring-red-900/30" : "");

    // Full page layout
    if (fullPage && client) {
        return (
            <div className="space-y-8">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-light-200 bg-white p-5 shadow-sm dark:border-dark-800 dark:bg-dark-900 sm:p-6">
                    <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-light-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-14 -left-14 h-40 w-40 rounded-full bg-secdark-700/10 blur-3xl" />

                    <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="btn-secondary flex items-center gap-2"
                            aria-label="Back"
                        >
                            <LocalizedArrow className="h-4 w-4" />
                        </button>
                        <div>
                            <p className="text-light-500 dark:text-dark-400 text-[11px] font-black uppercase tracking-wider">Client Profile</p>
                            <h1 className="text-light-900 dark:text-dark-50 text-xl font-black tracking-tight sm:text-2xl">
                                {client.business?.businessName || client.personal?.fullName || t("unnamed_business")}
                            </h1>
                            <p className="text-light-600 dark:text-dark-400 mt-1 text-sm">
                                {client.business?.category || t("no_category")}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {sectionsCount} {t("segments_label") || "Segments"}
                                </span>
                                <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {competitorsCount} {t("competitors_label") || "Competitors"}
                                </span>
                                <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {swotItemsCount} {t("swot_items") || "SWOT Items"}
                                </span>
                                <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {branchesCount} {t("branches") || "Branches"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-light-200/80 bg-white/70 p-1.5 shadow-sm dark:border-dark-700 dark:bg-dark-900/70">
                        {!editing ? (
                            <>
                                <button
                                    onClick={startEditing}
                                    className="btn-primary flex items-center gap-2"
                                    aria-label="Edit"
                                >
                                    <Edit2 className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t("edit")}</span>
                                </button>
                                <button
                                    onClick={handleDeleteClient}
                                    className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                    aria-label="Delete"
                                >
                                    <span className="hidden sm:inline">{t("delete") || "Delete"}</span>
                                </button>
                            </>
                        ) : (
                            <div className="flex min-w-0 gap-2">
                                <button
                                    onClick={saveEditing}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {t("save") || "Save"}
                                </button>
                                <button
                                    onClick={cancelEditing}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    {t("cancel") || "Cancel"}
                                </button>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                navigate("/strategies");
                            }}
                            className="btn-primary btn-sm flex items-center gap-2"
                        >
                            {t("plan_campaign")}
                        </button>
                    </div>
                </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <ClientInfo
                            client={client}
                            compact={false}
                            editing={editing}
                            draft={draft}
                            setDraft={setDraft}
                            fullPage={false}
                        />
                    </div>

                    <div className="space-y-5 lg:col-span-8">
                        {/* SWOT */}
                        <div className={surfaceClass}>
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="card-title">{t("swot") || "SWOT Analysis"}</h3>
                                    <p className="text-light-500 dark:text-dark-400 mt-1 text-xs">
                                        {tx("strategic_overview", "Strategic overview across strengths, weaknesses, opportunities, and threats.")}
                                    </p>
                                </div>
                                <span className="rounded-full border border-light-200 bg-light-50 px-3 py-1 text-xs font-black tracking-wide text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {swotItemsCount} {t("swot_items") || "Items"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {["strengths", "weaknesses", "opportunities", "threats"].map((key) => {
                                    const titleMap = {
                                        strengths: {
                                            label: t("strengths") || "Strengths",
                                            color: "text-emerald-700 dark:text-emerald-400",
                                            panel: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10",
                                            badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
                                            item: "border-emerald-200/80 bg-white/80 dark:border-emerald-500/20 dark:bg-dark-900/70",
                                        },
                                        weaknesses: {
                                            label: t("weaknesses") || "Weaknesses",
                                            color: "text-rose-700 dark:text-rose-400",
                                            panel: "border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10",
                                            badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
                                            item: "border-rose-200/80 bg-white/80 dark:border-rose-500/20 dark:bg-dark-900/70",
                                        },
                                        opportunities: {
                                            label: t("opportunities") || "Opportunities",
                                            color: "text-sky-700 dark:text-sky-400",
                                            panel: "border-sky-200 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/10",
                                            badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
                                            item: "border-sky-200/80 bg-white/80 dark:border-sky-500/20 dark:bg-dark-900/70",
                                        },
                                        threats: {
                                            label: t("threats") || "Threats",
                                            color: "text-amber-700 dark:text-amber-400",
                                            panel: "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10",
                                            badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
                                            item: "border-amber-200/80 bg-white/80 dark:border-amber-500/20 dark:bg-dark-900/70",
                                        },
                                    };
                                    const k = key as keyof Client["swot"];
                                    const items: any[] = (editing ? (draft?.swot as any)?.[k] : (client?.swot as any)?.[k]) || [];
                                    const marker = key === "strengths" ? "S" : key === "weaknesses" ? "W" : key === "opportunities" ? "O" : "T";
                                    return (
                                        <div
                                            key={key}
                                            className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md ${titleMap[key as keyof typeof titleMap].panel}`}
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <h4 className={`flex items-center gap-2 text-sm font-black uppercase tracking-wide ${titleMap[key as keyof typeof titleMap].color}`}>
                                                    <span
                                                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${titleMap[key as keyof typeof titleMap].badge}`}
                                                    >
                                                        {marker}
                                                    </span>
                                                    {titleMap[key as keyof typeof titleMap].label}
                                                </h4>
                                                <span className="text-light-500 dark:text-dark-400 text-xs font-semibold">
                                                    {items.length}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                {items.length > 0 ? (
                                                    items.map((item: any, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${titleMap[key as keyof typeof titleMap].item}`}
                                                        >
                                                            {editing ? (
                                                                <input
                                                                    className={inputBaseClass}
                                                                    value={item}
                                                                    onChange={(e) => updateDraft(`swot.${key}.${idx}`, e.target.value)}
                                                                />
                                                            ) : (
                                                                <div className="text-light-900 dark:text-dark-50 w-full font-medium">{item}</div>
                                                            )}
                                                            {editing && (
                                                                <button
                                                                    className={buttonGhostClass}
                                                                    onClick={() => {
                                                                        setDraft((prev: Partial<Client> | null) => {
                                                                            const next = JSON.parse(JSON.stringify(prev || {})) as Record<
                                                                                string,
                                                                                any
                                                                            >;
                                                                            next.swot = next.swot || {};
                                                                            next.swot[key] = next.swot[key] || [];
                                                                            next.swot[key].splice(idx, 1);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                >
                                                                    {t("remove") || "Remove"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-dark-500 dark:text-dark-400 rounded-xl border border-dashed border-light-300 bg-white/60 px-3 py-2 text-xs dark:border-dark-700 dark:bg-dark-900/50">
                                                        {t("none_listed") || "None listed"}
                                                    </div>
                                                )}
                                                {editing && (
                                                    <button
                                                        className={`${buttonAddClass} w-full justify-center`}
                                                        onClick={() => {
                                                            ensureDraftArray("swot." + key);
                                                            setDraft((prev: Partial<Client> | null) => {
                                                                const next = JSON.parse(JSON.stringify(prev || {})) as Record<string, any>;
                                                                next.swot = next.swot || {};
                                                                next.swot[key] = next.swot[key] || [];
                                                                next.swot[key].push("");
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        {t("add") || "Add"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Competitors */}
                        <div className={surfaceClass}>
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="card-title">{t("competitors") || "Competitors"}</h3>
                                    <p className="text-light-500 dark:text-dark-400 mt-1 text-xs">
                                        {tx("competitor_landscape", "Track major competitors and their positioning.")}
                                    </p>
                                </div>
                                <span className="rounded-full border border-light-200 bg-light-50 px-3 py-1 text-xs font-black tracking-wide text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {competitorsCount} {t("competitors_label") || "Competitors"}
                                </span>
                            </div>
                            {(editing ? draft?.competitors || [] : client.competitors || []).length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {(editing ? draft?.competitors || [] : client.competitors || []).map((competitor, idx) => (
                                        <div
                                            key={idx}
                                            className="rounded-2xl border border-light-200 bg-white/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md dark:border-dark-700 dark:bg-dark-800/60"
                                        >
                                            {editing ? (
                                                <>
                                                    <input
                                                        className={inputBaseClass}
                                                        value={competitor.name || ""}
                                                        placeholder={t("name_label") || "Name"}
                                                        onChange={(e) => updateDraft(`competitors.${idx}.name`, e.target.value)}
                                                    />

                                                    <textarea
                                                        className={`${inputBaseClass} mt-2`}
                                                        value={competitor.description || ""}
                                                        placeholder={t("description") || "Description"}
                                                        onChange={(e) => updateDraft(`competitors.${idx}.description`, e.target.value)}
                                                    />

                                                    <div className="mt-2 grid grid-cols-1 gap-2">
                                                        <input
                                                            className={inputBaseClass}
                                                            value={(competitor.website as any) || ""}
                                                            placeholder={t("website_label") || "Website"}
                                                            onChange={(e) => updateDraft(`competitors.${idx}.website`, e.target.value)}
                                                        />
                                                        <input
                                                            className={inputBaseClass}
                                                            value={((competitor as any).facebook as any) || ""}
                                                            placeholder={t("facebook") || "Facebook"}
                                                            onChange={(e) => updateDraft(`competitors.${idx}.facebook`, e.target.value)}
                                                        />
                                                        <input
                                                            className={inputBaseClass}
                                                            value={((competitor as any).instagram as any) || ""}
                                                            placeholder={t("instagram") || "Instagram"}
                                                            onChange={(e) => updateDraft(`competitors.${idx}.instagram`, e.target.value)}
                                                        />
                                                        <input
                                                            className={inputBaseClass}
                                                            value={((competitor as any).twitter as any) || ""}
                                                            placeholder={t("twitter") || "Twitter/X"}
                                                            onChange={(e) => updateDraft(`competitors.${idx}.twitter`, e.target.value)}
                                                        />
                                                        <input
                                                            className={inputBaseClass}
                                                            value={((competitor as any).tiktok as any) || ""}
                                                            placeholder={t("tiktok") || "TikTok"}
                                                            onChange={(e) => updateDraft(`competitors.${idx}.tiktok`, e.target.value)}
                                                        />
                                                    </div>

                                                    {/* SWOT editing */}
                                                    <div className="mt-3 space-y-2">
                                                        {(["swot_strengths", "swot_weaknesses", "swot_opportunities", "swot_threats"] as const).map(
                                                            (field) => (
                                                                <div
                                                                    key={field}
                                                                    className="space-y-1"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <strong className="text-dark-500 dark:text-dark-400 text-sm">
                                                                            {field
                                                                                .replace(/swot_/, "")
                                                                                .replace(/_/g, " ")
                                                                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                                                                        </strong>
                                                                        <button
                                                                            type="button"
                                                                            className={buttonAddClass}
                                                                            onClick={() => {
                                                                                setDraft((prev: Partial<Client> | null) => {
                                                                                    const next = JSON.parse(JSON.stringify(prev || {})) as Record<
                                                                                        string,
                                                                                        any
                                                                                    >;
                                                                                    next.competitors = next.competitors || [];
                                                                                    next.competitors[idx] = next.competitors[idx] || {};
                                                                                    next.competitors[idx][field] = next.competitors[idx][field] || [];
                                                                                    next.competitors[idx][field].push("");
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        >
                                                                            {t("add") || "Add"}
                                                                        </button>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        {((competitor as any)[field] || []).map((val: any, i: number) => (
                                                                            <div
                                                                                key={i}
                                                                                className="flex items-center gap-2"
                                                                            >
                                                                                <input
                                                                                    className={inputBaseClass}
                                                                                    value={val || ""}
                                                                                    onChange={(e) =>
                                                                                        updateDraft(
                                                                                            `competitors.${idx}.${field}.${i}`,
                                                                                            e.target.value,
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    className="text-danger-500"
                                                                                    onClick={() => {
                                                                                        setDraft((prev: Partial<Client> | null) => {
                                                                                            const next = JSON.parse(
                                                                                                JSON.stringify(prev || {}),
                                                                                            ) as Record<string, any>;
                                                                                            next.competitors = next.competitors || [];
                                                                                            next.competitors[idx] = next.competitors[idx] || {};
                                                                                            next.competitors[idx][field] =
                                                                                                next.competitors[idx][field] || [];
                                                                                            next.competitors[idx][field].splice(i, 1);
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    {t("remove") || "Remove"}
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>

                                                    <div className="mt-2">
                                                        <button
                                                            className={buttonGhostClass}
                                                            onClick={() =>
                                                                setDraft((prev: Partial<Client> | null) => {
                                                                    const next = JSON.parse(JSON.stringify(prev || {})) as Partial<Client> &
                                                                        Record<string, any>;
                                                                    next.competitors = next.competitors || [];
                                                                    next.competitors.splice(idx, 1);
                                                                    return next;
                                                                })
                                                            }
                                                        >
                                                            {t("remove") || "Remove"}
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => {
                                                            const cid = competitor._id || `idx-${idx}`;
                                                            setExpandedCompetitorId((prev) => (prev === cid ? null : cid));
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                const cid = competitor._id || `idx-${idx}`;
                                                                setExpandedCompetitorId((prev) => (prev === cid ? null : cid));
                                                            }
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <h4 className="text-light-900 dark:text-dark-50 font-semibold">{competitor.name}</h4>
                                                            <span className="rounded-full border border-light-200 bg-light-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                                                #{idx + 1}
                                                            </span>
                                                        </div>
                                                        <p className="text-light-600 dark:text-dark-400 mt-1 text-sm">{competitor.description}</p>
                                                    </div>

                                                    {/* Social Links (icons) */}
                                                    {competitor.socialLinks && competitor.socialLinks.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {competitor.socialLinks.map((link: any, linkIdx: number) => {
                                                                const platformLower = (link.platform || "").toLowerCase().trim();
                                                                let Icon: any = Globe;
                                                                let colorClass = "text-light-500 dark:text-dark-300";
                                                                if (platformLower === "facebook") {
                                                                    Icon = SiFacebook;
                                                                    colorClass = "text-blue-600";
                                                                } else if (platformLower === "instagram") {
                                                                    Icon = SiInstagram;
                                                                    colorClass = "text-pink-600";
                                                                } else if (platformLower === "tiktok") {
                                                                    Icon = SiTiktok;
                                                                    colorClass = "text-dark-900 dark:text-dark-50";
                                                                } else if (platformLower === "twitter" || platformLower === "x") {
                                                                    Icon = SiX;
                                                                    colorClass = "text-dark-900 dark:text-dark-50";
                                                                } else if (
                                                                    platformLower.includes("behance") ||
                                                                    platformLower.includes("behacne") ||
                                                                    platformLower.includes("behcane")
                                                                ) {
                                                                    Icon = SiBehance;
                                                                    colorClass = "text-blue-500";
                                                                } else if (
                                                                    platformLower.includes("website") ||
                                                                    platformLower.includes("web") ||
                                                                    platformLower.includes("site")
                                                                ) {
                                                                    Icon = Globe;
                                                                    colorClass = "text-light-500 dark:text-dark-300";
                                                                }
                                                                return (
                                                                    <a
                                                                        key={linkIdx}
                                                                        href={normalizeUrl(link.url)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-light-200 bg-white shadow-sm transition-opacity hover:opacity-70 dark:border-dark-700 dark:bg-dark-900 ${colorClass}`}
                                                                        title={`${link.platform}: ${link.url}`}
                                                                    >
                                                                        <Icon size={18} />
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Website */}
                                                    {competitor.website && (
                                                        <a
                                                            href={normalizeUrl(competitor.website)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-light-500 mt-2 block text-xs break-words hover:underline"
                                                        >
                                                            {competitor.website}
                                                        </a>
                                                    )}

                                                    {/* Expanded details: SWOT + timestamps */}
                                                    {expandedCompetitorId === (competitor._id || `idx-${idx}`) && (
                                                        <div className="mt-3 rounded-xl border border-light-200 bg-white/80 p-3 text-sm dark:border-dark-700 dark:bg-dark-900/60">
                                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                                <div>
                                                                    <h5 className="text-light-900 dark:text-dark-50 font-medium">SWOT</h5>
                                                                    <div className="mt-2 space-y-2">
                                                                        <div>
                                                                            <strong className="text-dark-500 dark:text-dark-400 text-xs">
                                                                                Strengths:
                                                                            </strong>
                                                                            <div className="text-light-600 dark:text-dark-300">
                                                                                {(competitor.swot_strengths || []).join(", ") || "N/A"}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <strong className="text-dark-500 dark:text-dark-400 text-xs">
                                                                                Weaknesses:
                                                                            </strong>
                                                                            <div className="text-light-600 dark:text-dark-300">
                                                                                {(competitor.swot_weaknesses || []).join(", ") || "N/A"}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <strong className="text-dark-500 dark:text-dark-400 text-xs">
                                                                                Opportunities:
                                                                            </strong>
                                                                            <div className="text-light-600 dark:text-dark-300">
                                                                                {(competitor.swot_opportunities || []).join(", ") || "N/A"}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <strong className="text-dark-500 dark:text-dark-400 text-xs">
                                                                                Threats:
                                                                            </strong>
                                                                            <div className="text-light-600 dark:text-dark-300">
                                                                                {(competitor.swot_threats || []).join(", ") || "N/A"}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-light-600 dark:text-dark-300 mt-2 space-y-2 text-xs">
                                                                        <div>
                                                                           
                                                                           
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-dark-500 text-sm">{t("no_competitors_tracked") || "No competitors tracked"}</p>
                            )}
                            {editing && (
                                <div className="mt-2">
                                    <button
                                        className={buttonAddClass}
                                        onClick={() => {
                                            setDraft((prev: Partial<Client> | null) => {
                                                const next = JSON.parse(JSON.stringify(prev || {})) as Record<string, any>;
                                                next.competitors = next.competitors || [];
                                                next.competitors.push({
                                                    name: "",
                                                    description: "",
                                                    socialLinks: [],
                                                });
                                                return next;
                                            });
                                        }}
                                    >
                                        {t("add_competitor") || "Add competitor"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Social Media */}
                        <div className={surfaceClass}>
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="card-title">{t("social_media") || "Social Media"}</h3>
                                    <p className="text-light-500 dark:text-dark-400 mt-1 text-xs">
                                        {tx("social_presence", "Business social presence and profile links.")}
                                    </p>
                                </div>
                                <span className="rounded-full border border-light-200 bg-light-50 px-3 py-1 text-xs font-black tracking-wide text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {socialLinksCount} {t("links") || "Links"}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {(editing ? draft?.socialLinks?.business || [] : client.socialLinks?.business || []).map((link, idx) => {
                                    const platformLower = (link.platform || "").toLowerCase().trim();
                                    let Icon: any = Globe;
                                    let colorClass = "text-light-500 dark:text-dark-300";
                                    if (platformLower.includes("facebook")) {
                                        Icon = SiFacebook;
                                        colorClass = "text-blue-600";
                                    } else if (platformLower.includes("instagram")) {
                                        Icon = SiInstagram;
                                        colorClass = "text-pink-600";
                                    } else if (platformLower.includes("tiktok")) {
                                        Icon = SiTiktok;
                                        colorClass = "text-light-900 dark:text-white";
                                    } else if (platformLower.includes("x") || platformLower.includes("twitter")) {
                                        Icon = SiX;
                                        colorClass = "text-light-900 dark:text-white";
                                    } else if (
                                        platformLower.includes("behance") ||
                                        platformLower.includes("behacne") ||
                                        platformLower.includes("behcane")
                                    ) {
                                        Icon = SiBehance;
                                        colorClass = "text-blue-500";
                                    } else if (
                                        platformLower.includes("website") ||
                                        platformLower.includes("web") ||
                                        platformLower.includes("site")
                                    ) {
                                        Icon = Globe;
                                        colorClass = "text-light-500 dark:text-dark-300";
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 rounded-xl border border-light-200 bg-white/80 p-2.5 shadow-sm dark:border-dark-700 dark:bg-dark-800/60"
                                        >
                                            {editing ? (
                                                <>
                                                    <input
                                                        className={inputBaseClass}
                                                        value={link.platform || ""}
                                                        placeholder={t("platform_label") || "Platform"}
                                                        onChange={(e) => updateDraft(`socialLinks.business.${idx}.platform`, e.target.value)}
                                                    />
                                                    {(() => {
                                                        const val = link.url || "";
                                                        const invalid = val !== "" && !validators.isValidURL(val, { allowProtocolLess: true });
                                                        return (
                                                            <div className="flex-1">
                                                                <input
                                                                    className={`${inputBaseClass} ${makeInvalidClass(invalid)}`}
                                                                    value={val}
                                                                    placeholder={t("url_label") || "URL"}
                                                                    onChange={(e) => updateDraft(`socialLinks.business.${idx}.url`, e.target.value)}
                                                                />
                                                                {invalid && (
                                                                    <div className="mt-1 text-xs text-red-600">
                                                                        {t("invalid_url") || "Invalid URL"}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                    <button
                                                        className={buttonGhostClass}
                                                        onClick={() => {
                                                            setDraft((prev: Partial<Client> | null) => {
                                                                const next = JSON.parse(JSON.stringify(prev || {})) as Record<string, any>;
                                                                next.socialLinks = next.socialLinks || {};
                                                                next.socialLinks.business = next.socialLinks.business || [];
                                                                next.socialLinks.business.splice(idx, 1);
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        {t("remove") || "Remove"}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-light-200 bg-white dark:border-dark-700 dark:bg-dark-900">
                                                        <Icon className={`${colorClass} h-5 w-5`} />
                                                    </span>
                                                    <a
                                                        href={normalizeUrl(link.url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
                                                    >
                                                        {link.platform}
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                                {editing && (
                                    <button
                                        className={buttonAddClass}
                                        onClick={() => {
                                            setDraft((prev: Partial<Client> | null) => {
                                                const next = JSON.parse(JSON.stringify(prev || {})) as Record<string, any>;
                                                if (!next.socialLinks) next.socialLinks = {};
                                                if (!next.socialLinks.business) next.socialLinks.business = [];
                                                next.socialLinks.business.push({
                                                    platform: "",
                                                    url: "",
                                                });
                                                return next;
                                            });
                                        }}
                                    >
                                        {t("add_link") || "Add link"}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Market Segments */}
                        <div className={surfaceClass}>
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="card-title flex items-center gap-2">
                                        <Target size={18} />
                                        {t("target_segments") || "Market Segments"}
                                    </h3>
                                    <p className="text-light-500 dark:text-dark-400 mt-1 text-xs">
                                        {tx("segment_insights", "Audience profiles grouped by behavior and demographics.")}
                                    </p>
                                </div>
                                <span className="rounded-full border border-light-200 bg-light-50 px-3 py-1 text-xs font-black tracking-wide text-light-600 dark:border-dark-700 dark:bg-dark-800 dark:text-dark-300">
                                    {sectionsCount} {t("segments_label") || "Segments"}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {(editing ? draft?.segments || [] : client.segments || []).map((segment, idx) => (
                                    <div
                                        key={segment._id || idx}
                                        className="rounded-2xl border border-light-200 bg-white/80 p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:border-dark-700 dark:bg-dark-800/60"
                                    >
                                        {editing ? (
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                        {t("segment_name") || "Segment Name"} *
                                                    </label>
                                                    <input
                                                        className={inputBaseClass}
                                                        value={segment.name || ""}
                                                        placeholder={t("segment_name_placeholder") || "e.g., Young Professionals"}
                                                        onChange={(e) => updateDraft(`segments.${idx}.name`, e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                        {t("description") || "Description"}
                                                    </label>
                                                    <textarea
                                                        className={`${inputBaseClass} min-h-[60px]`}
                                                        value={segment.description || ""}
                                                        placeholder={t("segment_description_placeholder") || "Describe this market segment..."}
                                                        onChange={(e) => updateDraft(`segments.${idx}.description`, e.target.value)}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div>
                                                        <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                            {t("age_range") || "Age Range"}
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                className={inputBaseClass}
                                                                value={(segmentInputs[idx] && segmentInputs[idx].age) || ""}
                                                                placeholder={t("age_range_placeholder") || "e.g., 25-35"}
                                                                onChange={(e) => setSegmentInput(idx, "age", e.target.value.replace(/[^0-9-]/g, ""))}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        addSegmentChip(idx, "ageRange");
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className={buttonAddClass}
                                                                onClick={() => addSegmentChip(idx, "ageRange")}
                                                            >
                                                                <Plus size={14} />
                                                                {t("add")}
                                                            </button>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {(Array.isArray(segment.ageRange) ? segment.ageRange : []).map((a: any, i: number) => (
                                                                <span
                                                                    key={i}
                                                                    className="bg-light-50 dark:bg-dark-700 text-light-900 dark:text-dark-50 border-light-200 dark:border-dark-700 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                                                                >
                                                                    <span>{a}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeSegmentChip(idx, "ageRange", i)}
                                                                        className="text-danger-600"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                            {t("gender") || "Gender"}
                                                        </label>
                                                        <select
                                                            className={inputBaseClass}
                                                            value={
                                                                Array.isArray(segment.gender) ? segment.gender[0] || "all" : segment.gender || "all"
                                                            }
                                                            onChange={(e) => updateDraft(`segments.${idx}.gender`, [e.target.value])}
                                                        >
                                                            <option value="all">{t("all_genders") || "All"}</option>
                                                            <option value="male">{t("male") || "Male"}</option>
                                                            <option value="female">{t("female") || "Female"}</option>
                                                            <option value="other">{t("other") || "Other"}</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                            {t("area") || "Area"}
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                className={inputBaseClass}
                                                                value={(segmentInputs[idx] && segmentInputs[idx].area) || ""}
                                                                placeholder={t("area_placeholder") || "e.g., Nasr City, Maadi"}
                                                                onChange={(e) => setSegmentInput(idx, "area", e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        addSegmentChip(idx, "area");
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className={buttonAddClass}
                                                                onClick={() => addSegmentChip(idx, "area")}
                                                            >
                                                                {" "}
                                                                <Plus size={14} /> {t("add")}{" "}
                                                            </button>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {(Array.isArray(segment.area) ? segment.area : []).map((a: any, i: number) => (
                                                                <span
                                                                    key={i}
                                                                    className="bg-light-50 dark:bg-dark-700 text-light-900 dark:text-dark-50 border-light-200 dark:border-dark-700 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                                                                >
                                                                    <span>{a}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeSegmentChip(idx, "area", i)}
                                                                        className="text-danger-600"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                            {t("governorate") || "Governorate"}
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                className={inputBaseClass}
                                                                value={(segmentInputs[idx] && segmentInputs[idx].governorate) || ""}
                                                                placeholder={t("governorate_placeholder") || "e.g., Cairo, Giza"}
                                                                onChange={(e) => setSegmentInput(idx, "governorate", e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        addSegmentChip(idx, "governorate");
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className={buttonAddClass}
                                                                onClick={() => addSegmentChip(idx, "governorate")}
                                                            >
                                                                {" "}
                                                                <Plus size={14} /> {t("add")}{" "}
                                                            </button>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {(Array.isArray(segment.governorate) ? segment.governorate : []).map(
                                                                (a: any, i: number) => (
                                                                    <span
                                                                        key={i}
                                                                        className="bg-light-50 dark:bg-dark-700 text-light-900 dark:text-dark-50 border-light-200 dark:border-dark-700 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                                                                    >
                                                                        <span>{a}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeSegmentChip(idx, "governorate", i)}
                                                                            className="text-danger-600"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </span>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                            {t("product_name") || "Product Name"}
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                className={inputBaseClass}
                                                                value={(segmentInputs[idx] && segmentInputs[idx].productName) || ""}
                                                                placeholder={t("product_name_placeholder") || "Product or service name"}
                                                                onChange={(e) => setSegmentInput(idx, "productName", e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        addSegmentChip(idx, "productName");
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className={buttonAddClass}
                                                                onClick={() => addSegmentChip(idx, "productName")}
                                                            >
                                                                {" "}
                                                                <Plus size={14} /> {t("add")}{" "}
                                                            </button>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {((segment as any).productName || []).map((p: any, i: number) => (
                                                                <span
                                                                    key={i}
                                                                    className="bg-light-50 dark:bg-dark-700 text-light-900 dark:text-dark-50 border-light-200 dark:border-dark-700 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                                                                >
                                                                    <span>{p}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeSegmentChip(idx, "productName", i)}
                                                                        className="text-danger-600"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                            {t("population") || "Population"}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            className={inputBaseClass}
                                                            value={
                                                                Array.isArray((segment as any).population)
                                                                    ? ((segment as any).population[0] ?? "")
                                                                    : ((segment as any).population ?? "")
                                                            }
                                                            placeholder={t("population_placeholder") || "e.g., 10000"}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                const num = v === "" ? NaN : Number(v);
                                                                const nextVal = Number.isNaN(num) ? undefined : num;
                                                                updateDraft(`segments.${idx}.population`, nextVal);
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-light-700 dark:text-dark-300 mb-1 block text-sm font-medium">
                                                            {t("note") || "Note"}
                                                        </label>
                                                        <textarea
                                                            className={`${inputBaseClass} min-h-[60px]`}
                                                            value={(segment as any).note || ""}
                                                            placeholder={t("note_placeholder") || "Additional notes..."}
                                                            onChange={(e) => updateDraft(`segments.${idx}.note`, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    className={`${buttonGhostClass} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20`}
                                                    onClick={() => {
                                                        setDraft((prev: Partial<Client> | null) => {
                                                            const next = JSON.parse(JSON.stringify(prev || {})) as Record<string, any>;
                                                            next.segments = next.segments || [];
                                                            next.segments.splice(idx, 1);
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    {t("remove_segment") || "Remove Segment"}
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <h4 className="text-light-900 dark:text-dark-50 font-semibold">{segment.name}</h4>
                                                    <span className="rounded-full border border-light-200 bg-light-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-light-600 dark:border-dark-700 dark:bg-dark-900 dark:text-dark-300">
                                                        {t("segment") || "Segment"}
                                                    </span>
                                                </div>
                                                {segment.description && (
                                                    <p className="text-light-600 dark:text-dark-400 mb-3 text-sm">{segment.description}</p>
                                                )}
                                                <div className="flex flex-wrap gap-2">
                                                    {segment.ageRange && (
                                                        <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-700 dark:border-dark-700 dark:bg-dark-700 dark:text-dark-300">
                                                            Age: {Array.isArray(segment.ageRange) ? segment.ageRange.join(", ") : segment.ageRange}
                                                        </span>
                                                    )}
                                                    {segment.gender &&
                                                        (Array.isArray(segment.gender)
                                                            ? !segment.gender.includes("all") && (
                                                                  <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-700 dark:border-dark-700 dark:bg-dark-700 dark:text-dark-300">
                                                                      {segment.gender
                                                                          .map((g: string) => g.charAt(0).toUpperCase() + g.slice(1))
                                                                          .join(", ")}
                                                                  </span>
                                                              )
                                                            : segment.gender !== "all" && (
                                                                  <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-700 dark:border-dark-700 dark:bg-dark-700 dark:text-dark-300">
                                                                      {typeof segment.gender === "string"
                                                                          ? (segment.gender as string).charAt(0).toUpperCase() +
                                                                            (segment.gender as string).slice(1)
                                                                          : ""}
                                                                  </span>
                                                              ))}
                                                    {(segment as any).area && (segment as any).area.length > 0 && (
                                                        <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-700 dark:border-dark-700 dark:bg-dark-700 dark:text-dark-300">
                                                            Area:{" "}
                                                            {Array.isArray((segment as any).area)
                                                                ? (segment as any).area.join(", ")
                                                                : (segment as any).area}
                                                        </span>
                                                    )}
                                                    {(segment as any).governorate && (segment as any).governorate.length > 0 && (
                                                        <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-700 dark:border-dark-700 dark:bg-dark-700 dark:text-dark-300">
                                                            Gov:{" "}
                                                            {Array.isArray((segment as any).governorate)
                                                                ? (segment as any).governorate.join(", ")
                                                                : (segment as any).governorate}
                                                        </span>
                                                    )}
                                                    {(segment as any).productName && (
                                                        <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-700 dark:border-dark-700 dark:bg-dark-700 dark:text-dark-300">
                                                            {Array.isArray((segment as any).productName)
                                                                ? (segment as any).productName.join(", ")
                                                                : (segment as any).productName}
                                                        </span>
                                                    )}
                                                    {(segment as any).population !== undefined &&
                                                        (Array.isArray((segment as any).population)
                                                            ? (segment as any).population.length > 0
                                                            : true) && (
                                                            <span className="rounded-full border border-light-200 bg-light-50 px-2.5 py-1 text-xs text-light-700 dark:border-dark-700 dark:bg-dark-700 dark:text-dark-300">
                                                                Population:{" "}
                                                                {Array.isArray((segment as any).population)
                                                                    ? (segment as any).population.join(", ")
                                                                    : (segment as any).population}
                                                            </span>
                                                        )}
                                                </div>
                                                {(segment as any).note && (
                                                    <p className="text-light-600 dark:text-dark-400 mt-2 text-sm">{(segment as any).note}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(editing ? draft?.segments || [] : client.segments || []).length === 0 && !editing && (
                                    <div className="text-light-600 dark:text-dark-400 text-sm">
                                        {t("no_segments") || "No market segments defined yet."}
                                    </div>
                                )}
                                {editing && (
                                    <button
                                        className={buttonAddClass}
                                        onClick={() => {
                                            setDraft((prev: Partial<Client> | null) => {
                                                const next = JSON.parse(JSON.stringify(prev || {})) as Record<string, any>;
                                                next.segments = next.segments || [];
                                                next.segments.push({
                                                    name: "",
                                                    description: "",
                                                    ageRange: [],
                                                    gender: "all",
                                                    area: [],
                                                    governorate: [],
                                                    productName: [],
                                                    note: "",
                                                });
                                                return next;
                                            });
                                        }}
                                    >
                                        {t("add_segment") || "Add Segment"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="rounded-2xl border border-light-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-dark-800 dark:bg-dark-900/60">
                <div className="flex items-start gap-3">
                    <div className="min-w-0">
                        <p className="text-light-500 dark:text-dark-400 text-[10px] font-black uppercase tracking-wider">
                            {t("business_name_label")}
                        </p>
                        <h3 className="text-light-900 dark:text-dark-50 mt-1 truncate text-2xl font-black tracking-tight">
                            {data.business?.businessName || t("unnamed_business")}
                        </h3>
                        <p className="text-light-600 dark:text-dark-400 mt-1 text-sm">
                            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider opacity-80">
                                {t("business_category_label")}
                            </span>
                            {data.business?.category || t("no_category")}
                        </p>
                    </div>
                </div>

                <div className="mt-4 border-t border-light-200/80 pt-3 text-sm dark:border-dark-700/80">
                    <div className="grid grid-cols-1 gap-2">
                        {data.personal?.fullName && (
                            <div className="text-light-600 dark:text-dark-300 flex items-center gap-2 rounded-lg bg-light-50/80 px-2.5 py-1.5 dark:bg-dark-800/60">
                                <Users size={14} className="text-light-500 dark:text-dark-400" />
                                <span className="truncate">{data.personal?.fullName}</span>
                            </div>
                        )}
                        {data.contact?.businessEmail && (
                            <div className="text-light-600 dark:text-dark-300 flex items-center gap-2 rounded-lg bg-light-50/80 px-2.5 py-1.5 dark:bg-dark-800/60">
                                <Mail size={14} className="text-light-500 dark:text-dark-400" />
                                <span className="truncate">{data.contact?.businessEmail}</span>
                            </div>
                        )}
                        {data.contact?.businessPhone && (
                            <div className="text-light-600 dark:text-dark-300 flex items-center gap-2 rounded-lg bg-light-50/80 px-2.5 py-1.5 dark:bg-dark-800/60">
                                <Phone size={14} className="text-light-500 dark:text-dark-400" />
                                <span>{data.contact?.businessPhone}</span>
                            </div>
                        )}
                        {data.branches && data.branches.length > 0 && (
                            <div className="text-light-600 dark:text-dark-300 flex items-center gap-2 rounded-lg bg-light-50/80 px-2.5 py-1.5 dark:bg-dark-800/60">
                                <MapPin size={14} className="text-light-500 dark:text-dark-400" />
                                <span>
                                    {data.branches?.length} {data.branches?.length === 1 ? t("branches_singular") : t("branches_plural")}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className={surfaceClass}>
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="card-title">{t("client_overview")}</h3>
                        <p className="text-light-500 dark:text-dark-400 mt-1 text-xs">
                            {tx("business_snapshot", "Business profile summary and account metadata.")}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 [&>div]:rounded-xl [&>div]:border [&>div]:border-light-200 [&>div]:bg-white/80 [&>div]:p-3 [&>div]:shadow-sm dark:[&>div]:border-dark-700 dark:[&>div]:bg-dark-800/60">
                    <div>
                        <span className="text-dark-500 dark:text-dark-400">{t("business_name_label")}</span>
                        {editing ? (
                            <input
                                className={`${inputBaseClass} font-medium`}
                                value={data.business?.businessName || ""}
                                onChange={(e) => updateDraft("business.businessName", e.target.value)}
                            />
                        ) : (
                            <p className="text-light-900 dark:text-dark-50 font-medium break-words">{data.business?.businessName || "N/A"}</p>
                        )}
                    </div>
                    <div>
                        <span className="text-dark-500 dark:text-dark-400">{t("business_category_label")}</span>
                        {editing ? (
                            <input
                                className={inputBaseClass}
                                value={data.business?.category || ""}
                                onChange={(e) => updateDraft("business.category", e.target.value)}
                            />
                        ) : (
                            <p className="text-light-900 dark:text-dark-50">{data.business?.category || "N/A"}</p>
                        )}
                    </div>
                    <div>
                        <span className="text-dark-500 dark:text-dark-400">{t("established_label")}</span>
                        {editing ? (
                            <input
                                className={inputBaseClass}
                                value={data.business?.establishedYear || ""}
                                onChange={(e) => updateDraft("business.establishedYear", e.target.value)}
                            />
                        ) : (
                            <p className="text-light-900 dark:text-dark-50">{data.business?.establishedYear || "N/A"}</p>
                        )}
                    </div>
                    <div>
                        <span className="text-dark-500 dark:text-dark-400">{t("main_office_label")}</span>
                        {editing ? (
                            <input
                                className={inputBaseClass}
                                value={data.business?.mainOfficeAddress || ""}
                                onChange={(e) => updateDraft("business.mainOfficeAddress", e.target.value)}
                            />
                        ) : (
                            <p className="text-light-900 dark:text-dark-50 break-words">{data.business?.mainOfficeAddress || "N/A"}</p>
                        )}
                    </div>
                    <div className="sm:col-span-2">
                        <span className="text-dark-500 dark:text-dark-400">{t("description")}</span>
                        {editing ? (
                            <textarea
                                className={`${inputBaseClass} min-h-[80px]`}
                                value={data.business?.description || ""}
                                onChange={(e) => updateDraft("business.description", e.target.value)}
                            />
                        ) : (
                            <p className="text-light-900 dark:text-dark-50 break-words">{data.business?.description || "N/A"}</p>
                        )}
                    </div>
                    <div>
                        <span className="text-dark-500 dark:text-dark-400">{t("status")}</span>
                        {editing ? (
                            <select
                                className={inputBaseClass}
                                value={data.status || "active"}
                                onChange={(e) => updateDraft("status", e.target.value)}
                            >
                                <option value="active">{t("status_active") || "Active"}</option>
                                <option value="inactive">{t("status_inactive") || "Inactive"}</option>
                                <option value="pending">{t("status_pending") || "Pending"}</option>
                            </select>
                        ) : (
                            <p className="text-light-900 dark:text-dark-50">{data.status || "N/A"}</p>
                        )}
                    </div>
                    {(data.createdAt || data.updatedAt) && (
                        <>
                            {data.createdAt && (
                                <div>
                                    <span className="text-dark-500 dark:text-dark-400">{t("created_at") || "Created"}</span>
                                    <p className="text-light-900 dark:text-dark-50">{new Date(data.createdAt).toLocaleDateString()}</p>
                                </div>
                            )}
                            {data.updatedAt && (
                                <div>
                                    <span className="text-dark-500 dark:text-dark-400">{t("updated_at") || "Last Updated"}</span>
                                    <p className="text-light-900 dark:text-dark-50">{new Date(data.updatedAt).toLocaleDateString()}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className={surfaceClass}>
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="card-title">{t("contact_information")}</h3>
                        <p className="text-light-500 dark:text-dark-400 mt-1 text-xs">
                            {tx("contact_channels", "Primary communication channels and branch contacts.")}
                        </p>
                    </div>
                </div>
                <div className="space-y-5">
                    <div className="space-y-2">
                        <h4 className="text-dark-700 dark:text-dark-50 text-sm font-semibold">{t("contact_person")}</h4>
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 [&>div]:rounded-xl [&>div]:border [&>div]:border-light-200 [&>div]:bg-white/80 [&>div]:p-3 [&>div]:shadow-sm dark:[&>div]:border-dark-700 dark:[&>div]:bg-dark-800/60">
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("name_label")}</span>
                                {editing ? (
                                    <input
                                        className={`${inputBaseClass} font-medium`}
                                        value={data.personal?.fullName || ""}
                                        onChange={(e) => updateDraft("personal.fullName", e.target.value)}
                                    />
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50 font-medium break-words">{data.personal?.fullName || "N/A"}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("position_label")}</span>
                                {editing ? (
                                    <input
                                        className={inputBaseClass}
                                        value={data.personal?.position || ""}
                                        onChange={(e) => updateDraft("personal.position", e.target.value)}
                                    />
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50">{data.personal?.position || "N/A"}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("email_label")}</span>
                                {editing ? (
                                    (() => {
                                        const val = data.personal?.email || "";
                                        const invalid = val !== "" && !validators.isValidEmail(val);
                                        return (
                                            <div>
                                                <input
                                                    className={`${inputBaseClass} ${makeInvalidClass(invalid)}`}
                                                    value={val}
                                                    onChange={(e) => updateDraft("personal.email", e.target.value)}
                                                />
                                                {invalid && <div className="mt-1 text-xs text-red-600">{t("invalid_email") || "Invalid email"}</div>}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50 break-words">{data.personal?.email || "N/A"}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("phone_label")}</span>
                                {editing ? (
                                    (() => {
                                        const val = data.personal?.phone || "";
                                        const invalid = val !== "" && !validators.isValidEgyptianMobile(val);
                                        return (
                                            <div>
                                                <input
                                                    className={`${inputBaseClass} ${makeInvalidClass(invalid)}`}
                                                    value={val}
                                                    onChange={(e) => updateDraft("personal.phone", e.target.value)}
                                                />
                                                {invalid && <div className="mt-1 text-xs text-red-600">{t("invalid_phone") || "Invalid phone"}</div>}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50">{data.personal?.phone || "N/A"}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-dark-200 dark:border-dark-700 space-y-2 border-t pt-3">
                        <h4 className="text-dark-700 dark:text-dark-50 text-sm font-semibold">{t("business_contact")}</h4>
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 [&>div]:rounded-xl [&>div]:border [&>div]:border-light-200 [&>div]:bg-white/80 [&>div]:p-3 [&>div]:shadow-sm dark:[&>div]:border-dark-700 dark:[&>div]:bg-dark-800/60">
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("email_label")}</span>
                                {editing ? (
                                    (() => {
                                        const val = data.contact?.businessEmail || "";
                                        const invalid = val !== "" && !validators.isValidEmail(val);
                                        return (
                                            <div>
                                                <input
                                                    className={`${inputBaseClass} ${makeInvalidClass(invalid)}`}
                                                    value={val}
                                                    onChange={(e) => updateDraft("contact.businessEmail", e.target.value)}
                                                />
                                                {invalid && <div className="mt-1 text-xs text-red-600">{t("invalid_email") || "Invalid email"}</div>}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50 break-words">{data.contact?.businessEmail || "N/A"}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("phone_label")}</span>
                                {editing ? (
                                    (() => {
                                        const val = data.contact?.businessPhone || "";
                                        const invalid = val !== "" && !validators.isValidEgyptianMobile(val);
                                        return (
                                            <div>
                                                <input
                                                    className={`${inputBaseClass} ${makeInvalidClass(invalid)}`}
                                                    value={val}
                                                    onChange={(e) => updateDraft("contact.businessPhone", e.target.value)}
                                                />
                                                {invalid && <div className="mt-1 text-xs text-red-600">{t("invalid_phone") || "Invalid phone"}</div>}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50">{data.contact?.businessPhone || "N/A"}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("whatsapp_label")}</span>
                                {editing ? (
                                    (() => {
                                        const val = data.contact?.businessWhatsApp || "";
                                        const invalid = val !== "" && !validators.isValidEgyptianMobile(val);
                                        return (
                                            <div>
                                                <input
                                                    className={`${inputBaseClass} ${makeInvalidClass(invalid)}`}
                                                    value={val}
                                                    onChange={(e) => updateDraft("contact.businessWhatsApp", e.target.value)}
                                                />
                                                {invalid && <div className="mt-1 text-xs text-red-600">{t("invalid_phone") || "Invalid phone"}</div>}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50 break-words">{data.contact?.businessWhatsApp || "N/A"}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-dark-500 dark:text-dark-400">{t("website_label")}</span>
                                {editing ? (
                                    (() => {
                                        const val = data.contact?.website || "";
                                        const invalid = val !== "" && !validators.isValidURL(val, { allowProtocolLess: true });
                                        return (
                                            <div>
                                                <input
                                                    className={`${inputBaseClass} text-primary-500 max-w-full break-words ${makeInvalidClass(invalid)}`}
                                                    value={val}
                                                    onChange={(e) => updateDraft("contact.website", e.target.value)}
                                                />
                                                {invalid && <div className="mt-1 text-xs text-red-600">{t("invalid_url") || "Invalid URL"}</div>}
                                            </div>
                                        );
                                    })()
                                ) : data.contact?.website ? (
                                    <a
                                        href={normalizeUrl(data.contact.website)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-dark-300 max-w-full break-words hover:underline"
                                    >
                                        {data.contact.website}
                                    </a>
                                ) : (
                                    <p className="text-light-900 dark:text-dark-50">N/A</p>
                                )}
                            </div>
                            {/* Branches overview + editing */}
                            {(editing || (data.branches && data.branches.length > 0)) && (
                                <div className="sm:col-span-2">
                                    <span className="text-dark-500 dark:text-dark-400">{t("branches")}</span>
                                    {editing ? (
                                        <div className="mt-2 space-y-3">
                                            {(data.branches || []).map((branch: any, idx: number) => (
                                                <div
                                                    key={branch._id || idx}
                                                    className="space-y-2"
                                                >
                                                    <input
                                                        className={inputBaseClass}
                                                        value={branch.name || ""}
                                                        placeholder={t("branch_name")}
                                                        onChange={(e) => updateDraft(`branches.${idx}.name`, e.target.value)}
                                                    />
                                                    <input
                                                        className={inputBaseClass}
                                                        value={branch.city || ""}
                                                        placeholder={t("city")}
                                                        onChange={(e) => updateDraft(`branches.${idx}.city`, e.target.value)}
                                                    />
                                                    <input
                                                        className={inputBaseClass}
                                                        value={branch.address || ""}
                                                        placeholder={t("branch_address")}
                                                        onChange={(e) => updateDraft(`branches.${idx}.address`, e.target.value)}
                                                    />
                                                    <input
                                                        className={inputBaseClass}
                                                        value={branch.phone || ""}
                                                        placeholder={t("phone_number")}
                                                        onChange={(e) => updateDraft(`branches.${idx}.phone`, e.target.value)}
                                                    />
                                                    <button
                                                        className="text-danger-500 hover:text-danger-600"
                                                        onClick={() => {
                                                            if (!editing || !setDraft) return;
                                                            setDraft((prev) => {
                                                                const next = JSON.parse(JSON.stringify(prev || {})) as any;
                                                                next.branches = next.branches || [];
                                                                next.branches.splice(idx, 1);
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        {t("remove")}
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                className="btn-ghost"
                                                onClick={() => {
                                                    if (!editing || !setDraft) return;
                                                    setDraft((prev) => {
                                                        const next = JSON.parse(JSON.stringify(prev || {})) as any;
                                                        next.branches = next.branches || [];
                                                        next.branches.push({ name: "", city: "", address: "", phone: "" });
                                                        return next;
                                                    });
                                                }}
                                            >
                                                {t("add_branch")}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mt-2 space-y-2">
                                            {(data.branches || []).map((b: any, i: number) => (
                                                <div
                                                    key={b._id || i}
                                                    className="text-sm"
                                                >
                                                    <strong className="text-light-600 dark:text-dark-500">{b.name}</strong>
                                                    {b.city && <div className="text-light-600 dark:text-dark-200">{b.city}</div>}
                                                    {b.address && <div className="text-light-600 dark:text-dark-200">{b.address}</div>}
                                                    {b.phone && <div className="text-light-600 dark:text-dark-200">{b.phone}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Objectives overview (per-client) */}
            <div className={surfaceClass}>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="card-title mb-1">{t("objectives_overview") || t("campaign_objective") || "Objectives"}</h3>
                        <p className="text-light-500 dark:text-dark-400 text-xs">
                            {tx("goals_summary", "Business goals and campaign intent in both languages.")}
                        </p>
                    </div>
                    {editing ? (
                        <button
                            type="button"
                            onClick={openObjectivesPlanner}
                            className="btn-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {t("add_objective") || "Add objective"}
                        </button>
                    ) : null}
                    {draftDate ? (
                        <div className="text-light-600 dark:text-dark-400 ml-4 text-right text-sm">
                            {t("created_on") || "Created:"} {(draftDate as Date).toLocaleString()}
                        </div>
                    ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {clientObjectives && clientObjectives.length > 0 ? (
                        clientObjectives.map((obj) => (
                            <div
                                key={obj.id}
                                className="rounded-xl border border-light-200 bg-white/80 p-3 shadow-sm transition-all hover:shadow-md dark:border-dark-700 dark:bg-dark-800/70"
                            >
                                <div className="text-light-900 dark:text-dark-50 mb-2 text-sm">
                                    <strong className="text-light-600 dark:text-dark-400 mr-1 text-xs">EN:</strong>
                                    {obj.en || obj.ar}
                                </div>
                                <div className="text-light-900 dark:text-dark-50 text-sm">
                                    <strong className="text-light-600 dark:text-dark-400 mr-1 text-xs">AR:</strong>
                                    {obj.ar || obj.en}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-light-600 dark:text-dark-400 col-span-full rounded-xl border border-dashed border-light-300 bg-white/70 px-4 py-3 text-sm dark:border-dark-700 dark:bg-dark-900/60">
                            {t("no_objectives") || "No objectives added yet."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientInfo;
