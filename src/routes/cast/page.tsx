import { useState, useMemo, KeyboardEvent, ChangeEvent } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2, User, Search } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { showConfirm } from "@/utils/swal";
import { useCast, useCreateCast, useUpdateCast, useDeleteCast, useProjectCounts } from "@/hooks/queries";
import type { CastMember } from "@/api/requests/castService";
import CastSocialLinks, { type SocialLink } from "@/components/CastSocialLinks";
import SocialLinkIcons from "@/components/SocialLinkIcons";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { uploadDataUrlToR2 } from "@/utils/r2Upload";

const getCastPhotoUrl = (photo: any): string => {
    if (!photo) return "";
    if (typeof photo === "string") return photo;
    return photo.url || photo.publicId || "";
};

const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });

const cleanSocialLinks = (links: SocialLink[]): { platform: string; url: string }[] =>
    links
        .filter((l) => (l.platform || "").trim() && (l.url || "").trim())
        .map((l) => ({ platform: l.platform.trim(), url: l.url.trim() }));

const CastPage = () => {
    const { t } = useLang();
    const tr = (key: string, fallback: string) => {
        const value = t(key);
        return !value || value === key ? fallback : value;
    };

    // Add form states
    const [inputName, setInputName] = useState("");
    const [inputTitles, setInputTitles] = useState<string[]>([]);
    const [titleInput, setTitleInput] = useState("");
    const [inputPhoto, setInputPhoto] = useState("");
    const [inputSocialLinks, setInputSocialLinks] = useState<SocialLink[]>([]);

    // Edit modal states
    const [editingMember, setEditingMember] = useState<CastMember | null>(null);
    const [editName, setEditName] = useState("");
    const [editTitles, setEditTitles] = useState<string[]>([]);
    const [editTitleInput, setEditTitleInput] = useState("");
    const [editPhoto, setEditPhoto] = useState("");
    const [editSocialLinks, setEditSocialLinks] = useState<SocialLink[]>([]);

    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: castResponse, isLoading } = useCast();
    const members = castResponse?.cast || [];
    const totalMembers = castResponse?.meta?.total ?? members.length;
    const { castCounts, totalProjects } = useProjectCounts();

    const filteredMembers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return members;
        return members.filter(
            (m) =>
                (m.name || "").toLowerCase().includes(q) ||
                (m.title || []).some((t) => t.toLowerCase().includes(q)),
        );
    }, [members, searchQuery]);

    const createCastMutation = useCreateCast();
    const updateCastMutation = useUpdateCast();
    const deleteCastMutation = useDeleteCast();

    const isSaving = createCastMutation.isPending || updateCastMutation.isPending;
    const photoUpload = useUploadProgress();

    const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>, setPhoto: (url: string) => void) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await photoUpload.run({
                title: tr("uploading_photo", "Uploading photo..."),
                label: file.name,
                task: async () => {
                    const dataUrl = await readFileAsDataUrl(file);
                    const uploaded = await uploadDataUrlToR2(dataUrl, {
                        fileName: file.name || `cast-${Date.now()}.jpg`,
                        resourceType: "image",
                    });
                    setPhoto(uploaded.url);
                },
            });
        } catch (e: any) {
            setError(e?.message || tr("photo_upload_failed", "Failed to upload photo"));
        } finally {
            e.target.value = "";
        }
    };

    const handleAdd = () => {
        const name = (inputName || "").trim();
        if (!name) {
            setError(tr("member_name_required", "Member name is required"));
            return;
        }

        setError("");
        createCastMutation.mutate(
            {
                name,
                title: inputTitles.length > 0 ? inputTitles : undefined,
                photo: inputPhoto || undefined,
                socialLinks: cleanSocialLinks(inputSocialLinks),
            },
            {
                onSuccess: () => {
                    setInputName("");
                    setInputTitles([]);
                    setTitleInput("");
                    setInputPhoto("");
                    setInputSocialLinks([]);
                },
                onError: (e: any) => {
                    setError(e?.response?.data?.message || "Failed to create member");
                },
            },
        );
    };

    const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    };

    const openEditModal = (member: CastMember) => {
        setEditingMember(member);
        setEditName(member.name || "");
        setEditTitles(member.title || []);
        setEditTitleInput("");
        setEditPhoto(getCastPhotoUrl(member.photo));
        setEditSocialLinks((member.socialLinks || []).map((l) => ({ platform: l.platform, url: l.url })));
        setError("");
    };

    const closeEditModal = () => {
        setEditingMember(null);
        setEditName("");
        setEditTitles([]);
        setEditTitleInput("");
        setEditPhoto("");
        setEditSocialLinks([]);
        setError("");
    };

    const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveEdit();
        }
    };

    const saveEdit = async () => {
        const name = (editName || "").trim();
        if (!name) {
            setError(tr("member_name_required", "Member name is required"));
            return;
        }
        if (!editingMember) return;

        try {
            setError("");
            await updateCastMutation.mutateAsync({
                id: editingMember._id,
                data: {
                    name,
                    title: editTitles.length > 0 ? editTitles : undefined,
                    photo: editPhoto || undefined,
                    socialLinks: cleanSocialLinks(editSocialLinks),
                },
            });
            closeEditModal();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to update member");
        }
    };

    const remove = async (member: CastMember) => {
        const confirmed = await showConfirm(
            tr("confirm_delete_member", "Delete this member?"),
            t("yes") || "Yes",
            t("no") || "No",
        );
        if (!confirmed) return;

        try {
            setError("");
            await deleteCastMutation.mutateAsync(member._id);
        } catch (e: any) {
            setError(e?.response?.data?.message || "Failed to delete member");
        }
    };

    const addTitle = () => {
        const val = titleInput.trim();
        if (val && !inputTitles.includes(val)) {
            setInputTitles([...inputTitles, val]);
        }
        setTitleInput("");
    };

    const removeTitle = (index: number) => {
        setInputTitles(inputTitles.filter((_, i) => i !== index));
    };

    const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTitle();
        }
    };

    const addEditTitle = () => {
        const val = editTitleInput.trim();
        if (val && !editTitles.includes(val)) {
            setEditTitles([...editTitles, val]);
        }
        setEditTitleInput("");
    };

    const removeEditTitle = (index: number) => {
        setEditTitles(editTitles.filter((_, i) => i !== index));
    };

    const handleEditTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addEditTitle();
        }
    };

    return (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-white/90 p-6 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-8">
                <div className="absolute -top-20 -right-10 h-52 w-52 rounded-full bg-light-400/20 blur-3xl dark:bg-light-500/10" />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secdark-700/15 blur-3xl dark:bg-secdark-700/20" />
                <div className="relative flex flex-col gap-2">
                    <span className="inline-flex w-fit items-center rounded-full border border-light-300/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-light-700 dark:border-dark-600 dark:bg-dark-900/70 dark:text-dark-200">
                        Talent Studio
                    </span>
                    <h1 className="title text-2xl sm:text-3xl">{tr("Cast", "Cast")}</h1>
                    <p className="text-light-600 dark:text-dark-300 text-sm sm:text-base">
                        {tr("cast_page_sub", "Manage cast and crew members used in projects.")}
                    </p>
                </div>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_members", "Total Members")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{totalMembers}</p>
                </div>
                <div className="rounded-2xl border border-light-200/70 bg-white/90 p-4 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/60">
                    <p className="text-light-600 dark:text-dark-300 text-xs uppercase tracking-[0.08em]">{tr("total_projects", "Total Projects")}</p>
                    <p className="text-light-900 dark:text-dark-50 mt-2 text-2xl font-semibold">{totalProjects}</p>
                </div>
            </section>

            {error && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                    {error}
                </div>
            )}

            {/* Add Member Form Section */}
            <section className="relative overflow-hidden rounded-3xl border border-light-200/70 bg-gradient-to-br from-light-50 via-white to-light-100/60 p-5 shadow-sm dark:border-dark-700/70 dark:from-dark-900/60 dark:via-dark-900/30 dark:to-dark-800/60 sm:p-6">
                <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-light-300/40 blur-3xl dark:bg-dark-700/40" />
                <div className="relative mb-5">
                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">{tr("cast_add_member", "Add Member")}</h2>
                    <p className="text-sm text-light-600 dark:text-dark-300">
                        {tr("cast_add_member_sub", "Create a new member with a photo and social links.")}
                    </p>
                </div>

                <div className="relative grid gap-4 lg:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("cast_name", "Name")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={inputName}
                            onChange={(e) => setInputName(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            placeholder={tr("cast_name", "Name")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("cast_title_role", "Titles/Roles")}
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {inputTitles.map((title, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 rounded-full border border-light-300 bg-light-100 px-2.5 py-0.5 text-xs font-medium text-light-700 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-200"
                                >
                                    {title}
                                    <button
                                        type="button"
                                        onClick={() => removeTitle(idx)}
                                        className="ml-0.5 rounded-full p-0.5 hover:bg-light-300 dark:hover:bg-dark-600"
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={addTitle}
                            placeholder={tr("cast_title_placeholder", "Type a title and press Enter")}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-light-700 dark:text-dark-300">
                            {tr("cast_photo", "Photo")}
                        </label>
                        <div className="mb-2 flex items-center gap-3">
                            {inputPhoto ? (
                                <img
                                    src={inputPhoto}
                                    alt={tr("cast_photo", "Photo")}
                                    className="h-16 w-16 rounded-full border border-light-200 object-cover dark:border-dark-700"
                                />
                            ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-light-100 text-light-500 dark:bg-dark-700 dark:text-dark-400">
                                    <User size={24} />
                                </div>
                            )}
                            {inputPhoto && (
                                <button
                                    type="button"
                                    onClick={() => setInputPhoto("")}
                                    className="btn-ghost text-xs"
                                >
                                    {tr("remove_photo", "Remove")}
                                </button>
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoSelect(e, setInputPhoto)}
                            disabled={isSaving}
                            className="input w-full disabled:opacity-50"
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <CastSocialLinks value={inputSocialLinks} onChange={setInputSocialLinks} />
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
                            <span>{tr("cast_add_member", "Add Member")}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Members List Section */}
            <div className="rounded-3xl border border-light-200/70 bg-white/90 p-5 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65 sm:p-6">
                <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-light-900 dark:text-dark-50 text-lg font-semibold">{tr("cast_members", "Cast Members")}</h2>
                    <div className="relative">
                        <Search className="text-light-600 dark:text-dark-400 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={tr("search_cast", "Search cast members...")}
                            className="input w-64 rounded-xl pr-3 pl-10"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="text-light-500 h-8 w-8 animate-spin" />
                    </div>
                ) : filteredMembers.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-light-200 dark:border-dark-700">
                                    <th className="pb-3 font-medium text-light-600 dark:text-dark-400">{tr("photo", "Photo")}</th>
                                    <th className="pb-3 font-medium text-light-600 dark:text-dark-400">{tr("cast_name", "Name")}</th>
                                    <th className="pb-3 font-medium text-light-600 dark:text-dark-400">{tr("cast_title_role", "Title/Role")}</th>
                                    <th className="pb-3 font-medium text-light-600 dark:text-dark-400">{tr("used_in_projects", "Used in Projects")}</th>
                                    <th className="pb-3 font-medium text-light-600 dark:text-dark-400">{tr("social_links", "Social Links")}</th>
                                    <th className="pb-3 font-medium text-light-600 dark:text-dark-400">{tr("actions", "Actions")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-100 dark:divide-dark-700/50">
                                {filteredMembers.map((member) => {
                                    const photoUrl = getCastPhotoUrl(member.photo);
                                    const initial = member.name ? member.name.charAt(0).toUpperCase() : "?";

    return (
                                        <tr key={member._id} className="hover:bg-light-50/50 dark:hover:bg-dark-800/50 transition-colors">
                                            <td className="py-3 pr-4">
                                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-light-200 bg-light-100 dark:border-dark-700 dark:bg-dark-700">
                                                    {photoUrl ? (
                                                        <img src={photoUrl} alt={member.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-light-200 to-light-300 text-sm font-semibold text-light-700 dark:from-dark-700 dark:to-dark-600 dark:text-dark-300">
                                                            {initial}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4 font-medium text-light-900 dark:text-dark-50 whitespace-nowrap">
                                                {member.name}
                                            </td>
                                            <td className="py-3 pr-4 text-light-600 dark:text-dark-300 whitespace-nowrap">
                                                <div className="flex flex-wrap gap-1">
                                                    {(member.title || []).length > 0 ? (
                                                        member.title!.map((t, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center rounded-full border border-light-200 bg-light-50 px-2 py-0.5 text-xs font-medium text-light-700 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200"
                                                            >
                                                                {t}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        "-"
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    (castCounts[member._id] || 0) > 0
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                                                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                                }`}>
                                                    {castCounts[member._id] || 0}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <SocialLinkIcons links={member.socialLinks} size={14} />
                                            </td>
                                            <td className="py-3">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEditModal(member)}
                                                        className="btn-ghost rounded-lg p-1.5"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => remove(member)}
                                                        className="btn-ghost text-danger-500 rounded-lg p-1.5"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-light-600 dark:text-dark-300 py-8 text-center">
                        {tr("no_members_defined", "No cast members defined yet.")}
                    </p>
                )}
            </div>

            {/* Edit Member Modal */}
            {editingMember && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeEditModal();
                    }}
                >
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-dark-800">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-light-200 px-6 py-4 dark:border-dark-700">
                            <div>
                                <h3 className="text-xl font-semibold text-light-900 dark:text-dark-50">
                                    {tr("edit_member", "Edit Member")}
                                </h3>
                                <p className="mt-1 text-sm text-light-500 dark:text-dark-400">
                                    {tr("edit_member_sub", "Update member details")}
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
                        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
                            {error && (
                                <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("cast_name", "Name")} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                        placeholder={tr("cast_name", "Name")}
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                        {tr("cast_title_role", "Titles/Roles")}
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {editTitles.map((title, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 rounded-full border border-light-300 bg-light-100 px-2.5 py-0.5 text-xs font-medium text-light-700 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-200"
                                            >
                                                {title}
                                                <button
                                                    type="button"
                                                    onClick={() => removeEditTitle(idx)}
                                                    className="ml-0.5 rounded-full p-0.5 hover:bg-light-300 dark:hover:bg-dark-600"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <input
                                        value={editTitleInput}
                                        onChange={(e) => setEditTitleInput(e.target.value)}
                                        onKeyDown={handleEditTitleKeyDown}
                                        onBlur={addEditTitle}
                                        className="w-full rounded-lg border border-light-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-light-100"
                                        placeholder={tr("cast_title_placeholder", "Type a title and press Enter")}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-light-700 dark:text-dark-300">
                                    {tr("cast_photo", "Photo")}
                                </label>
                                <div className="mb-2 flex items-center gap-3">
                                    {editPhoto ? (
                                        <img
                                            src={editPhoto}
                                            alt={editName || tr("cast_photo", "Photo")}
                                            className="h-16 w-16 rounded-full border border-light-200 object-cover dark:border-dark-700"
                                        />
                                    ) : (
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-light-100 text-light-500 dark:bg-dark-700 dark:text-dark-400">
                                            <User size={24} />
                                        </div>
                                    )}
                                    {editPhoto && (
                                        <button
                                            type="button"
                                            onClick={() => setEditPhoto("")}
                                            className="btn-ghost text-xs"
                                        >
                                            {tr("remove_photo", "Remove")}
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoSelect(e, setEditPhoto)}
                                    className="input w-full"
                                />
                            </div>

                            <CastSocialLinks value={editSocialLinks} onChange={setEditSocialLinks} />
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

            <UploadProgressOverlay
                open={photoUpload.open}
                progress={photoUpload.progress}
                estimatedSecondsLeft={photoUpload.estimatedSecondsLeft}
                title={photoUpload.title || tr("uploading_photo", "Uploading photo...")}
                label={photoUpload.label}
            />
        </div>
    );
};

export default CastPage;
