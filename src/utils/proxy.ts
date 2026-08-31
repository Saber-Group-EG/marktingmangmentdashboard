const PROXY_BASE = 'https://images.weserv.nl';

export function getProxiedCoverUrl(originalUrl: string, options?: { width?: number; quality?: number }): string {
    if (!originalUrl) return originalUrl;
    if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) return originalUrl;
    const { width = 800, quality = 75 } = options || {};
    return `${PROXY_BASE}/?url=${encodeURIComponent(originalUrl)}&w=${width}&q=${quality}&output=jpg`;
}
