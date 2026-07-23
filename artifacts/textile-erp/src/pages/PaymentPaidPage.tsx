import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Toolbar } from "@/components/layout/Toolbar";
import { EntityTable } from "@/components/master/EntityTable";
import { PaginationFooter } from "@/components/master/PaginationFooter";
import { ConfirmDeleteDialog } from "@/components/master/ConfirmDeleteDialog";
import { useMasterData } from "@/hooks/useMasterData";
import { useToast } from "@/hooks/use-toast";
import { PaymentPaidForm } from "@/components/master/forms/PaymentPaidForm";
import {
  useListPaymentPaids,
  useGetPaymentPaid,
  useCreatePaymentPaid,
  useUpdatePaymentPaid,
  useDeletePaymentPaid,
  useListPurchaseParties,
  getListPaymentPaidsQueryKey,
  getGetPaymentPaidQueryKey,
  PaymentPaidInput,
  PaymentPaid,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function PaymentPaidPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm,
  } = useMasterData();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useListPaymentPaids({
    limit: pageSize,
    offset: page * pageSize,
  });

  const { data: fullRecord, isLoading: isLoadingRecord } = useGetPaymentPaid(
    selectedId ?? 0,
    {
      query: {
        queryKey: getGetPaymentPaidQueryKey(selectedId ?? 0),
        enabled: mode === "edit" && selectedId !== null,
      },
    }
  );

  const { data: partiesData } = useListPurchaseParties({ limit: 200 });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createPP = useCreatePaymentPaid();
  const updatePP = useUpdatePaymentPaid();
  const deletePP = useDeletePaymentPaid();

  // Build id→name map for list view
  const partyMap: Record<number, string> = Object.fromEntries(
    (partiesData?.rows ?? []).map((p) => [p.id, p.name])
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "F2") {
        e.preventDefault();
        startAdd();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Delete" && !isTyping && selectedId && mode === "idle") {
        e.preventDefault();
        setIsDeleteDialogOpen(true);
      } else if (e.key === "Escape" && !isTyping) {
        e.preventDefault();
        exitForm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, mode, startAdd, exitForm]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListPaymentPaidsQueryKey() });
    refetch();
    exitForm();
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: PaymentPaidInput) => {
    if (mode === "add") {
      createPP.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Payment Paid created." });
          queryClient.invalidateQueries({ queryKey: getListPaymentPaidsQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to create payment.",
            variant: "destructive",
          });
        },
      });
    } else if (mode === "edit" && selectedId) {
      updatePP.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Payment Paid updated." });
          queryClient.invalidateQueries({ queryKey: getListPaymentPaidsQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to update payment.",
            variant: "destructive",
          });
        },
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deletePP.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Payment Paid deleted." });
        queryClient.invalidateQueries({ queryKey: getListPaymentPaidsQueryKey() });
        setIsDeleteDialogOpen(false);
        exitForm();
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err?.message ?? "Failed to delete payment.",
          variant: "destructive",
        });
        setIsDeleteDialogOpen(false);
      },
    });
  };

  const isSaving = createPP.isPending || updatePP.isPending;
  const isDeleting = deletePP.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full w-full bg-background"
      data-testid="page-payment-paid"
    >
      <Header title="Payment Paid" />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <Breadcrumb items={["ERP", "Payments", "Payment Paid"]} />

        {/* Toolbar */}
        <Toolbar
          onRefresh={handleRefresh}
          onSave={mode === "add" ? handleSave : undefined}
          onUpdate={mode === "edit" ? handleSave : undefined}
          onDelete={() => setIsDeleteDialogOpen(true)}
          onExit={exitForm}
          canSave={mode === "add"}
          canUpdate={mode === "edit"}
          canDelete={!!selectedId && mode === "idle"}
          isSaving={isSaving}
          isDeleting={isDeleting}
        />

        {/* Shortcut hints */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">F2</kbd> New</span>
          <span><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Ctrl+S</kbd> Save</span>
          <span><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Del</kbd> Delete</span>
          <span><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Esc</kbd> Exit</span>
        </div>

        {/* List Table */}
        <EntityTable
          columns={[
            { key: "ppNumber", label: "Voucher No", width: "120px" },
            { key: "date", label: "Date", width: "110px" },
            {
              key: "purchasePartyId",
              label: "Purchase Party",
              render: (row: PaymentPaid) =>
                partyMap[row.purchasePartyId] ?? `#${row.purchasePartyId}`,
            },
            { key: "paymentMode", label: "Payment Mode", width: "120px",
              render: (row: PaymentPaid) => row.paymentMode ?? "—" },
            { key: "amount", label: "Amount", width: "110px",
              render: (row: PaymentPaid) => row.amount ?? "—" },
            {
              key: "remarks",
              label: "Remarks",
              render: (row: PaymentPaid) => row.remarks ?? "—",
            },
          ]}
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          isLoading={isLoading}
          selectedId={selectedId}
          onRowClick={(row) => startEdit(row.id)}
          emptyMessage="No payments found. Press F2 to create the first one."
        />

        <PaginationFooter
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />

        {/* Form Section */}
        {(mode === "add" || mode === "edit") && (
          <div
            className="bg-card border rounded-md p-4 shadow-sm shrink-0"
            data-testid="container-form-section"
          >
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-semibold text-base">
                {mode === "add" ? "New Payment Paid" : "Edit Payment Paid"}
              </h3>
              {mode === "edit" && isLoadingRecord && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {mode === "edit" && isLoadingRecord ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading record...</span>
              </div>
            ) : (
              <PaymentPaidForm
                voucherNo={mode === "edit" ? fullRecord?.ppNumber : undefined}
                initialData={mode === "edit" ? fullRecord : undefined}
                purchaseParties={partiesData?.rows ?? []}
                onSubmit={onSubmit}
              />
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        entityName="payment"
      />
    </div>
  );
}
