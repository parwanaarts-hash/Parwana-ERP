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
import { ProductForm } from "@/components/master/forms/ProductForm";
import { 
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, 
  getListProductsQueryKey, ProductInput, Product 
} from "@workspace/api-client-react";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const {
    search, setSearch, page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm
  } = useMasterData();

  const [searchInput, setSearchInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // APIs
  const { data, isLoading, refetch } = useListProducts({ search: search || undefined, limit: pageSize, offset: page * pageSize });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  // Selected row
  const selectedRow = data?.rows?.find(r => r.id === selectedId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        handleRefresh();
      } else if (e.key === 'F2') {
        e.preventDefault();
        startAdd();
      } else if (e.key === 'Delete' && selectedId && mode === 'idle') {
        e.preventDefault();
        setIsDeleteDialogOpen(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, mode, startAdd, exitForm]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    refetch();
    exitForm();
    setSearchInput("");
    setSearch("");
  };

  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const onSubmit = (formData: ProductInput) => {
    if (mode === 'add') {
      createProduct.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Product created successfully." });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to create product.", variant: "destructive" });
        }
      });
    } else if (mode === 'edit' && selectedId) {
      updateProduct.mutate({ id: selectedId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Product updated successfully." });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          exitForm();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to update product.", variant: "destructive" });
        }
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteProduct.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Product deleted successfully." });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsDeleteDialogOpen(false);
        exitForm();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to delete product.", variant: "destructive" });
        setIsDeleteDialogOpen(false);
      }
    });
  };

  const isSaving = createProduct.isPending || updateProduct.isPending;
  const isDeleting = deleteProduct.isPending;

  return (
    <div className="flex flex-col h-full w-full bg-background" data-testid="page-products">
      <Header title="Products" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 relative">
        <Breadcrumb items={["Stock", "Add", "Products"]} />
        
        <Toolbar 
          onRefresh={handleRefresh}
          onSave={mode === 'add' ? handleSave : undefined}
          onUpdate={mode === 'edit' ? handleSave : undefined}
          onDelete={() => setIsDeleteDialogOpen(true)}
          onExit={exitForm}
          canSave={mode === 'add'}
          canUpdate={mode === 'edit'}
          canDelete={!!selectedId && mode === 'idle'}
          isSaving={isSaving}
          isDeleting={isDeleting}
        />

        <SearchToolbar 
          value={searchInput} 
          onChange={setSearchInput} 
          onSearch={handleSearch} 
          placeholder="Search products..." 
        />

        <EntityTable
          columns={[
            { key: 'itemCode', label: 'Item Code' },
            { key: 'productName', label: 'Product Name' },
            { key: 'type', label: 'Type' },
            { key: 'subCategoryId', label: 'Sub Category ID' },
            { key: 'shikanjaId', label: 'Shikanja ID' },
          ]}
          rows={data?.rows || []}
          total={data?.total || 0}
          isLoading={isLoading}
          selectedId={selectedId}
          onRowClick={(row) => startEdit(row.id)}
        />

        <PaginationFooter 
          page={page} 
          pageSize={pageSize} 
          total={data?.total || 0} 
          onPageChange={setPage} 
        />

        {(mode === 'add' || mode === 'edit') && (
          <div className="bg-card border rounded-md p-4 shadow-sm shrink-0" data-testid="container-form-section">
            <h3 className="font-semibold text-lg mb-4">{mode === 'add' ? 'Add Product' : 'Edit Product'}</h3>
            <ProductForm 
              initialData={mode === 'edit' ? selectedRow : undefined} 
              onSubmit={onSubmit} 
            />
          </div>
        )}
      </div>

      <ConfirmDeleteDialog 
        open={isDeleteDialogOpen} 
        onCancel={() => setIsDeleteDialogOpen(false)} 
        onConfirm={handleDelete} 
        isDeleting={isDeleting} 
        entityName="product" 
      />
    </div>
  );
}