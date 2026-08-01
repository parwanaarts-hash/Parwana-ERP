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
import { CategoryForm } from "@/components/master/forms/CategoryForm";
import { 
  useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, 
  getListCategoriesQueryKey, CategoryInput, Category 
} from "@workspace/api-client-react";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const {
    search, setSearch, page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm
  } = useMasterData();

  const [searchInput, setSearchInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const { data, isLoading, refetch } = useListCategories({ search: search || undefined, limit: pageSize, offset: page * pageSize });
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const selectedRow = data?.rows?.find(r => r.id === selectedId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault(); handleRefresh();
      } else if (e.key === 'Delete' && selectedId && mode === 'idle') {
        e.preventDefault(); setIsDeleteDialogOpen(true);
      } else if (e.key === 'Escape') {
        e.preventDefault(); exitForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, mode, exitForm]);

  const handleSearch = () => { setSearch(searchInput); setPage(0); };
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    refetch();
    startAdd();
    setSearchInput("");
    setSearch("");
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: CategoryInput) => {
    if (mode === 'add') {
      createCategory.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Category created successfully." });
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          setFormKey(k => k + 1);
          startAdd();
        },
        onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to create category.", variant: "destructive" })
      });
    } else if (mode === 'edit' && selectedId) {
      updateCategory.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Category updated successfully." });
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          setFormKey(k => k + 1);
          startAdd();
        },
        onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to update category.", variant: "destructive" })
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteCategory.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Category deleted successfully." });
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setIsDeleteDialogOpen(false);
        setFormKey(k => k + 1);
        startAdd();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to delete category.", variant: "destructive" });
        setIsDeleteDialogOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-background" data-testid="page-categories">
      <Header title="Categories" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 relative">
        <Breadcrumb items={["Stock", "Add", "Categories"]} />
        <Toolbar 
          onRefresh={handleRefresh}
          onSave={mode === 'add' ? handleSave : undefined}
          onUpdate={mode === 'edit' ? handleSave : undefined}
          onDelete={() => setIsDeleteDialogOpen(true)}
          onExit={exitForm}
          canSave={mode === 'add'}
          canUpdate={mode === 'edit'}
          canDelete={!!selectedId && mode === 'edit'}
          isSaving={createCategory.isPending || updateCategory.isPending}
          isDeleting={deleteCategory.isPending}
        />
        <SearchToolbar value={searchInput} onChange={setSearchInput} onSearch={handleSearch} placeholder="Search categories..." />
        <EntityTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'parentId', label: 'Parent ID', render: (r) => r.parentId ?? "Main" },
          ]}
          rows={data?.rows || []} total={data?.total || 0} isLoading={isLoading} selectedId={selectedId}
          onRowClick={(row) => startEdit(row.id)}
        />
        <PaginationFooter page={page} pageSize={pageSize} total={data?.total || 0} onPageChange={setPage} />
        <div className="bg-card border rounded-md p-4 shadow-sm shrink-0">
          <h3 className="font-semibold text-lg mb-4">{mode === 'edit' ? 'Edit Category' : 'New Category'}</h3>
          <CategoryForm
            key={formKey}
            initialData={mode === 'edit' ? selectedRow : undefined}
            onSubmit={onSubmit}
          />
        </div>
      </div>
      <ConfirmDeleteDialog open={isDeleteDialogOpen} onCancel={() => setIsDeleteDialogOpen(false)} onConfirm={handleDelete} isDeleting={deleteCategory.isPending} entityName="category" />
    </div>
  );
}
