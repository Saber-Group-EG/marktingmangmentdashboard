interface CompressImageOptions {
    maxBytes?: number;
    maxDimension?: number;
    minDimension?: number;
    scaleFactor?: number;
}

const DEFAULT_MAX_BYTES = 50 * 1024;
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_MIN_DIMENSION = 120;
const DEFAULT_SCALE_FACTOR = 0.82;
const QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3, 0.24, 0.2];
const stripExtension = (fileName: string): string => fileName.replace(/\.[^/.]+$/, "");

const getFileExtension = (mimeType: string): string => {
    switch (mimeType) {
        case "image/png":
            return "png";
        case "image/gif":
            return "gif";
        case "image/webp":
            return "webp";
        case "image/jpeg":
        default:
            return "jpg";
    }
};

const getCompressedFileName = (fileName: string, mimeType: string): string => {
    const base = stripExtension(fileName) || "image";
    const extension = getFileExtension(mimeType);
    return `${base}.${extension}`;
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Unable to load image for compression."));
        };

        image.src = objectUrl;
    });

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> =>
    new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });

export const compressImageFileToMaxBytes = async (file: File, options: CompressImageOptions = {}): Promise<File> => {
    if (!file.type.startsWith("image/")) {
        return file;
    }

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    const minDimension = options.minDimension ?? DEFAULT_MIN_DIMENSION;
    const scaleFactor = options.scaleFactor ?? DEFAULT_SCALE_FACTOR;

    const image = await loadImageFromFile(file);
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;

    const longestSide = Math.max(width, height);
    if (longestSide > maxDimension) {
        const ratio = maxDimension / longestSide;
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
        return file;
    }

    const originalMimeType = file.type;

    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        for (const quality of QUALITY_STEPS) {
            const blob = await canvasToBlob(canvas, originalMimeType, quality);
            if (!blob) continue;

            if (!bestBlob || blob.size < bestBlob.size) {
                bestBlob = blob;
            }

            if (blob.size <= maxBytes) {
                return new File([blob], getCompressedFileName(file.name, originalMimeType), {
                    type: originalMimeType,
                    lastModified: Date.now(),
                });
            }
        }

        if (width <= minDimension && height <= minDimension) {
            break;
        }

        width = Math.max(minDimension, Math.round(width * scaleFactor));
        height = Math.max(minDimension, Math.round(height * scaleFactor));
    }

    if (bestBlob) {
        return new File([bestBlob], getCompressedFileName(file.name, originalMimeType), {
            type: originalMimeType,
            lastModified: Date.now(),
        });
    }

    return file;
};

export const compressDataUrl = (dataUrl: string, quality = 0.82, maxDimension = 1600): Promise<string> =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { naturalWidth: w, naturalHeight: h } = img;
            const longest = Math.max(w, h);
            if (longest > maxDimension) {
                const ratio = maxDimension / longest;
                w = Math.max(1, Math.round(w * ratio));
                h = Math.max(1, Math.round(h * ratio));
            }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(dataUrl); return; }
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
