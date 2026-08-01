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
import { SalesBillForm } from "@/components/master/forms/SalesBillForm";
import { useNextDocumentNumber, DOC_TYPES, nextNumberQueryKey } from "@/hooks/useNextDocumentNumber";
import {
  useListSalesBills,
  useGetSalesBill,
  useCreateSalesBill,
  useUpdateSalesBill,
  useDeleteSalesBill,
  useListSaleParties,
  useListSaleGatePasses,
  useListProducts,
  getListSalesBillsQueryKey,
  getGetSalesBillQueryKey,
  SalesBillInput,
  SalesBill,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function SalesBillPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { page, setPage, pageSize, selectedId, mode, startAdd, startEdit, exitForm } = useMasterData();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useListSalesBills({ limit: pageSize, offset: page * pageSize });
  const { data: fullRecord, isLoading: isLoadingRecord } = useGetSalesBill(
    selectedId ?? 0,
    { query: { queryKey: getGetSalesBillQueryKey(selectedId ?? 0), enabled: mode === "edit" && selectedId !== null } }
  );
  const { data: nextNumber } = useNextDocumentNumber(DOC_TYPES.SalesBill);
  const { data: partiesData } = useListSaleParties({ limit: 200 });
  const { data: productsData } = useListProducts({ limit: 200 });
  const { data: allGatePassesData } = useListSaleGatePasses({ limit: 500 });

  const createBill = useCreateSalesBill();
  const updateBill = useUpdateSalesBill();
  const deleteBill = useDeleteSalesBill();

  const partyMap: Record<number, string> = Object.fromEntries((partiesData?.rows ?? []).map(p => [p.id, p.name]));
  const invalidateNextNumber = () =>
    queryClient.invalidateQueries({ queryKey: nextNumberQueryKey(DOC_TYPES.SalesBill) });

  const allGatePasses = allGatePassesData?.rows ?? [];
  const availableGatePasses = mode === "edit" && selectedId
    ? allGatePasses.filter(gp => gp.salesBillId == null || gp.salesBillId === selectedId)
    : allGatePasses.filter(gp => gp.salesBillId == null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); handleSave(); }
      else if (e.key === "Delete" && !isTyping && selectedId && mode === "idle") { e.preventDefault(); setIsDeleteDialogOpen(true); }
      else if (e.key === "Escape" && !isTyping) { e.preventDefault(); exitForm(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, mode, exitForm]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListSalesBillsQueryKey() });
    invalidateNextNumber();
    refetch();
    startAdd();
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: SalesBillInput) => {
    if (mode === "add") {
      createBill.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Sales Bill created." });
          queryClient.invalidateQueries({ queryKey: getListSalesBillsQueryKey() });
          invalidateNextNumber();
          startAdd();
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message ?? "Failed to create sales bill.", variant: "destructive" }),
      });
    } else if (mode === "edit" && selectedId) {
      updateBill.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Sales Bill updated." });
          queryClient.invalidateQueries({ queryKey: getListSalesBillsQueryKey() });
          invalidateNextNumber();
          startAdd();
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message ?? "Failed to update sales bill.", variant: "destructive" }),
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteBill.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Sales Bill deleted." });
        queryClient.invalidateQueries({ queryKey: getListSalesBillsQueryKey() });
        invalidateNextNumber();
        setIsDeleteDialogOpen(false);
        startAdd();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message ?? "Failed to delete sales bill.", variant: "destructive" });
        setIsDeleteDialogOpen(false);
      },
    });
  };

  const isSaving = createBill.isPending || updateBill.isPending;
  const isDeleting = deleteBill.isPending;

  return (
    <div className="flex flex-col h-full w-full bg-background" data-testid="page-sales-bill">
      <Header title="Sales Bill" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <Breadcrumb items={["ERP", "Sales", "Sales Bill"]} />
        <Toolbar
          onRefresh={handleRefresh}
          onSave={mode === "add" ? handleSave : undefined}
          onUpdate={mode === "edit" ? handleSave : undefined}
          onDelete={() => setIsDeleteDialogOpen(true)}
          onExit={exitForm}
          canSave={mode === "add"}
          canUpdate={mode === "edit"}
          canDelete={!!selectedId && mode === "edit"}
          isSaving={isSaving}
          isDeleting={isDeleting}
        />
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Ctrl+S</kbd> Save</span>
          <span><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Del</kbd> Delete</span>
          <span><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Esc</kbd> Exit</span>
        </div>
        <div className="max-h-44 overflow-hidden rounded-md">
          <EntityTable
            columns={[
              { key: "billNumber", label: "Bill No", width: "110px" },
              { key: "billDate", label: "Date", width: "110px" },
              { key: "salePartyId", label: "Sale Party", render: (row: SalesBill) => partyMap[row.salePartyId] ?? `#${row.salePartyId}` },
              { key: "billType", label: "Bill Type", width: "90px", render: (row: SalesBill) => row.billType ?? "—" },
              { key: "cashPayment", label: "Cash Payment", width: "110px", render: (row: SalesBill) => row.cashPayment ?? "—" },
              { key: "bankPayment", label: "Bank Payment", width: "110px", render: (row: SalesBill) => row.bankPayment ?? "—" },
              { key: "remarks", label: "Remarks", render: (row: SalesBill) => row.remarks ?? "—" },
              { key: "gatePassIds", label: "Linked Gate Passes", width: "145px", render: (row: SalesBill) => row.gatePassIds && row.gatePassIds.length > 0 ? `${row.gatePassIds.length} gate pass${row.gatePassIds.length > 1 ? "es" : ""}` : "—" },
            ]}
            rows={data?.rows ?? []} total={data?.total ?? 0} isLoading={isLoading} selectedId={selectedId}
            onRowClick={(row) => startEdit(row.id)} emptyMessage="No sales bills found."
          />
        </div>
        <PaginationFooter page={page} pageSize={pageSize} total={data?.total ?? 0} onPageChange={setPage} />
        <div className="bg-card border rounded-md p-4 shadow-sm shrink-0" data-testid="container-form-section">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-semibold text-base">{mode === "edit" ? "Edit Sales Bill" : "New Sales Bill"}</h3>
            {mode === "edit" && isLoadingRecord && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {mode === "edit" && isLoadingRecord ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading record...</span>
            </div>
          ) : (
            <SalesBillForm
              key={mode === "add" ? "new" : selectedId}
              billNumber={mode === "edit" ? fullRecord?.billNumber : nextNumber}
              initialData={mode === "edit" ? fullRecord : undefined}
              saleParties={partiesData?.rows ?? []}
              availableGatePasses={availableGatePasses}
              products={productsData?.rows ?? []}
              onSubmit={onSubmit}
            />
          )}
        </div>
      </div>
      <ConfirmDeleteDialog open={isDeleteDialogOpen} onCancel={() => setIsDeleteDialogOpen(false)} onConfirm={handleDelete} isDeleting={isDeleting} entityName="sales bill" />
    </div>
  );
}
