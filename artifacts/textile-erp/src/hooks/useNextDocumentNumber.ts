import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Document type strings — must match the server's DOCUMENT_TYPES values.
 */
export const DOC_TYPES = {
  PurchaseGatePass: "Purchase Gate Pass",
  SaleGatePass: "Sale Gate Pass",
  ReturnGatePass: "Return Gate Pass",
  PurchaseBill: "Purchase Bill",
  SalesBill: "Sales Bill",
  ReturnBill: "Return Bill",
  PaymentReceive: "Payment Receive",
  PaymentPaid: "Payment Paid",
} as const;

export type DocType = (typeof DOC_TYPES)[keyof typeof DOC_TYPES];

export function nextNumberQueryKey(documentType: DocType) {
  return ["number-series", "next", documentType] as const;
}

/**
 * Fetches the next document number that would be assigned for the given type,
 * WITHOUT reserving it (read-only preview).
 */
export function useNextDocumentNumber(documentType: DocType, enabled = true) {
  return useQuery({
    queryKey: nextNumberQueryKey(documentType),
    queryFn: async () => {
      const res = await fetch(
        `/api/number-series/next/${encodeURIComponent(documentType)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch next document number");
      const data = (await res.json()) as { nextNumber: string };
      return data.nextNumber;
    },
    enabled,
    staleTime: 0,
  });
}

/**
 * Returns a helper that invalidates a next-number query so the UI refreshes
 * after a document is saved.
 */
export function useInvalidateNextNumber() {
  const queryClient = useQueryClient();
  return (documentType: DocType) => {
    queryClient.invalidateQueries({ queryKey: nextNumberQueryKey(documentType) });
  };
}
