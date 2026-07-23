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
import { PurchaseGatePassForm } from "@/components/master/forms/PurchaseGatePassForm";
import {
  useListPurchaseGatePasses,
  useGetPurchaseGatePass,
  useCreatePurchaseGatePass,
  useUpdatePurchaseGatePass,
  useDeletePurchaseGatePass,
  useListProducts,
  useListPurchaseParties,
  getListPurchaseGatePassesQueryKey,
  getGetPurchaseGatePassQueryKey,
  PurchaseGatePassInput,
  PurchaseGatePass,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function PurchaseGatePassPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm,
  } = useMasterData();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useListPurchaseGatePasses({
    limit: pageSize,
    offset: page * pageSize,
  });

  // Full record with items loaded when entering edit mode
  const { data: fullRecord, isLoading: isLoadingRecord } = useGetPurchaseGatePass(
    selectedId ?? 0,
    {
      query: {
        queryKey: getGetPurchaseGatePassQueryKey(selectedId ?? 0),
        enabled: mode === "edit" && selectedId !== null,
      },
    }
  );

  // Lookup lists for form dropdowns – fetch once (large limit)
  const { data: productsData } = useListProducts({ limit: 200 });
  const { data: partiesData } = useListPurchaseParties({ limit: 200 });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createGP = useCreatePurchaseGatePass();
  const updateGP = useUpdatePurchaseGatePass();
  const deleteGP = useDeletePurchaseGatePass();

  // Build a quick id→name map for the list view
  const partyMap: Record<number, string> = Object.fromEntries(
    (partiesData?.rows ?? []).map((p) => [p.id, p.name])
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts while user is typing in an input/select/textarea
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
    queryClient.invalidateQueries({ queryKey: getListPurchaseGatePassesQueryKey() });
    refetch();
    exitForm();
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: PurchaseGatePassInput) => {
    if (mode === "add") {
      createGP.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase Gate Pass created." });
          queryClient.invalidateQueries({ queryKey: getListPurchaseGatePassesQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to create gate pass.",
            variant: "destructive",
          });
        },
      });
    } else if (mode === "edit" && selectedId) {
      updateGP.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase Gate Pass updated." });
          queryClient.invalidateQueries({ queryKey: getListPurchaseGatePassesQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to update gate pass.",
            variant: "destructive",
          });
        },
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteGP.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Purchase Gate Pass deleted." });
        queryClient.invalidateQueries({ queryKey: getListPurchaseGatePassesQueryKey() });
        setIsDeleteDialogOpen(false);
        exitForm();
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err?.message ?? "Failed to delete gate pass.",
          variant: "destructive",
        });
        setIsDeleteDialogOpen(false);
      },
    });
  };

  const isSaving = createGP.isPending || updateGP.isPending;
  const isDeleting = deleteGP.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full w-full bg-background"
      data-testid="page-purchase-gate-pass"
    >
      <Header title="Purchase Gate Pass / خریداری گیٹ پاس" />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <Breadcrumb items={["Stock", "Purchase", "Gate Pass"]} />

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
            { key: "gpNumber", label: "GP #", width: "100px" },
            { key: "date", label: "Date / تاریخ", width: "110px" },
            {
              key: "purchasePartyId",
              label: "Party / فریق",
              render: (row: PurchaseGatePass) =>
                partyMap[row.purchasePartyId] ?? `#${row.purchasePartyId}`,
            },
            { key: "lotNumber", label: "Lot # / لاٹ", width: "110px" },
            {
              key: "items",
              label: "Items",
              width: "70px",
              render: (row: PurchaseGatePass) =>
                String(row.items?.length ?? 0),
            },
            {
              key: "remarks",
              label: "Remarks / ریمارکس",
              render: (row: PurchaseGatePass) => row.remarks ?? "–",
            },
            {
              key: "purchaseBillId",
              label: "Bill #",
              width: "80px",
              render: (row: PurchaseGatePass) =>
                row.purchaseBillId ? String(row.purchaseBillId) : "–",
            },
          ]}
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          isLoading={isLoading}
          selectedId={selectedId}
          onRowClick={(row) => startEdit(row.id)}
          emptyMessage="No gate passes found. Press F2 to create the first one."
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
                {mode === "add"
                  ? "New Purchase Gate Pass / نیا گیٹ پاس"
                  : "Edit Purchase Gate Pass / ترمیم"}
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
              <PurchaseGatePassForm
                gpNumber={mode === "edit" ? fullRecord?.gpNumber : undefined}
                initialData={mode === "edit" ? fullRecord : undefined}
                products={productsData?.rows ?? []}
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
        entityName="gate pass"
      />
    </div>
  );
}
