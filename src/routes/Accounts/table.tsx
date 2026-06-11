import { useState, useMemo } from "react";
import { useLang } from "@/hooks/useLang";
import { useClients } from "@/hooks/queries/useClientsQuery";
import { NewAccount } from "./Forms/NewAccount";
import { Loader2 } from "lucide-react";
import { useAllAccounts, useUpdateAccount, useDeleteAccount } from "@/hooks/queries/useAccouts";
import type { Account } from "@/api/requests/accoutServices";
import PasswordGate from "@/components/PasswordGate";

type AccountWithClientName = Account & {
    clientName: string;
};

const AccountsPage = () => {
    const { t } = useLang();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<Partial<Account> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { data: clients = [], isLoading: clientsLoading } = useClients();
    
    // Get all client IDs
    const clientIds = useMemo(() => clients.map(c => c._id).filter(Boolean) as string[], [clients]);
    
    // Use the React Query hook to fetch all accounts
    const { data: accounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useAllAccounts(clientIds);
    const updateAccountMutation = useUpdateAccount();
    const deleteAccountMutation = useDeleteAccount();

    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    // Get client name for each account (computed, not stored in editing state)
    const accountsWithClientNames = useMemo((): AccountWithClientName[] => {
        return accounts.map((account: any) => {
            const client = clients.find((c: any) => c._id === account.clientId);
            const clientName = client?.business?.businessName || 
                              client?.business?.name || 
                              client?.personal?.fullName || 
                              account.clientId ||
                              '';
            return {
                ...account,
                clientName,
            };
        });
    }, [accounts, clients]);

    const isLoading = clientsLoading || accountsLoading;

    // Save edited account
    const handleSaveEdit = async () => {
        console.log("handleSaveEdit called", { editingId, editingData });
        if (editingData && editingId) {
            const accountToUpdate = accounts.find((a: any) => a._id === editingId);
            if (!accountToUpdate || !accountToUpdate.clientId) {
                setError("Cannot update: missing client reference");
                return;
            }

            // Remove any non-Account fields from editing data
            const { clientName, ...cleanEditingData } = editingData as any;
            
            try {
                console.log("calling updateAccountMutation.mutateAsync", { clientId: accountToUpdate.clientId, accountId: editingId, accountData: cleanEditingData });
                await updateAccountMutation.mutateAsync({
                    clientId: accountToUpdate.clientId,
                    accountId: editingId,
                    accountData: cleanEditingData,
                });
                
                setEditingId(null);
                setEditingData(null);
            } catch (err: any) {
                console.error("Error saving account:", err);
                setError(err.message || "Failed to save account changes");
            }
        }
    };

    const handleDelete = async (id: string) => {
        console.log("handleDelete called", id);
        const accountToDelete = accounts.find((a: any) => a._id === id);
        if (!accountToDelete || !accountToDelete.clientId) {
            setError("Cannot delete: missing client reference");
            return;
        }
        if (confirm(tr("confirm_delete", "Are you sure you want to delete this account?"))) {
            console.log("delete confirmed", id, accountToDelete);
            try {
                await deleteAccountMutation.mutateAsync({
                    clientId: accountToDelete.clientId,
                    accountId: id,
                });
                
                if (editingId === id) {
                    setEditingId(null);
                    setEditingData(null);
                }
            } catch (err: any) {
                console.error("Error deleting account:", err);
                setError(err.response?.data?.message || "Failed to delete account");
            }
        }
    };

    const handleEdit = (account: AccountWithClientName) => {
        console.log("handleEdit called", account?._id);
        // Only store Account fields, not clientName
        const { clientName, ...accountData } = account;
        setEditingId(account._id!);
        setEditingData(accountData);
    };

    const handleEditChange = (field: keyof Account, value: string) => {
        if (editingData) {
            setEditingData({
                ...editingData,
                [field]: value
            });
        }
    };

    const handleCancelEdit = () => {
        console.log("handleCancelEdit called", editingId);
        setEditingId(null);
        setEditingData(null);
    };

    const handleCreateAccount = async () => {
        await refetchAccounts();
    };

    const getTwoFactorDisplay = (method: string | undefined, account?: Account) => {
        switch(method) {
            case "mail": 
                return account?.mail ? ` ${account.mail}` : " Mail";
            case "phone": 
                return account?.phoneNumber ? ` ${account.phoneNumber}` : " Phone";
            default: 
                return "❌ None";
        }
    };

    const isSaving = updateAccountMutation.isPending;
    const isDeleting = (id: string) => deleteAccountMutation.isPending && deleteAccountMutation.variables?.accountId === id;

    // Get client name for display during editing
    const getEditingClientName = () => {
        if (!editingData?.clientId) return '';
        const client = clients.find((c: any) => c._id === editingData.clientId);
        return client?.business?.businessName || 
               client?.business?.name || 
               client?.personal?.fullName || 
               editingData.clientId;
    };

    return (
        <PasswordGate>
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            {error && (
                <div className="rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 p-4">
                    <p className="text-danger-600 dark:text-danger-400 text-sm">{error}</p>
                    <button
                        onClick={() => setError(null)}
                        className="text-danger-600 dark:text-danger-400 text-sm underline mt-2"
                    >
                        {tr("dismiss", "Dismiss")}
                    </button>
                </div>
            )}

            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        {tr("accounts", "Accounts")}
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("accounts", "Accounts")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("manage_accounts_sub", "Manage accounts and onboarding forms for clients")}
                    </p>
                    <NewAccount onSubmit={handleCreateAccount} />
                </div>
            </section>

            <section className="rounded-3xl border border-light-200/80 bg-white/90 p-5 shadow-sm dark:border-dark-700/80 dark:bg-dark-900/70 sm:p-6">
                <div className="mb-4">
                    <h2 className="text-light-900 dark:text-dark-50 text-lg font-semibold">
                        {tr("accounts_list", "Accounts List")}
                    </h2>
                    <p className="text-light-600 dark:text-dark-400 text-sm">
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {tr("loading_accounts", "Loading accounts...")}
                            </span>
                        ) : accountsWithClientNames.length === 0 
                            ? tr("accounts_placeholder", "No accounts yet — use Create Account to begin.")
                            : `${accountsWithClientNames.length} account(s) created`}
                    </p>
                </div>
                
                {isLoading ? (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-light-200/50 p-12">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                            <p className="text-light-600 dark:text-dark-400 text-sm">
                                {tr("loading_accounts", "Loading accounts...")}
                            </p>
                        </div>
                    </div>
                ) : accountsWithClientNames.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-light-200/50 p-6 text-center text-sm text-light-600 dark:text-dark-400">
                        {tr("accounts_empty", "No accounts to display.")}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-light-700 dark:text-dark-300">
                            <thead className="text-xs uppercase bg-light-100 dark:bg-dark-800 rounded-lg">
                                <tr>
                                    <th className="px-4 py-3">Client</th>
                                    <th className="px-4 py-3">Platform</th>
                                    <th className="px-4 py-3">Username</th>
                                    <th className="px-4 py-3">Password</th>
                                    <th className="px-4 py-3">2FA Method</th>
                                    <th className="px-4 py-3">Contact Info</th>
                                    <th className="px-4 py-3">Created At</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accountsWithClientNames.map((account) => {
                                    const isEditing = editingId === account._id;
                                    const isDeletingAccount = isDeleting(account._id!);
                                    const isSavingAccount = isSaving && editingId === account._id;
                                    
                                    return (
                                        <tr key={account._id} className="border-b border-light-200 dark:border-dark-700 hover:bg-light-50 dark:hover:bg-dark-800/50">
                                            {isEditing ? (
                                                <>
                                                    <td className="px-4 py-3">
                                                        <span className="text-light-600 dark:text-dark-400">
                                                            {getEditingClientName()}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={editingData?.platformName || ""}
                                                            onChange={(e) => handleEditChange("platformName", e.target.value)}
                                                            className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700"
                                                            placeholder="Platform"
                                                            disabled={isSavingAccount}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={editingData?.userName || ""}
                                                            onChange={(e) => handleEditChange("userName", e.target.value)}
                                                            className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700"
                                                            placeholder="Username"
                                                            disabled={isSavingAccount}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={editingData?.password || ""}
                                                            onChange={(e) => handleEditChange("password", e.target.value)}
                                                            className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700"
                                                            placeholder="Password"
                                                            disabled={isSavingAccount}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={editingData?.twoFactorMethod || "non"}
                                                            onChange={(e) => handleEditChange("twoFactorMethod", e.target.value as "mail" | "phone" | "non")}
                                                            className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700"
                                                            disabled={isSavingAccount}
                                                        >
                                                            <option value="non">None</option>
                                                            <option value="mail">Mail</option>
                                                            <option value="phone">Phone</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {editingData?.twoFactorMethod === "mail" && (
                                                            <div className="space-y-1">
                                                                <input
                                                                    type="email"
                                                                    value={editingData?.mail || ""}
                                                                    onChange={(e) => handleEditChange("mail", e.target.value)}
                                                                    className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700 text-xs"
                                                                    placeholder="Email"
                                                                    disabled={isSavingAccount}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={editingData?.mailPassword || ""}
                                                                    onChange={(e) => handleEditChange("mailPassword", e.target.value)}
                                                                    className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700 text-xs"
                                                                    placeholder="Email Password"
                                                                    disabled={isSavingAccount}
                                                                />
                                                            </div>
                                                        )}
                                                        {editingData?.twoFactorMethod === "phone" && (
                                                            <div className="space-y-1">
                                                                <input
                                                                    type="text"
                                                                    value={editingData?.phoneOwnerName || ""}
                                                                    onChange={(e) => handleEditChange("phoneOwnerName", e.target.value)}
                                                                    className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700 text-xs"
                                                                    placeholder="Owner Name"
                                                                    disabled={isSavingAccount}
                                                                />
                                                                <input
                                                                    type="tel"
                                                                    value={editingData?.phoneNumber || ""}
                                                                    onChange={(e) => handleEditChange("phoneNumber", e.target.value)}
                                                                    className="w-full px-2 py-1 border rounded dark:bg-dark-800 dark:border-dark-700 text-xs"
                                                                    placeholder="Phone Number"
                                                                    disabled={isSavingAccount}
                                                                />
                                                            </div>
                                                        )}
                                                        {editingData?.twoFactorMethod === "non" && <span className="text-light-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleSaveEdit}
                                                                disabled={isSavingAccount}
                                                                className="text-green-600 hover:text-green-700 dark:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                            >
                                                                {isSavingAccount && <Loader2 className="h-3 w-3 animate-spin" />}
                                                                Save
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCancelEdit}
                                                                disabled={isSavingAccount}
                                                                className="text-gray-600 hover:text-gray-700 dark:text-gray-400 disabled:opacity-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 font-medium">{account.clientName || "-"}</td>
                                                    <td className="px-4 py-3">{account.platformName || "-"}</td>
                                                    <td className="px-4 py-3">{account.userName || "-"}</td>
                                                    <td className="px-4 py-3 font-mono text-sm">{account.password || "-"}</td>
                                                    <td className="px-4 py-3">{getTwoFactorDisplay(account.twoFactorMethod, account)}</td>
                                                    <td className="px-4 py-3">
                                                        {account.twoFactorMethod === "mail" && account.mail && (
                                                            <div className="text-sm">
                                                                <div> {account.mail}</div>
                                                                {account.mailPassword && <div className="text-xs"> {account.mailPassword}</div>}
                                                            </div>
                                                        )}
                                                        {account.twoFactorMethod === "phone" && account.phoneNumber && (
                                                            <div className="text-sm">
                                                                <div> {account.phoneNumber}</div>
                                                                {account.phoneOwnerName && <div className="text-xs"> {account.phoneOwnerName}</div>}
                                                            </div>
                                                        )}
                                                        {account.twoFactorMethod === "non" && <span className="text-light-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEdit(account)}
                                                                disabled={isDeletingAccount}
                                                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(account._id!)}
                                                                disabled={isDeletingAccount}
                                                                className="text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                {isDeletingAccount && <Loader2 className="h-3 w-3 animate-spin" />}
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
        </PasswordGate>
    );
};

export default AccountsPage;