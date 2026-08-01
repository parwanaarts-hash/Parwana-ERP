import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Toolbar } from "@/components/layout/Toolbar";
import { SearchToolbar } from "@/components/master/SearchToolbar";
import { EntityTable } from "@/components/master/EntityTable";
import { PaginationFooter } from "@/components/master/PaginationFooter";
import { ConfirmDeleteDialog } from "@/components/master/ConfirmDeleteDialog";
import { useMasterData } from "@/hooks/useMasterData";
import { useToast } from "@/hooks/use-toast";
import { SalePartyForm } from "@/components/master/forms/SalePartyForm";
import { 
  useListSaleParties, useCreateSaleParty, useUpdateSaleParty, useDeleteSaleParty, 
  getListSalePartiesQueryKey, SalePartyInput, SaleParty 
} from "@workspace/api-client-react";

export default function SalePartiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { search, setSearch, page, setPage, pageSize, selectedId, mode, startAdd, startEdit, exitForm } = useMasterData();

  const [searchInput, setSearchInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const { data, isLoading, refetch } = useListSaleParties({ search: search || undefined, limit: pageSize, offset: page * pageSize });
  const createSaleParty = useCreateSaleParty();
  const updateSaleParty = useUpdateSaleParty();
  const deleteSaleParty = useDeleteSaleParty();

  const selectedRow = data?.rows?.find(r => r.id === selectedId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) { e.preventDefault(); handleRefresh(); }
      else if (e.key === 'Delete' && selectedId && mode === 'idle') { e.preventDefault(); setIsDeleteDialogOpen(true); }
      else if (e.key === 'Escape') { e.preventDefault(); exitForm(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, mode, exitForm]);

  const handleSearch = () => { setSearch(searchInput); setPage(0); };
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListSalePartiesQueryKey() });
    refetch();
    startAdd();
    setSearchInput("");
    setSearch("");
  };
  const handleSave = () => { const form = document.getElementById("entity-form") as HTMLFormElement; if (form) form.requestSubmit(); };

  const onSubmit = (formData: SalePartyInput) => {
    if (mode === 'add') {
      createSaleParty.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Sale Party created." });
          queryClient.invalidateQueries({ queryKey: getListSalePartiesQueryKey() });
          setFormKey(k => k + 1);
          startAdd();
        },
        onError: (err: any) => toast({ title: "Error", description: err.message || "Failed.", variant: "destructive" })
      });
    } else if (mode === 'edit' && selectedId) {
      updateSaleParty.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Sale Party updated." });
          queryClient.invalidateQueries({ queryKey: getListSalePartiesQueryKey() });
          setFormKey(k => k + 1);
          startAdd();
        },
        onError: (err: any) => toast({ title: "Error", description: err.message || "Failed.", variant: "destructive" })
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteSaleParty.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Sale Party deleted." });
        queryClient.invalidateQueries({ queryKey: getListSalePartiesQueryKey() });
        setIsDeleteDialogOpen(false);
        setFormKey(k => k + 1);
        startAdd();
      },
      onError: (err: any) => { toast({ title: "Error", description: err.message || "Failed.", variant: "destructive" }); setIsDeleteDialogOpen(false); }
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-background" data-testid="page-sale-parties">
      <Header title="Sale Parties" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 relative">
        <Breadcrumb items={["Stock", "Add", "Sale Parties"]} />
        <Toolbar 
          onRefresh={handleRefresh}
          onSave={mode === 'add' ? handleSave : undefined}
          onUpdate={mode === 'edit' ? handleSave : undefined}
          onDelete={() => setIsDeleteDialogOpen(true)}
          onExit={exitForm}
          canSave={mode === 'add'}
          canUpdate={mode === 'edit'}
          canDelete={!!selectedId && mode === 'edit'}
          isSaving={createSaleParty.isPending || updateSaleParty.isPending}
          isDeleting={deleteSaleParty.isPending}
        />
        <SearchToolbar value={searchInput} onChange={setSearchInput} onSearch={handleSearch} placeholder="Search sale parties..." />
        <EntityTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name / بنام' },
            { key: 'phone', label: 'Phone' },
            { key: 'city', label: 'City' },
            { key: 'creditLimit', label: 'Credit Limit' },
            { key: 'openingBalance', label: 'Opening Balance' },
          ]}
          rows={data?.rows || []} total={data?.total || 0} isLoading={isLoading} selectedId={selectedId}
          onRowClick={(row) => startEdit(row.id)}
        />
        <PaginationFooter page={page} pageSize={pageSize} total={data?.total || 0} onPageChange={setPage} />
        <div className="bg-card border rounded-md p-4 shadow-sm shrink-0">
          <h3 className="font-semibold text-lg mb-4">{mode === 'edit' ? 'Edit Sale Party' : 'New Sale Party'}</h3>
          <SalePartyForm
            key={formKey}
            initialData={mode === 'edit' && selectedRow ? {
              name: selectedRow.name,
              phone: selectedRow.phone ?? undefined,
              city: selectedRow.city ?? undefined,
              address: selectedRow.address ?? undefined,
              creditLimit: selectedRow.creditLimit ?? undefined,
              openingBalance: selectedRow.openingBalance ?? undefined,
            } : undefined}
            onSubmit={onSubmit}
          />
        </div>
      </div>
      <ConfirmDeleteDialog open={isDeleteDialogOpen} onCancel={() => setIsDeleteDialogOpen(false)} onConfirm={handleDelete} isDeleting={deleteSaleParty.isPending} entityName="sale party" />
    </div>
  );
}
