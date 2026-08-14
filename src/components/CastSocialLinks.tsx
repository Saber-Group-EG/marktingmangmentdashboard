import { Plus, Trash2 } from "lucide-react";

export interface SocialLink {
    platform: string;
    url: string;
}

const COMMON_PLATFORMS = ["Instagram", "Facebook", "X (Twitter)", "TikTok", "YouTube", "LinkedIn", "Website"];

type CastSocialLinksProps = {
    value: SocialLink[];
    onChange: (links: SocialLink[]) => void;
};

const CastSocialLinks = ({ value, onChange }: CastSocialLinksProps) => {
    const links = Array.isArray(value) ? value : [];

    const updateLink = (index: number, patch: Partial<SocialLink>) => {
        onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
    };

    const addLink = () => {
        onChange([...links, { platform: "", url: "" }]);
    };

    const removeLink = (index: number) => {
        onChange(links.filter((_, i) => i !== index));
    };

    return (
        <div>
            <label className="block mb-2 text-sm font-medium text-light-700 dark:text-dark-300">Social Links</label>
            {links.length === 0 && (
                <p className="text-xs text-light-500 dark:text-dark-400 mb-2">No social links yet.</p>
            )}
            {links.map((link, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center mb-2">
                    <input
                        type="text"
                        list="social-platforms"
                        value={link.platform}
                        onChange={(e) => updateLink(index, { platform: e.target.value })}
                        className="input col-span-4"
                        placeholder="Platform (e.g., Instagram)"
                    />
                    <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateLink(index, { url: e.target.value })}
                        className="input col-span-7"
                        placeholder="https://..."
                    />
                    <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="p-2 rounded hover:bg-light-100 dark:hover:bg-dark-800 text-danger-500"
                        title="Remove link"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <datalist id="social-platforms">
                {COMMON_PLATFORMS.map((platform) => (
                    <option key={platform} value={platform} />
                ))}
            </datalist>
            <button type="button" onClick={addLink} className="btn-secondary">
                <Plus className="w-4 h-4 inline mr-2" />
                Add Social Link
            </button>
        </div>
    );
};

export default CastSocialLinks;