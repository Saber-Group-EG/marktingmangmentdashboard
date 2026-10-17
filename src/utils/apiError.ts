type ApiErrorShape = { response?: { data?: { message?: string; error?: { message?: string } } } };

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
    const shape = error as ApiErrorShape | null | undefined;
    const message = shape?.response?.data?.error?.message || shape?.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
};
