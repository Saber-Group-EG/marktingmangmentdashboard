import axios from "axios";

const BACKEND_URL =
    String(import.meta.env.VITE_FORM_URL || "https://application-maker.onrender.com/api");

const DEFAULT_UPLOAD_FOLDER = "Markting/projects";
const MAX_RETRIES = 3;
const MIN_TIMEOUT_MS = 180000;
const BYTES_PER_SEC_FLOOR = 300 * 1024; // assume ~300KB/s worst case
function computeTimeout(fileSize: number): number {
    return Math.max(MIN_TIMEOUT_MS, Math.ceil((fileSize / BYTES_PER_SEC_FLOOR) * 1000));
}

const MULTIPART_WORKER_URL = String(import.meta.env.VITE_MULTIPART_URL || "https://r2-multipart-worker.YOUR_SUBDOMAIN.workers.dev");
const PART_SIZE = 8 * 1024 * 1024; // 8MiB — above R2's 5MiB minimum
const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // only multipart above 20MB
const PART_CONCURRENCY = 2; // parallel parts per file — tuned for ~580KB/s upload; 2 streams ≈ 290KB/s each, stable
const PART_MAX_RETRIES = 4;
const PART_RETRY_BASE_DELAY = 1000;

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

function sanitizeFileName(name: string): string {
    return name
        .replace(/\s+/g, "-")
        .replace(/[^\w.\-()]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function uploadToR2(file: File, folder = DEFAULT_UPLOAD_FOLDER, onProgress?: (percent: number) => void): Promise<string> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < MAX_RETRIES) {
        try {
            let presignData: { presignedUrl?: string; publicUrl?: string };

            try {
                const { data } = await axios.post(
                    `${BACKEND_URL.replace(/\/$/, "")}/upload/presign`,
                    { name: sanitizeFileName(file.name), type: file.type, folder },
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
                xhr.timeout = computeTimeout(file.size);

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
                            `Upload timed out after ${Math.round(computeTimeout(file.size) / 1000)}s (file size: ${(file.size / 1e6).toFixed(1)}MB) — likely a slow or unstable connection.`
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
    if (isBlobUrl(thumbnailUrl)) {
        const response = await fetch(thumbnailUrl);
        const blob = await response.blob();
        const file = new File([blob], options.fileName || "thumbnail", { type: blob.type || "image/jpeg" });
        const publicUrl = await uploadToR2(file, options.folder, options.onProgress);
        return { url: publicUrl, mimeType: file.type, size: file.size, originalName: file.name };
    }
    if (!isDataUrl(thumbnailUrl)) {
        return { url: thumbnailUrl };
    }
    return uploadDataUrlToR2Cached(thumbnailUrl, options);
};

interface MultipartPart {
    partNumber: number;
    etag: string;
}

async function uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    blob: Blob,
    onPartProgress?: (loaded: number) => void,
): Promise<MultipartPart> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${MULTIPART_WORKER_URL}/multipart/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
        xhr.open("PUT", url);
        xhr.timeout = 120000;

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onPartProgress) onPartProgress(e.loaded);
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const { etag } = JSON.parse(xhr.responseText);
                resolve({ partNumber, etag });
            } else {
                reject(new Error(`Part ${partNumber} failed — status ${xhr.status}: ${xhr.responseText}`));
            }
        };
        xhr.onerror = () => reject(new Error(`Part ${partNumber} — network error`));
        xhr.ontimeout = () => reject(new Error(`Part ${partNumber} — timed out`));

        xhr.send(blob);
    });
}

async function uploadPartWithRetry(
    key: string,
    uploadId: string,
    partNumber: number,
    blob: Blob,
    onPartProgress?: (loaded: number) => void,
): Promise<MultipartPart> {
    let lastError: unknown;
    for (let attempt = 0; attempt < PART_MAX_RETRIES; attempt++) {
        try {
            return await uploadPart(key, uploadId, partNumber, blob, onPartProgress);
        } catch (err) {
            lastError = err;
            if (attempt < PART_MAX_RETRIES - 1) {
                await new Promise((r) => setTimeout(r, PART_RETRY_BASE_DELAY * Math.pow(2, attempt)));
            }
        }
    }
    throw new Error(`Part ${partNumber} failed after ${PART_MAX_RETRIES} attempts: ${(lastError as Error)?.message}`);
}

async function uploadToR2Multipart(
    file: File,
    folder = DEFAULT_UPLOAD_FOLDER,
    onProgress?: (percent: number) => void,
): Promise<string> {
    const key = `${folder.replace(/\/$/, "")}/${Date.now()}-${sanitizeFileName(file.name)}`;

    const createRes = await fetch(`${MULTIPART_WORKER_URL}/multipart/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
    });
    if (!createRes.ok) throw new Error(`Failed to start multipart upload: ${createRes.status}`);
    const { uploadId } = await createRes.json();

    const totalParts = Math.ceil(file.size / PART_SIZE);
    const parts: { partNumber: number; blob: Blob }[] = [];
    for (let i = 0; i < totalParts; i++) {
        const start = i * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        parts.push({ partNumber: i + 1, blob: file.slice(start, end) });
    }

    const loadedByPart = new Array(totalParts).fill(0);
    const reportProgress = () => {
        if (!onProgress) return;
        const totalLoaded = loadedByPart.reduce((a, b) => a + b, 0);
        onProgress(Math.round((totalLoaded / file.size) * 100));
    };

    try {
        const uploadedParts = await runWithConcurrency(parts, PART_CONCURRENCY, async ({ partNumber, blob }) => {
            const result = await uploadPartWithRetry(key, uploadId, partNumber, blob, (loaded) => {
                loadedByPart[partNumber - 1] = loaded;
                reportProgress();
            });
            loadedByPart[partNumber - 1] = blob.size;
            reportProgress();
            return result;
        });

        const completeRes = await fetch(`${MULTIPART_WORKER_URL}/multipart/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key,
                uploadId,
                parts: uploadedParts.sort((a, b) => a.partNumber - b.partNumber),
            }),
        });
        if (!completeRes.ok) throw new Error(`Failed to complete multipart upload: ${completeRes.status}`);
        const { publicUrl } = await completeRes.json();
        return publicUrl;
    } catch (err) {
        await fetch(`${MULTIPART_WORKER_URL}/multipart/abort`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, uploadId }),
        }).catch(() => {});
        throw err;
    }
}

export const uploadFileToR2 = async (file: File, options: R2UploadOptions): Promise<R2UploadResult> => {
    const useMultipart = file.size >= MULTIPART_THRESHOLD;
    console.log(`[R2Upload] file=${file.name} size=${(file.size / 1024 / 1024).toFixed(1)}MB threshold=${(MULTIPART_THRESHOLD / 1024 / 1024)}MB → ${useMultipart ? 'MULTIPART' : 'SINGLE-PUT'}`);
    const publicUrl = useMultipart
        ? await uploadToR2Multipart(file, options.folder, options.onProgress)
        : await uploadToR2(file, options.folder, options.onProgress);

    return { url: publicUrl, mimeType: file.type, size: file.size, originalName: file.name };
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

export async function runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const runNext = async (): Promise<void> => {
        const current = cursor++;
        if (current >= items.length) return;
        results[current] = await worker(items[current], current);
        return runNext();
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
    return results;
}