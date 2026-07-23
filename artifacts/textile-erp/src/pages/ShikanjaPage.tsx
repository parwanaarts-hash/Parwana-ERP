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
import { ShikanjaForm } from "@/components/master/forms/ShikanjaForm";
import { 
  useListShikanja, useCreateShikanja, useUpdateShikanja, useDeleteShikanja, 
  getListShikanjaQueryKey, ShikanjaInput, Shikanja 
} from "@workspace/api-client-react";

export default function ShikanjaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const {
    search, setSearch, page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm
  } = useMasterData();

  const [searchInput, setSearchInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useListShikanja({ search: search || undefined, limit: pageSize, offset: page * pageSize });
  const createShikanja = useCreateShikanja();
  const updateShikanja = useUpdateShikanja();
  const deleteShikanja = useDeleteShikanja();

  const selectedRow = data?.rows?.find(r => r.id === selectedId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) { e.preventDefault(); handleRefresh(); }
      else if (e.key === 'F2') { e.preventDefault(); startAdd(); }
      else if (e.key === 'Delete' && selectedId && mode === 'idle') { e.preventDefault(); setIsDeleteDialogOpen(true); }
      else if (e.key === 'Escape') { e.preventDefault(); exitForm(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, mode, startAdd, exitForm]);

  const handleSearch = () => { setSearch(searchInput); setPage(0); };
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListShikanjaQueryKey() });
    refetch(); exitForm(); setSearchInput(""); setSearch("");
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: ShikanjaInput) => {
    if (mode === 'add') {
      createShikanja.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Shikanja created successfully." });
          queryClient.invalidateQueries({ queryKey: getListShikanjaQueryKey() });
          exitForm();
        },
        onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to create shikanja.", variant: "destructive" })
      });
    } else if (mode === 'edit' && selectedId) {
      updateShikanja.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Shikanja updated successfully." });
          queryClient.invalidateQueries({ queryKey: getListShikanjaQueryKey() });
          exitForm();
        },
        onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to update shikanja.", variant: "destructive" })
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteShikanja.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Shikanja deleted successfully." });
        queryClient.invalidateQueries({ queryKey: getListShikanjaQueryKey() });
        setIsDeleteDialogOpen(false); exitForm();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to delete shikanja.", variant: "destructive" });
        setIsDeleteDialogOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-background" data-testid="page-shikanja">
      <Header title="Shikanja" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 relative">
        <Breadcrumb items={["Stock", "Add", "Shikanja"]} />
        <Toolbar 
          onRefresh={handleRefresh} onSave={mode === 'add' ? handleSave : undefined} onUpdate={mode === 'edit' ? handleSave : undefined} onDelete={() => setIsDeleteDialogOpen(true)} onExit={exitForm}
          canSave={mode === 'add'} canUpdate={mode === 'edit'} canDelete={!!selectedId && mode === 'idle'}
          isSaving={createShikanja.isPending || updateShikanja.isPending} isDeleting={deleteShikanja.isPending}
        />
        <SearchToolbar value={searchInput} onChange={setSearchInput} onSearch={handleSearch} placeholder="Search shikanja..." />
        <EntityTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'createdAt', label: 'Created At', render: (r) => new Date(r.createdAt).toLocaleDateString() },
          ]}
          rows={data?.rows || []} total={data?.total || 0} isLoading={isLoading} selectedId={selectedId} onRowClick={(row) => startEdit(row.id)}
        />
        <PaginationFooter page={page} pageSize={pageSize} total={data?.total || 0} onPageChange={setPage} />
        {(mode === 'add' || mode === 'edit') && (
          <div className="bg-card border rounded-md p-4 shadow-sm shrink-0">
            <h3 className="font-semibold text-lg mb-4">{mode === 'add' ? 'Add Shikanja' : 'Edit Shikanja'}</h3>
            <ShikanjaForm initialData={mode === 'edit' ? selectedRow : undefined} onSubmit={onSubmit} />
          </div>
        )}
      </div>
      <ConfirmDeleteDialog open={isDeleteDialogOpen} onCancel={() => setIsDeleteDialogOpen(false)} onConfirm={handleDelete} isDeleting={deleteShikanja.isPending} entityName="shikanja" />
    </div>
  );
}