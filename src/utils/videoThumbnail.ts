const THUMBNAIL_TIMEOUT_MS = 12000;

/**
 * Grabs a frame from a local video file as a JPEG data URL.
 * Resolves with an empty string when the browser cannot decode the file
 * (unsupported codec, CORS-less blob, etc.) so callers can skip the thumbnail.
 */
export const captureVideoThumbnail = (file: File): Promise<string> =>
    new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        let settled = false;
        let timeoutId = 0;

        const finish = (result: string) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            video.removeEventListener("loadeddata", handleLoadedData);
            video.removeEventListener("seeked", grabFrame);
            video.removeEventListener("error", handleError);
            video.removeAttribute("src");
            video.load();
            URL.revokeObjectURL(objectUrl);
            resolve(result);
        };

        const grabFrame = () => {
            try {
                canvas.width = video.videoWidth || 480;
                canvas.height = video.videoHeight || 844;
                const context = canvas.getContext("2d");
                if (!context) {
                    finish("");
                    return;
                }
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                finish(canvas.toDataURL("image/jpeg", 0.8));
            } catch {
                finish("");
            }
        };

        const handleLoadedData = () => {
            const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
            video.currentTime = Math.max(0.1, Math.min(1, duration / 2));
        };

        const handleError = () => finish("");

        timeoutId = window.setTimeout(() => finish(""), THUMBNAIL_TIMEOUT_MS);
        video.addEventListener("loadeddata", handleLoadedData);
        video.addEventListener("seeked", grabFrame);
        video.addEventListener("error", handleError);
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.src = objectUrl;
    });
