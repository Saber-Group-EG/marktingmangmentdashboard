import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { showToast } from "../utils/swal";

// Helper to get cookie value
const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
};

// Helper to get token (cookie first, fallback to localStorage)
export const getStoredToken = (name: string): string | null => {
    const cookieVal = getCookie(name);
    if (cookieVal) return decodeURIComponent(cookieVal);

    try {
        const local = localStorage.getItem(name);
        if (local) return local;
    } catch {
        // ignore storage errors
    }

    return null;
};

// Create axios instance with base configuration
const axiosInstance = axios.create({
    baseURL: "https://marketing-planner-tau.vercel.app/api/v1",
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 20000, // 20 seconds - backend cold starts can exceed 10s
    maxRedirects: 5,
    decompress: true,
});

// Internal per-request flags used by the response interceptor.
type RequestFlags = {
    _retry?: boolean;
    _retryWithoutPopulate?: boolean;
    _isRefreshRequest?: boolean;
};
type FlaggedRequestConfig = InternalAxiosRequestConfig & RequestFlags;

// Initialize default Authorization header from stored token (cookie or localStorage)
try {
    const initToken = getStoredToken("accessToken");
    if (initToken) {
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${initToken}`;
    }
} catch {
    // ignore
}

// Request interceptor (for adding auth tokens)
axiosInstance.interceptors.request.use(
    (config) => {
        // For DELETE requests, ensure no body is sent
        if (config.method === 'delete') {
            // Remove any data that might be accidentally attached
            delete config.data;
            config.data = undefined;
            
            // Also remove any content-type header for DELETE with no body
            if (config.headers['Content-Type'] && !config.data) {
                // Keep the header, it's fine
            }
        }
        
        // Your existing code...
        const publicEndpoints = ["/auth/login", "/auth/register"];
        const isPublicEndpoint = publicEndpoints.some((endpoint) => config.url?.includes(endpoint));

        if (!isPublicEndpoint) {
            const token = getStoredToken("accessToken");
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }

        if (!config.headers["Content-Type"]) {
            config.headers["Content-Type"] = "application/json";
        }

        Object.keys(config.headers).forEach((key) => {
            if (config.headers[key] === undefined || config.headers[key] === null) {
                delete config.headers[key];
            }
        });

        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Track if we're currently refreshing to avoid multiple refresh requests
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (reason: unknown) => void }> = [];

const processQueue = (error: unknown = null, token: string | null = null): void => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token ?? "");
        }
    });
    failedQueue = [];
};

// Full auth teardown: cookies AND localStorage (remember-me), then redirect.
// localStorage must go too, otherwise the Layout guard re-mounts protected
// routes in a loop after a failed refresh.
const hardLogout = (): void => {
    document.cookie = "accessToken=; Path=/; Max-Age=0";
    document.cookie = "refreshToken=; Path=/; Max-Age=0";
    try {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("auth-user");
    } catch {
        // ignore storage errors
    }

    if (!window.location.pathname.includes("/auth/login")) {
        console.warn("⚠️ Redirecting to login page");
        window.location.href = "/auth/login";
    }
};

// Response interceptor (for handling errors globally)
axiosInstance.interceptors.response.use(
    (response) => {
        try {
            const method = (response.config?.method || "").toLowerCase();
            // Only show success toast for mutating operations
            if (["post", "put", "patch", "delete"].includes(method)) {
                // Skip toast for silent requests (e.g. background reorder calls)
                if (response.config?.headers?.["x-silent"]) {
                    return response;
                }
                const url = response.config?.url || "";
                const firstSegment = url.split("/").filter(Boolean)[0] || "item";
                // Make a readable resource name: replace dashes/underscores, singularize simple plural
                let resourceName = firstSegment.replace(/[-_]/g, " ");
                if (resourceName.endsWith("s")) resourceName = resourceName.slice(0, -1);
                resourceName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);

                let action = "updated";
                if (method === "post") action = "added";
                else if (method === "delete") action = "deleted";

                try {
                    showToast(`${resourceName} ${action} successfully`, "success");
                } catch (err) {
                    // swallow errors from UI helper to avoid breaking API flow
                    console.warn("swal showToast failed:", err);
                }
            }
        } catch {
            // ignore any parsing errors here
        }

        return response;
    },
    async (error) => {
        const originalRequest = error.config as FlaggedRequestConfig;

        // Handle common errors
        if (error.response) {
            // Only log in development - using import.meta.env instead of process.env
            if (import.meta.env.DEV) {
                console.error("❌ API Error:", error.response.status, error.config?.url);
            }

            // Handle backend populate errors (e.g., "Cannot populate path `quotations.services`")
            // This happens when the backend tries to populate a removed field
            if (error.response.status === 500 && !originalRequest._retryWithoutPopulate) {
                const errorMessage = error.response.data?.error?.message || error.response.data?.message || "";
                if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("populate")) {
                    console.warn("⚠️ Backend populate error detected, retrying without populate params:", errorMessage);
                    originalRequest._retryWithoutPopulate = true;

                    // Remove populate from query params
                    if (originalRequest.params) {
                        const restParams = { ...originalRequest.params };
                        delete restParams.populate;
                        originalRequest.params = restParams;
                    }

                    return axiosInstance(originalRequest);
                }
            }

            // Handle 401 authentication errors
            if (error.response.status === 401 && !originalRequest._retry) {
                // The refresh call itself was rejected (e.g. refresh token
                // expired). Reject immediately so the outer catch always runs —
                // queueing it behind `isRefreshing` would deadlock every
                // pending request forever.
                if (originalRequest._isRefreshRequest) {
                    return Promise.reject(error);
                }

                if (isRefreshing) {
                    // A refresh is already in flight: queue this request
                    return new Promise<string>((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then((token) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            return axiosInstance(originalRequest);
                        })
                        .catch((err) => {
                            return Promise.reject(err);
                        });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                const refreshToken = getCookie("refreshToken");

                if (!refreshToken) {
                    // No way to recover: tear the session down completely
                    console.warn("⚠️ No refresh token found - logging out");
                    processQueue(error, null);
                    isRefreshing = false;
                    hardLogout();
                    return Promise.reject(error);
                }

                try {
                    const refreshConfig: AxiosRequestConfig & RequestFlags = { _isRefreshRequest: true };
                    const response = await axiosInstance.post(
                        "/auth/refresh",
                        { refreshToken: decodeURIComponent(refreshToken) },
                        refreshConfig,
                    );

                    const { accessToken, refreshToken: newRefreshToken } = response.data;

                    // Update cookies with new tokens and localStorage (for remember-me)
                    const setCookie = (name: string, value: string, days: number) => {
                        const maxAge = days * 24 * 60 * 60;
                        document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
                    };
                    setCookie("accessToken", accessToken, 1);
                    setCookie("refreshToken", newRefreshToken, 7);
                    try {
                        localStorage.setItem("accessToken", accessToken);
                        localStorage.setItem("refreshToken", newRefreshToken);
                    } catch {
                        // ignore
                    }

                    // Update authorization header
                    axiosInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;

                    processQueue(null, accessToken);

                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    console.error("❌ Token refresh failed:", refreshError);
                    processQueue(refreshError, null);
                    hardLogout();
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }
        } else if (error.request) {
            // Only log in development and ignore canceled requests
            const isCanceled = error.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.message === "canceled";
            if (!isCanceled && import.meta.env.DEV) {
                console.error("❌ Network Error:", error.message);
            }
        }
        return Promise.reject(error);
    },
);

export default axiosInstance;