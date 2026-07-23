import { useCallback, useEffect, useState } from "react";
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
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Reset dirty flag whenever form closes
  useEffect(() => {
    if (mode === "idle") setIsFormDirty(false);
  }, [mode]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useListPurchaseGatePasses({
    limit: pageSize,
    offset: page * pageSize,
  });

  const { data: fullRecord, isLoading: isLoadingRecord } = useGetPurchaseGatePass(
    selectedId ?? 0,
    {
      query: {
        queryKey: getGetPurchaseGatePassQueryKey(selectedId ?? 0),
        enabled: mode === "edit" && selectedId !== null,
      },
    }
  );

  const { data: productsData } = useListProducts({ limit: 500 });
  const { data: partiesData } = useListPurchaseParties({ limit: 200 });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createGP = useCreatePurchaseGatePass();
  const updateGP = useUpdatePurchaseGatePass();
  const deleteGP = useDeletePurchaseGatePass();

  const partyMap: Record<number, string> = Object.fromEntries(
    (partiesData?.rows ?? []).map(p => [p.id, p.name])
  );

  // ── Exit with dirty guard ─────────────────────────────────────────────────
  const handleExit = useCallback(() => {
    if (isFormDirty) {
      if (!window.confirm("You have unsaved changes. Exit without saving?")) return;
    }
    setIsFormDirty(false);
    exitForm();
  }, [isFormDirty, exitForm]);

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
        handleExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, mode, startAdd, handleExit]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRefresh = () => {
    if (isFormDirty && !window.confirm("You have unsaved changes. Refresh anyway?")) return;
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
  const inForm = mode === "add" || mode === "edit";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full w-full bg-background"
      data-testid="page-purchase-gate-pass"
    >
      <Header title="Purchase Gate Pass / خریداری گیٹ پاس" />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        <Breadcrumb items={["Stock", "Purchase", "Gate Pass"]} />

        {/* Toolbar */}
        <Toolbar
          onRefresh={handleRefresh}
          onSave={mode === "add" ? handleSave : undefined}
          onUpdate={mode === "edit" ? handleSave : undefined}
          onDelete={() => setIsDeleteDialogOpen(true)}
          onExit={handleExit}
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
          {isFormDirty && (
            <span className="text-amber-600 font-medium">● Unsaved changes</span>
          )}
        </div>

        {/* List Table — compact when form is open */}
        <div
          className={`transition-all duration-200 ${inForm ? "max-h-44 overflow-hidden rounded-md" : ""}`}
        >
          <EntityTable
            columns={[
              { key: "gpNumber", label: "GP #", width: "90px" },
              { key: "date", label: "Date", width: "105px" },
              {
                key: "purchasePartyId",
                label: "Party",
                render: (row: PurchaseGatePass) =>
                  partyMap[row.purchasePartyId] ?? `#${row.purchasePartyId}`,
              },
              { key: "lotNumber", label: "Lot #", width: "105px" },
              {
                key: "items",
                label: "Items",
                width: "60px",
                render: (row: PurchaseGatePass) => String(row.items?.length ?? 0),
              },
              {
                key: "remarks",
                label: "Remarks",
                render: (row: PurchaseGatePass) => row.remarks ?? "–",
              },
              {
                key: "purchaseBillId",
                label: "Bill #",
                width: "72px",
                render: (row: PurchaseGatePass) =>
                  row.purchaseBillId ? String(row.purchaseBillId) : "–",
              },
            ]}
            rows={data?.rows ?? []}
            total={data?.total ?? 0}
            isLoading={isLoading}
            selectedId={selectedId}
            onRowClick={row => startEdit(row.id)}
            emptyMessage="No gate passes found. Press F2 to create the first one."
          />
        </div>

        <PaginationFooter
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />

        {/* Form Section */}
        {inForm && (
          <div
            className="bg-card border rounded-md shadow-sm overflow-hidden"
            data-testid="container-form-section"
          >
            {/* Form card header */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/10">
              <h3 className="font-semibold text-sm">
                {mode === "add"
                  ? "New Purchase Gate Pass / نیا گیٹ پاس"
                  : "Edit Purchase Gate Pass / ترمیم"}
              </h3>
              {mode === "edit" && isLoadingRecord && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {mode === "edit" && isLoadingRecord ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading record…</span>
              </div>
            ) : (
              <PurchaseGatePassForm
                gpNumber={mode === "edit" ? fullRecord?.gpNumber : undefined}
                initialData={mode === "edit" ? fullRecord : undefined}
                products={productsData?.rows ?? []}
                purchaseParties={partiesData?.rows ?? []}
                onSubmit={onSubmit}
                onDirtyChange={setIsFormDirty}
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
