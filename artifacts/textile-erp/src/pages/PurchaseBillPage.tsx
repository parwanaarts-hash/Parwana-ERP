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
import { PurchaseBillForm } from "@/components/master/forms/PurchaseBillForm";
import {
  useListPurchaseBills,
  useGetPurchaseBill,
  useCreatePurchaseBill,
  useUpdatePurchaseBill,
  useDeletePurchaseBill,
  useListPurchaseParties,
  useListPurchaseGatePasses,
  useListProducts,
  getListPurchaseBillsQueryKey,
  getGetPurchaseBillQueryKey,
  PurchaseBillInput,
  PurchaseBill,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function PurchaseBillPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm,
  } = useMasterData();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useListPurchaseBills({
    limit: pageSize,
    offset: page * pageSize,
  });

  // Full record with items and gatePassIds – loaded when entering edit mode
  const { data: fullRecord, isLoading: isLoadingRecord } = useGetPurchaseBill(
    selectedId ?? 0,
    {
      query: {
        queryKey: getGetPurchaseBillQueryKey(selectedId ?? 0),
        enabled: mode === "edit" && selectedId !== null,
      },
    }
  );

  // Purchase parties for list labels and form dropdown
  const { data: partiesData } = useListPurchaseParties({ limit: 200 });

  // Products for items display inside the form
  const { data: productsData } = useListProducts({ limit: 200 });

  // All gate passes – used to build the selection list
  // In add mode we only want unlinked ones; in edit mode we also want those
  // linked to THIS bill, so we fetch without the unlinkedOnly flag and filter in the UI.
  const { data: allGatePassesData } = useListPurchaseGatePasses({ limit: 500 });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createBill = useCreatePurchaseBill();
  const updateBill = useUpdatePurchaseBill();
  const deleteBill = useDeletePurchaseBill();

  // Build a quick id→name map for the list view
  const partyMap: Record<number, string> = Object.fromEntries(
    (partiesData?.rows ?? []).map((p) => [p.id, p.name])
  );

  // Gate passes available for the form:
  // - Add mode  → only unlinked (purchaseBillId is null/undefined)
  // - Edit mode → unlinked OR linked to the current bill being edited
  const allGatePasses = allGatePassesData?.rows ?? [];
  const availableGatePasses =
    mode === "edit" && selectedId
      ? allGatePasses.filter(
          (gp) =>
            gp.purchaseBillId == null ||
            gp.purchaseBillId === selectedId
        )
      : allGatePasses.filter((gp) => gp.purchaseBillId == null);

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
    queryClient.invalidateQueries({ queryKey: getListPurchaseBillsQueryKey() });
    refetch();
    exitForm();
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: PurchaseBillInput) => {
    if (mode === "add") {
      createBill.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase Bill created." });
          queryClient.invalidateQueries({ queryKey: getListPurchaseBillsQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to create purchase bill.",
            variant: "destructive",
          });
        },
      });
    } else if (mode === "edit" && selectedId) {
      updateBill.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase Bill updated." });
          queryClient.invalidateQueries({ queryKey: getListPurchaseBillsQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to update purchase bill.",
            variant: "destructive",
          });
        },
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteBill.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Purchase Bill deleted." });
        queryClient.invalidateQueries({ queryKey: getListPurchaseBillsQueryKey() });
        setIsDeleteDialogOpen(false);
        exitForm();
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err?.message ?? "Failed to delete purchase bill.",
          variant: "destructive",
        });
        setIsDeleteDialogOpen(false);
      },
    });
  };

  const isSaving = createBill.isPending || updateBill.isPending;
  const isDeleting = deleteBill.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full w-full bg-background"
      data-testid="page-purchase-bill"
    >
      <Header title="Purchase Bill" />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <Breadcrumb items={["ERP", "Purchase", "Purchase Bill"]} />

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
            { key: "billNumber", label: "Bill No", width: "100px" },
            { key: "billDate", label: "Date", width: "110px" },
            {
              key: "purchasePartyId",
              label: "Purchase Party",
              render: (row: PurchaseBill) =>
                partyMap[row.purchasePartyId] ?? `#${row.purchasePartyId}`,
            },
            {
              key: "billAmount",
              label: "Bill Amount",
              width: "120px",
              render: (row: PurchaseBill) => row.billAmount ?? "—",
            },
            {
              key: "remarks",
              label: "Remarks",
              render: (row: PurchaseBill) => row.remarks ?? "—",
            },
            {
              key: "gatePassIds",
              label: "Linked Gate Passes",
              width: "140px",
              render: (row: PurchaseBill) =>
                row.gatePassIds && row.gatePassIds.length > 0
                  ? `${row.gatePassIds.length} gate pass${row.gatePassIds.length > 1 ? "es" : ""}`
                  : "—",
            },
          ]}
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          isLoading={isLoading}
          selectedId={selectedId}
          onRowClick={(row) => startEdit(row.id)}
          emptyMessage="No purchase bills found. Press F2 to create the first one."
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
                {mode === "add" ? "New Purchase Bill" : "Edit Purchase Bill"}
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
              <PurchaseBillForm
                billNumber={mode === "edit" ? fullRecord?.billNumber : undefined}
                initialData={mode === "edit" ? fullRecord : undefined}
                purchaseParties={partiesData?.rows ?? []}
                availableGatePasses={availableGatePasses}
                products={productsData?.rows ?? []}
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
        entityName="purchase bill"
      />
    </div>
  );
}
