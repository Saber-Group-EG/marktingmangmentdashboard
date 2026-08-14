import { Globe } from "lucide-react";
import { SiBehance, SiFacebook, SiInstagram, SiLinkedin, SiTiktok, SiThreads, SiX, SiYoutube } from "react-icons/si";

interface SocialLink {
    platform?: string;
    url?: string;
}

interface SocialLinkIconsProps {
    links?: SocialLink[];
    size?: number;
    className?: string;
}

const normalizeUrl = (url: string): string => {
    if (!url) return "#";
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

const SocialLinkIcons = ({ links, size = 16, className = "" }: SocialLinkIconsProps) => {
    const items = Array.isArray(links) ? links.filter((l: any) => l && (l.url || "").trim()) : [];
    if (!items.length) return null;

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            {items.map((link: any, idx: number) => {
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
                    colorClass = "text-dark-900 dark:text-dark-50";
                } else if (platformLower === "x" || platformLower.includes("twitter")) {
                    Icon = SiX;
                    colorClass = "text-dark-900 dark:text-dark-50";
                } else if (platformLower.includes("youtube")) {
                    Icon = SiYoutube;
                    colorClass = "text-red-600";
                } else if (platformLower.includes("linkedin")) {
                    Icon = SiLinkedin;
                    colorClass = "text-blue-700";
                } else if (platformLower.includes("threads")) {
                    Icon = SiThreads;
                    colorClass = "text-dark-900 dark:text-dark-50";
                } else if (
                    platformLower.includes("behance") ||
                    platformLower.includes("behacne") ||
                    platformLower.includes("behcane")
                ) {
                    Icon = SiBehance;
                    colorClass = "text-blue-500";
                }
                return (
                    <a
                        key={idx}
                        href={normalizeUrl(link.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-light-200 bg-white shadow-sm transition-opacity hover:opacity-70 dark:border-dark-700 dark:bg-dark-900 ${colorClass}`}
                        title={`${link.platform || "Link"}: ${link.url}`}
                    >
                        <Icon size={size} />
                    </a>
                );
            })}
        </div>
    );
};

export default SocialLinkIcons;
