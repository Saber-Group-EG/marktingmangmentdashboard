import axiosInstance from "../axios";

export type PaymentLinkStatus = "active" | "paid" | "cancelled" | "expired";
export type PaymentMethod = "card" | "wallet";

export interface PaymentLink {
    _id: string;
    clientId?: string | { _id: string; personal?: { fullName?: string }; business?: { name?: string } };
    createdBy?: string | { _id: string; fullName?: string };
    amountCents: number;
    currency: string;
    paymentMethods?: PaymentMethod[];
    description?: string;
    customer?: { fullName?: string; email?: string; phone?: string };
    referenceId: string;
    url: string;
    status: PaymentLinkStatus;
    expiresAt?: string;
    paidAt?: string;
    cancelledAt?: string;
    failedAttempts?: number;
    createdAt: string;
}

export interface PaymentLinkInput {
    amount: number; // major units, e.g. 1500.5 EGP
    clientId?: string | null;
    paymentMethods: PaymentMethod[];
    description?: string;
    customer?: { fullName?: string; email?: string; phone?: string };
    expiresAt?: string | null;
}

export const getPaymentLinks = async (): Promise<PaymentLink[]> => {
    const response = await axiosInstance.get("/payment-links", {
        params: { PageCount: "all", sort: "-createdAt" },
    });
    return Array.isArray(response.data?.data) ? response.data.data : [];
};

// Payment methods the backend has a Paymob integration ID configured for
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const response = await axiosInstance.get("/payment-links/methods");
    return Array.isArray(response.data?.data) ? response.data.data : [];
};

export const createPaymentLink = async (data: PaymentLinkInput): Promise<PaymentLink> => {
    // Payment gateway round-trips can be slow — give it more than the default 10s
    const response = await axiosInstance.post("/payment-links", data, { timeout: 30000 });
    return response.data?.data as PaymentLink;
};

export const cancelPaymentLink = async (id: string): Promise<PaymentLink> => {
    // x-silent: the global interceptor would otherwise toast "Payment link added"
    const response = await axiosInstance.post(`/payment-links/${id}/cancel`, undefined, {
        timeout: 30000,
        headers: { "x-silent": "1" },
    });
    return response.data?.data as PaymentLink;
};
