import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPaymentLinks, createPaymentLink, cancelPaymentLink } from "@/api/requests/paymentLinksService";

export const paymentLinksKeys = {
    all: ["payment-links"] as const,
    lists: () => [...paymentLinksKeys.all, "list"] as const,
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
