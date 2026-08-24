import axios from "axios";

const BACKEND_URL =
    String(import.meta.env.VITE_FORM_URL || "https://application-maker.onrender.com/api");

const DEFAULT_UPLOAD_FOLDER = "Markting/projects";
const MAX_RETRIES = 3;

export interface R2UploadResult {
    url: string;
    mimeType?: string;
    size?: number;
    originalName?: string;
    publicId?: string;
}

export interface R2UploadOptions {
    fileName: string;
    folder?: string;
    resourceType?: "image" | "video";
    onProgress?: (percent: number) => void;
}

export const isDataUrl = (value?: string): value is string => typeof value === "string" && value.startsWith("data:");
export const isBlobUrl = (value?: string): value is string => typeof value === "string" && value.startsWith("blob:");
export const needsUpload = (value?: string): boolean => isDataUrl(value) || isBlobUrl(value);

export const blobUrlToDataUrl = async (blobUrl: string): Promise<string> => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const dataUrlToFile = (dataUrl: string, fileName: string): File => {
    const [header, base64] = dataUrl.split(",");
    if (!header || !base64) {
        throw new Error("Invalid data URL for R2 upload.");
    }

    const mimeMatch = header.match(/data:(.*?);base64/);
    const mimeType = mimeMatch?.[1] || "application/octet-stream";
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);

    for (let i = 0; i < bytes.length; i += 1) {
        buffer[i] = bytes.charCodeAt(i);
    }

    return new File([buffer], fileName, { type: mimeType });
};

export async function uploadToR2(file: File, folder = DEFAULT_UPLOAD_FOLDER, onProgress?: (percent: number) => void): Promise<string> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < MAX_RETRIES) {
        try {
            let presignData: { presignedUrl?: string; publicUrl?: string };

            try {
                const { data } = await axios.post(
                    `${BACKEND_URL.replace(/\/$/, "")}/upload/presign`,
                    { name: file.name, type: file.type, folder },
                    { timeout: 30000 }
                );
                presignData = data;
            } catch (err: any) {
                const detail = err.response
                    ? `Server responded ${err.response.status}: ${JSON.stringify(err.response.data)}`
                    : err.request
                        ? `No response received from server (${err.code || "unknown"}): ${err.message}`
                        : err.message;
                throw new Error(`Presign step failed — ${detail}`);
            }

            const { presignedUrl, publicUrl } = presignData;

            if (!presignedUrl || !presignedUrl.startsWith("https://")) {
                throw new Error(`Invalid presigned URL received: ${presignedUrl}`);
            }
            if (!publicUrl || !publicUrl.startsWith("https://")) {
                throw new Error(`Invalid public URL received: ${publicUrl}`);
            }

            const uploadResult = await new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", presignedUrl);
                xhr.setRequestHeader("Content-Type", file.type);
                xhr.timeout = 180000;

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable && onProgress) {
                        onProgress(Math.round((e.loaded / e.total) * 100));
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(publicUrl);
                    } else {
                        reject(
                            new Error(
                                `R2 rejected upload — status ${xhr.status} ${xhr.statusText}: ${xhr.responseText || "(empty body)"}`
                            )
                        );
                    }
                };

                xhr.onerror = () => {
                    reject(
                        new Error(
                            `Browser blocked or dropped the request before any response (readyState ${xhr.readyState}, status ${xhr.status}). ` +
                                `Common causes: ad blocker/extension, corporate/school network filtering, offline connection, or DNS failure resolving the R2 endpoint.`
                        )
                    );
                };

                xhr.ontimeout = () =>
                    reject(
                        new Error(
                            `Upload timed out after 180s (file size: ${(file.size / 1e6).toFixed(1)}MB) — likely a slow or unstable connection.`
                        )
                    );

                xhr.send(file);
            });

            return uploadResult;
        } catch (error) {
            lastError = error;
            attempt += 1;
            if (attempt >= MAX_RETRIES) {
                throw new Error(`Upload failed after ${MAX_RETRIES} attempts. Last error: ${(lastError as Error).message}`);
            }
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
    }

    throw new Error(`Upload failed after ${MAX_RETRIES} attempts. Last error: ${(lastError as Error)?.message}`);
}

export const uploadDataUrlToR2 = async (dataUrl: string, options: R2UploadOptions): Promise<R2UploadResult> => {
    const file = dataUrlToFile(dataUrl, options.fileName);
    const publicUrl = await uploadToR2(file, options.folder, options.onProgress);

    return {
        url: publicUrl,
        mimeType: file.type,
        size: file.size,
        originalName: file.name,
    };
};

const inFlightUploads = new Map<string, Promise<R2UploadResult>>();

export const uploadDataUrlToR2Cached = (dataUrl: string, options: R2UploadOptions): Promise<R2UploadResult> => {
    const existing = inFlightUploads.get(dataUrl);
    if (existing) return existing;
    const promise = uploadDataUrlToR2(dataUrl, options).finally(() => {
        inFlightUploads.delete(dataUrl);
    });
    inFlightUploads.set(dataUrl, promise);
    return promise;
};

export const uploadThumbnailToR2 = async (thumbnailUrl: string, options: R2UploadOptions): Promise<R2UploadResult> => {
    let dataUrl = thumbnailUrl;
    if (isBlobUrl(thumbnailUrl)) {
        dataUrl = await blobUrlToDataUrl(thumbnailUrl);
    }
    if (!isDataUrl(dataUrl)) {
        return { url: thumbnailUrl };
    }
    return uploadDataUrlToR2Cached(dataUrl, options);
};

export const uploadFileToR2 = async (file: File, options: R2UploadOptions): Promise<R2UploadResult> => {
    const publicUrl = await uploadToR2(file, options.folder, options.onProgress);
    return {
        url: publicUrl,
        mimeType: file.type,
        size: file.size,
        originalName: file.name,
    };
};

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];
export const ALLOWED_PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png"];
export const ALLOWED_CV_TYPES = ["application/pdf"];
export const ALLOWED_CV_EXTENSIONS = [".pdf"];

export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
export const MAX_CV_SIZE = 10 * 1024 * 1024;

export function hasAllowedExtension(filename: string, allowedExtensions: string[]): boolean {
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
    return allowedExtensions.includes(ext);
}

export function isAllowedFileType(file: File, allowedTypes: string[], allowedExtensions: string[]): boolean {
    return allowedTypes.includes(file.type) || hasAllowedExtension(file.name, allowedExtensions);
}

export function isFileWithinSizeLimit(file: File, maxSize: number): boolean {
    return file.size <= maxSize;
}