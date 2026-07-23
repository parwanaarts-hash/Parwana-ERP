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
import { ReturnGatePassForm } from "@/components/master/forms/ReturnGatePassForm";
import {
  useListReturnGatePasses,
  useGetReturnGatePass,
  useCreateReturnGatePass,
  useUpdateReturnGatePass,
  useDeleteReturnGatePass,
  useListProducts,
  useListSaleParties,
  getListReturnGatePassesQueryKey,
  getGetReturnGatePassQueryKey,
  ReturnGatePassInput,
  ReturnGatePass,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function ReturnGatePassPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm,
  } = useMasterData();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useListReturnGatePasses({
    limit: pageSize,
    offset: page * pageSize,
  });

  const { data: fullRecord, isLoading: isLoadingRecord } = useGetReturnGatePass(
    selectedId ?? 0,
    {
      query: {
        queryKey: getGetReturnGatePassQueryKey(selectedId ?? 0),
        enabled: mode === "edit" && selectedId !== null,
      },
    }
  );

  const { data: productsData } = useListProducts({ limit: 200 });
  const { data: partiesData } = useListSaleParties({ limit: 200 });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createGP = useCreateReturnGatePass();
  const updateGP = useUpdateReturnGatePass();
  const deleteGP = useDeleteReturnGatePass();

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
    queryClient.invalidateQueries({ queryKey: getListReturnGatePassesQueryKey() });
    refetch();
    exitForm();
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: ReturnGatePassInput) => {
    if (mode === "add") {
      createGP.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Return Gate Pass created." });
          queryClient.invalidateQueries({ queryKey: getListReturnGatePassesQueryKey() });
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
          toast({ title: "Success", description: "Return Gate Pass updated." });
          queryClient.invalidateQueries({ queryKey: getListReturnGatePassesQueryKey() });
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
        toast({ title: "Success", description: "Return Gate Pass deleted." });
        queryClient.invalidateQueries({ queryKey: getListReturnGatePassesQueryKey() });
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
      data-testid="page-return-gate-pass"
    >
      <Header title="Return Gate Pass" />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <Breadcrumb items={["Stock", "Returns", "Gate Pass"]} />

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
            { key: "date", label: "Date", width: "110px" },
            {
              key: "salePartyId",
              label: "Sale Party",
              render: (row: ReturnGatePass) =>
                partyMap[row.salePartyId] ?? `#${row.salePartyId}`,
            },
            {
              key: "items",
              label: "Items",
              width: "60px",
              render: (row: ReturnGatePass) => String(row.items?.length ?? 0),
            },
            {
              key: "remarks",
              label: "Remarks",
              render: (row: ReturnGatePass) => row.remarks ?? "—",
            },
            {
              key: "returnBillId",
              label: "Bill #",
              width: "80px",
              render: (row: ReturnGatePass) =>
                row.returnBillId ? String(row.returnBillId) : "—",
            },
          ]}
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          isLoading={isLoading}
          selectedId={selectedId}
          onRowClick={(row) => startEdit(row.id)}
          emptyMessage="No return gate passes found. Press F2 to create the first one."
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
                {mode === "add" ? "New Return Gate Pass" : "Edit Return Gate Pass"}
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
              <ReturnGatePassForm
                gpNumber={mode === "edit" ? fullRecord?.gpNumber : undefined}
                initialData={mode === "edit" ? fullRecord : undefined}
                products={productsData?.rows ?? []}
                saleParties={partiesData?.rows ?? []}
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
