import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPaymentLinks, getPaymentMethods, createPaymentLink, cancelPaymentLink } from "@/api/requests/paymentLinksService";

export const paymentLinksKeys = {
    all: ["payment-links"] as const,
    lists: () => [...paymentLinksKeys.all, "list"] as const,
    methods: () => [...paymentLinksKeys.all, "methods"] as const,
};

export const usePaymentMethods = () => {
    return useQuery({
        queryKey: paymentLinksKeys.methods(),
        queryFn: getPaymentMethods,
        staleTime: 10 * 60 * 1000,
    });
};

export const usePaymentLinks = () => {
    return useQuery({
        queryKey: paymentLinksKeys.lists(),
        queryFn: getPaymentLinks,
        // Payments land via webhook — poll so "paid" shows up without a manual refresh
        refetchInterval: 30000,
    });
};

export const useCreatePaymentLink = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPaymentLink,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: paymentLinksKeys.lists() });
        },
    });
};

export const useCancelPaymentLink = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: cancelPaymentLink,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: paymentLinksKeys.lists() });
        },
    });
};
