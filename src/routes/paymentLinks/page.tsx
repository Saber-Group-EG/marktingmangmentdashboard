import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Copy, ExternalLink, Ban, X, Link2, MessageCircle, Mail, Check, ShieldAlert, CreditCard, Smartphone } from "lucide-react";
import copy from "copy-to-clipboard";
import { useLang } from "@/hooks/useLang";
import { showConfirm, showToast } from "@/utils/swal";
import { useClients } from "@/hooks/queries";
import { usePaymentLinks, usePaymentMethods, useCreatePaymentLink, useCancelPaymentLink } from "@/hooks/queries/usePaymentLinksQuery";
import type { PaymentLink, PaymentLinkStatus, PaymentMethod } from "@/api/requests/paymentLinksService";
import { countryCodes, DEFAULT_COUNTRY_ISO, splitPhone, toE164 } from "@/constants/countryCodes";

const DEFAULT_EXPIRY_DAYS = 7;

const getStoredRole = (): string | null => {
    try {
        return JSON.parse(localStorage.getItem("auth-user") || "null")?.role ?? null;
    } catch {
        return null;
    }
};

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
const toLocalInputValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultExpiry = () => toLocalInputValue(new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000));

const formatMoney = (cents: number, currency = "EGP") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

// WhatsApp wants digits only, with country code (Egyptian local numbers start with 0)
const toWhatsAppNumber = (phone?: string) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    return digits.startsWith("0") ? `2${digits}` : digits;
};

const statusStyles: Record<PaymentLinkStatus, string> = {
    active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    cancelled: "bg-light-200 text-light-700 dark:bg-dark-700 dark:text-dark-300",
    expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

type StatusFilter = "all" | PaymentLinkStatus;

const methodIcons: Record<PaymentMethod, typeof CreditCard> = {
    card: CreditCard,
    wallet: Smartphone,
};

const PaymentLinksPage = () => {
    const { t, lang } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    const isAdmin = getStoredRole() === "admin";

    const [clientId, setClientId] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY_ISO);
    const [phoneLocal, setPhoneLocal] = useState("");
    // null = not touched yet, so every configured method is offered by default
    const [selectedMethods, setSelectedMethods] = useState<PaymentMethod[] | null>(null);
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [expiresAt, setExpiresAt] = useState(defaultExpiry);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [createdLink, setCreatedLink] = useState<PaymentLink | null>(null);

    const { data: links, isLoading } = usePaymentLinks();
    const { data: clients } = useClients({ enabled: isAdmin });
    const { data: availableMethods, isLoading: methodsLoading } = usePaymentMethods();
    const methods = selectedMethods ?? availableMethods ?? [];
    const createMutation = useCreatePaymentLink();
    const cancelMutation = useCancelPaymentLink();

    useEffect(() => {
        if (!createdLink) return;
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") setCreatedLink(null);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [createdLink]);

    const allLinks = links || [];
    const allClients = (clients || []) as any[];

    const clientNameById = useMemo(() => {
        const map: Record<string, string> = {};
        allClients.forEach((c) => {
            map[c._id || c.id] = c.business?.name || c.personal?.fullName || "";
        });
        return map;
    }, [allClients]);

    const stats = useMemo(() => {
        const paid = allLinks.filter((l) => l.status === "paid");
        return {
            active: allLinks.filter((l) => l.status === "active").length,
            paidCount: paid.length,
            collectedCents: paid.reduce((sum, l) => sum + l.amountCents, 0),
            currency: allLinks[0]?.currency || "EGP",
        };
    }, [allLinks]);

    const visibleLinks = statusFilter === "all" ? allLinks : allLinks.filter((l) => l.status === statusFilter);

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
                <ShieldAlert className="text-light-500 dark:text-dark-400 h-10 w-10" />
                <h1 className="title text-xl">{tr("payment_links_admin_only", "Only admins can manage payment links.")}</h1>
            </div>
        );
    }

    const handleClientChange = (id: string) => {
        setClientId(id);
        const client = allClients.find((c) => (c._id || c.id) === id);
        if (client) {
            const { iso, local } = splitPhone(client.personal?.phone);
            setFullName(client.personal?.fullName || "");
            setEmail(client.personal?.email || "");
            setPhoneCountry(iso);
            setPhoneLocal(local);
        }
    };

    const toggleMethod = (method: PaymentMethod) => {
        const next = methods.includes(method) ? methods.filter((m) => m !== method) : [...methods, method];
        // Keep a stable order (card, wallet) regardless of click order
        setSelectedMethods((availableMethods || []).filter((m) => next.includes(m)));
    };

    const methodLabel = (method: PaymentMethod) =>
        method === "card" ? tr("payment_method_card", "Card") : tr("payment_method_wallet", "Mobile Wallet");

    // Payment method choice is kept between links, like Paymob's "save the methods" option
    const resetForm = () => {
        setClientId("");
        setFullName("");
        setEmail("");
        setPhoneCountry(DEFAULT_COUNTRY_ISO);
        setPhoneLocal("");
        setAmount("");
        setDescription("");
        setExpiresAt(defaultExpiry());
    };

    const handleCreate = () => {
        const numericAmount = Number(amount);
        if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
            setError(tr("payment_link_amount_required", "Enter a valid amount"));
            return;
        }
        if (methods.length === 0) {
            setError(tr("payment_link_method_required", "Choose at least one payment method"));
            return;
        }
        if (expiresAt && new Date(expiresAt) <= new Date()) {
            setError(tr("payment_link_expiry_future", "Expiry must be in the future"));
            return;
        }

        setError("");
        createMutation.mutate(
            {
                amount: Math.round(numericAmount * 100) / 100,
                clientId: clientId || undefined,
                paymentMethods: methods,
                description: description.trim() || undefined,
                customer: {
                    fullName: fullName.trim() || undefined,
                    email: email.trim() || undefined,
                    phone: toE164(phoneCountry, phoneLocal) || undefined,
                },
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
            },
            {
                onSuccess: (link) => {
                    resetForm();
                    setCreatedLink(link);
                },
                onError: (e: any) => {
                    setError(
                        e?.response?.data?.details?.[0]?.message ||
                            e?.response?.data?.message ||
                            tr("payment_link_create_failed", "Failed to create payment link"),
                    );
                },
            },
        );
    };

    const copyLink = (link: PaymentLink) => {
        copy(link.url);
        showToast(tr("link_copied", "Link copied"), "success");
    };

    const shareMessage = (link: PaymentLink) =>
        `${link.customer?.fullName ? `${link.customer.fullName}, ` : ""}${tr("payment_link_share_text", "please complete your payment of")} ${formatMoney(
            link.amountCents,
            link.currency,
        )}${link.description ? ` (${link.description})` : ""}: ${link.url}`;

    const whatsappHref = (link: PaymentLink) =>
        `https://wa.me/${toWhatsAppNumber(link.customer?.phone)}?text=${encodeURIComponent(shareMessage(link))}`;

    const mailHref = (link: PaymentLink) =>
        `mailto:${link.customer?.email || ""}?subject=${encodeURIComponent(tr("payment_link_email_subject", "Payment request"))}&body=${encodeURIComponent(
            shareMessage(link),
        )}`;

    const handleCancel = async (link: PaymentLink) => {
        const confirmed = await showConfirm(
            tr("confirm_cancel_payment_link", "Cancel this payment link? The customer will no longer be able to pay with it."),
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) return;

        try {
            setError("");
            await cancelMutation.mutateAsync(link._id);
            showToast(tr("payment_link_cancelled", "Payment link cancelled"), "success");
        } catch (e: any) {
            setError(e?.response?.data?.message || tr("payment_link_cancel_failed", "Failed to cancel payment link"));
        }
    };

    const filters: { key: StatusFilter; label: string }[] = [
        { key: "all", label: tr("all", "All") },
        { key: "active", label: tr("link_status_active", "Active") },
        { key: "paid", label: tr("link_status_paid", "Paid") },
        { key: "expired", label: tr("link_status_expired", "Expired") },
        { key: "cancelled", label: tr("link_status_cancelled", "Cancelled") },
    ];

    const statusLabel = (status: PaymentLinkStatus) => filters.find((f) => f.key === status)?.label || status;

    const isSaving = createMutation.isPending;

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Paymob
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("Payment Links", "Payment Links")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("payment_links_page_sub", "Create one-time payment links and send them to your customers.")}
                    </p>
                </div>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("awaiting_payment", "Awaiting payment")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{stats.active}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("paid_links", "Paid links")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{stats.paidCount}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_collected", "Total collected")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{formatMoney(stats.collectedCents, stats.currency)}</p>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                    {error}
                </div>
            )}

            {/* Create Form Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-gradient-to-br from-light-50 via-white to-light-100/60 p-5 shadow-sm dark:border-dark-700/70 dark:from-dark-900/60 dark:via-dark-900/30 dark:to-dark-800/60 sm:p-6">
                <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-light-300/40 blur-3xl dark:bg-dark-700/40" />
                <div className="relative mb-5">
                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("create_payment_link", "Create Payment Link")}</h2>
                    <p className="text-sm text-light-600 dark:text-dark-300">
                        {tr(
                            "create_payment_link_sub_optional",
                            "Customer details are optional — leave them empty and the customer fills them in on the payment page.",
                        )}
                    </p>
                </div>

                <div className="relative grid gap-4 lg:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">{tr("client", "Client")}</label>
                        <select
                            value={clientId}
                            onChange={(e) => handleClientChange(e.target.value)}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        >
                            <option value="">{tr("no_client_one_off", "— No client (one-off customer) —")}</option>
                            {allClients.map((c) => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                    {c.business?.name || c.personal?.fullName}
                                    {c.business?.name && c.personal?.fullName ? ` — ${c.personal.fullName}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("amount_egp", "Amount (EGP)")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="0.01"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="1500"
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("payment_methods", "Payment methods")} <span className="text-red-500">*</span>
                        </label>
                        {methodsLoading ? (
                            <Loader2 size={18} className="text-light-500 animate-spin" />
                        ) : (availableMethods || []).length === 0 ? (
                            <p className="text-sm text-danger-500">
                                {tr("no_payment_methods_configured", "No payment methods are configured on the server.")}
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {(availableMethods || []).map((method) => {
                                    const Icon = methodIcons[method];
                                    const checked = methods.includes(method);
                                    return (
                                        <label
                                            key={method}
                                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                                                checked
                                                    ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                                                    : "border-light-300 text-light-700 hover:bg-light-50 dark:border-dark-600 dark:text-dark-300 dark:hover:bg-dark-700"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleMethod(method)}
                                                disabled={isSaving}
                                                className="accent-primary-500"
                                            />
                                            <Icon size={16} />
                                            {methodLabel(method)}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">{tr("full_name", "Full Name")}</label>
                        <input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder={tr("full_name", "Full Name")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">{tr("phone_number", "Phone Number")}</label>
                        <div className="flex gap-2" dir="ltr">
                            <select
                                value={phoneCountry}
                                onChange={(e) => setPhoneCountry(e.target.value)}
                                disabled={isSaving}
                                aria-label={tr("country_code", "Country code")}
                                className="input w-36 shrink-0 disabled:opacity-50"
                            >
                                {countryCodes.map((c) => (
                                    <option key={c.iso} value={c.iso}>
                                        +{c.dial} {lang === "ar" ? c.ar : c.en}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="tel"
                                value={phoneLocal}
                                onChange={(e) => setPhoneLocal(e.target.value)}
                                placeholder={phoneCountry === "EG" ? "1012345678" : ""}
                                disabled={isSaving}
                                className="input min-w-0 flex-1 disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">{tr("email_address", "Email Address")}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="customer@example.com"
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                            dir="ltr"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">{tr("link_expires_at", "Link expires at")}</label>
                        <input
                            type="datetime-local"
                            value={expiresAt}
                            min={toLocalInputValue(new Date())}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">{tr("description", "Description")}</label>
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={500}
                            placeholder={tr("payment_link_description_placeholder", "e.g. Campaign deposit — October")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={handleCreate}
                            disabled={isSaving}
                            className="btn-primary h-[42px] w-full justify-center rounded-xl disabled:opacity-50 lg:w-auto lg:px-8"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            <span>{tr("create_payment_link", "Create Payment Link")}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Links List Section */}
            <div className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-light-900 dark:text-dark-50 text-lg font-semibold">{tr("Payment Links", "Payment Links")}</h2>
                    <div className="flex flex-wrap gap-2">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setStatusFilter(f.key)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    statusFilter === f.key
                                        ? "bg-primary-500 text-white"
                                        : "bg-light-100 text-light-700 hover:bg-light-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-700"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-light-500 h-8 w-8 animate-spin" />
                    </div>
                ) : visibleLinks.length === 0 ? (
                    <p className="text-sm text-light-600 dark:text-dark-300">{tr("no_payment_links", "No payment links yet.")}</p>
                ) : (
                    <div className="space-y-2">
                        {visibleLinks.map((link) => {
                            const clientKey = typeof link.clientId === "string" ? link.clientId : link.clientId?._id;
                            const clientName = clientKey ? clientNameById[clientKey] : "";
                            const isActive = link.status === "active";
                            return (
                                <div
                                    key={link._id}
                                    className="flex flex-col gap-3 rounded-2xl border border-light-200/80 bg-white px-4 py-3 text-light-900 shadow-sm dark:border-dark-700/80 dark:bg-dark-800 dark:text-dark-50 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-base font-semibold">{formatMoney(link.amountCents, link.currency)}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[link.status]}`}>
                                                {statusLabel(link.status)}
                                            </span>
                                            {(link.paymentMethods || []).map((method) => {
                                                const Icon = methodIcons[method];
                                                return Icon ? (
                                                    <span
                                                        key={method}
                                                        title={methodLabel(method)}
                                                        className="flex items-center gap-1 text-xs text-light-500 dark:text-dark-400"
                                                    >
                                                        <Icon size={12} />
                                                        {methodLabel(method)}
                                                    </span>
                                                ) : null;
                                            })}
                                            {!!link.failedAttempts && link.status === "active" && (
                                                <span className="text-xs text-danger-500">
                                                    {link.failedAttempts} {tr("failed_attempts", "failed attempt(s)")}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-sm break-words">
                                            {link.customer?.fullName ||
                                                link.customer?.email ||
                                                link.customer?.phone || (
                                                    <span className="text-light-500 dark:text-dark-400 italic">
                                                        {tr("customer_enters_details", "Customer enters their details at checkout")}
                                                    </span>
                                                )}
                                            {clientName && <span className="text-light-500 dark:text-dark-400"> · {clientName}</span>}
                                        </span>
                                        {link.description && <span className="text-xs break-words text-light-600 dark:text-dark-300">{link.description}</span>}
                                        <span className="text-xs text-light-500 dark:text-dark-400">
                                            {tr("created_on", "Created")} {formatDate(link.createdAt)}
                                            {link.status === "paid" && ` · ${tr("paid_at", "Paid")} ${formatDate(link.paidAt)}`}
                                            {isActive && link.expiresAt && ` · ${tr("expires", "Expires")} ${formatDate(link.expiresAt)}`}
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1 self-end md:self-auto">
                                        {isActive && (
                                            <>
                                                <button onClick={() => copyLink(link)} title={tr("copy_link", "Copy link")} className="btn-ghost rounded-xl">
                                                    <Copy size={14} />
                                                </button>
                                                <a href={whatsappHref(link)} target="_blank" rel="noreferrer" title="WhatsApp" className="btn-ghost rounded-xl">
                                                    <MessageCircle size={14} />
                                                </a>
                                                <a href={mailHref(link)} title={tr("send_email", "Send email")} className="btn-ghost rounded-xl">
                                                    <Mail size={14} />
                                                </a>
                                                <a href={link.url} target="_blank" rel="noreferrer" title={tr("open_link", "Open link")} className="btn-ghost rounded-xl">
                                                    <ExternalLink size={14} />
                                                </a>
                                                <button
                                                    onClick={() => handleCancel(link)}
                                                    disabled={cancelMutation.isPending}
                                                    title={tr("cancel_link", "Cancel link")}
                                                    className="btn-ghost text-danger-500 rounded-xl disabled:opacity-50"
                                                >
                                                    <Ban size={14} />
                                                </button>
                                            </>
                                        )}
                                        {link.status === "paid" && <Check size={18} className="text-green-600 dark:text-green-400" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Created Link Modal */}
            {createdLink && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setCreatedLink(null);
                    }}
                >
                    <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-dark-800">
                        <div className="flex items-center justify-between border-b border-light-200 px-6 py-4 dark:border-dark-700">
                            <div className="flex items-center gap-2">
                                <Link2 size={20} className="text-primary-500" />
                                <h3 className="text-xl font-semibold text-light-900 dark:text-dark-50">{tr("payment_link_ready", "Payment link ready")}</h3>
                            </div>
                            <button
                                onClick={() => setCreatedLink(null)}
                                className="rounded-lg p-1 text-light-400 hover:bg-light-100 hover:text-light-600 dark:text-dark-500 dark:hover:bg-dark-700 dark:hover:text-dark-300"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 p-6">
                            <p className="text-sm text-light-600 dark:text-dark-300">
                                {formatMoney(createdLink.amountCents, createdLink.currency)}
                                {createdLink.customer?.fullName && ` · ${createdLink.customer.fullName}`}
                            </p>
                            <div className="flex items-center gap-2">
                                <input readOnly value={createdLink.url} dir="ltr" onFocus={(e) => e.target.select()} className="input w-full text-xs" />
                                <button onClick={() => copyLink(createdLink)} className="btn-primary shrink-0 rounded-xl">
                                    <Copy size={14} />
                                    <span>{tr("copy", "Copy")}</span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <a
                                    href={whatsappHref(createdLink)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 rounded-lg border border-light-300 px-4 py-2 text-sm font-medium text-light-700 hover:bg-light-50 dark:border-dark-600 dark:text-dark-300 dark:hover:bg-dark-700"
                                >
                                    <MessageCircle size={16} /> WhatsApp
                                </a>
                                <a
                                    href={mailHref(createdLink)}
                                    className="flex items-center gap-2 rounded-lg border border-light-300 px-4 py-2 text-sm font-medium text-light-700 hover:bg-light-50 dark:border-dark-600 dark:text-dark-300 dark:hover:bg-dark-700"
                                >
                                    <Mail size={16} /> {tr("send_email", "Send email")}
                                </a>
                            </div>
                            <p className="text-xs text-light-500 dark:text-dark-400">
                                {tr("expires", "Expires")} {formatDate(createdLink.expiresAt)}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentLinksPage;
