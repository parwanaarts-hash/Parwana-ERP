import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Save, Edit, Trash2, LogOut, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PaginationFooter } from "@/components/master/PaginationFooter";
import { ConfirmDeleteDialog } from "@/components/master/ConfirmDeleteDialog";
import { useMasterData } from "@/hooks/useMasterData";
import { useToast } from "@/hooks/use-toast";
import { PurchasePartyForm, PurchasePartyFormData } from "@/components/master/forms/PurchasePartyForm";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useListPurchaseParties, useCreatePurchaseParty, useUpdatePurchaseParty, useDeletePurchaseParty,
  getListPurchasePartiesQueryKey, PurchaseParty,
  useListShikanja, useCreateShikanja, getListShikanjaQueryKey,
} from "@workspace/api-client-react";

// ── Shared toolbar button ────────────────────────────────────────────────────
const TBtn = ({
  icon: Icon, label, onClick, disabled = false, iconClass = "text-foreground",
}: {
  icon: React.ElementType; label: string; onClick?: () => void;
  disabled?: boolean; iconClass?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    data-testid={`button-toolbar-${label.toLowerCase()}`}
    className={`flex flex-col items-center justify-center rounded-md transition-colors h-auto py-2 px-4 gap-1 text-xs
      ${disabled ? "opacity-50 pointer-events-none" : "hover:bg-muted"}`}
  >
    <Icon className={`h-5 w-5 ${iconClass}`} />
    <span className="font-medium text-foreground">{label}</span>
  </button>
);

const Divider = () => <div className="w-px h-10 bg-border mx-1 shrink-0" />;

export default function PurchasePartiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    search, setSearch, page, setPage, pageSize,
    selectedId, mode, startAdd, startEdit, exitForm,
  } = useMasterData();

  const [searchInput, setSearchInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const { data, isLoading, refetch } = useListPurchaseParties({
    search: search || undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  // Load all shikanja for name resolution in the register
  const { data: shikanjaData } = useListShikanja({ limit: 500 });

  const createPurchaseParty = useCreatePurchaseParty();
  const updatePurchaseParty = useUpdatePurchaseParty();
  const deletePurchaseParty = useDeletePurchaseParty();
  const createShikanja = useCreateShikanja();

  const rows = (data?.rows as PurchaseParty[] | undefined) ?? [];
  const selectedRow = rows.find((r) => r.id === selectedId);
  const isSaving = createPurchaseParty.isPending || updatePurchaseParty.isPending;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        e.preventDefault(); handleRefresh();
      } else if (e.key === "Delete" && selectedId && mode === "idle") {
        e.preventDefault(); setIsDeleteDialogOpen(true);
      } else if (e.key === "Escape") {
        e.preventDefault(); exitForm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, mode, exitForm]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const shikanjaNameById = (id: number | null | undefined): string => {
    if (!id) return "—";
    return shikanjaData?.rows?.find((s) => s.id === id)?.name ?? "—";
  };

  const shikanjaNameForRow = (row: PurchaseParty): string =>
    shikanjaNameById(row.shikanjaId ?? null);

  /** Resolve a shikanja display name → ID, creating if new (case-insensitive dedup). */
  const resolveShikanjaId = async (name: string): Promise<number | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = shikanjaData?.rows?.find(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing.id;
    // Create new shikanja
    const created = await createShikanja.mutateAsync({ data: { name: trimmed } });
    queryClient.invalidateQueries({ queryKey: getListShikanjaQueryKey() });
    return created.id;
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSearch = () => { setSearch(searchInput); setPage(0); };
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListPurchasePartiesQueryKey() });
    refetch();
    startAdd();
    setSearchInput("");
    setSearch("");
  };
  const handleSave = () => {
    const form = document.getElementById("entity-form") as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const onSubmit = async (formData: PurchasePartyFormData) => {
    const shikanjaId = await resolveShikanjaId(formData.shikanjaName ?? "");

    const payload = {
      name:          formData.name,
      nameUrdu:      formData.nameUrdu      || undefined,
      address:       formData.address       || undefined,
      city:          formData.city          || undefined,
      phone:         formData.phone         || undefined,
      mobile:        formData.mobile        || undefined,
      openingCredit: formData.openingCredit  ? Number(formData.openingCredit)  : undefined,
      openingDebit:  formData.openingDebit   ? Number(formData.openingDebit)   : undefined,
      type:          (formData.type as "cash" | "credit") || undefined,
      shikanjaId:    shikanjaId ?? undefined,
    };

    if (mode === "add") {
      createPurchaseParty.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase Party created." });
          queryClient.invalidateQueries({ queryKey: getListPurchasePartiesQueryKey() });
          setFormKey((k) => k + 1);
          startAdd();
        },
        onError: (err: any) =>
          toast({ title: "Error", description: err.message || "Failed to create.", variant: "destructive" }),
      });
    } else if (mode === "edit" && selectedId) {
      updatePurchaseParty.mutate({ id: selectedId, data: payload }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase Party updated." });
          queryClient.invalidateQueries({ queryKey: getListPurchasePartiesQueryKey() });
          setFormKey((k) => k + 1);
          startAdd();
        },
        onError: (err: any) =>
          toast({ title: "Error", description: err.message || "Failed to update.", variant: "destructive" }),
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deletePurchaseParty.mutate({ id: selectedId }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Purchase Party deleted." });
        queryClient.invalidateQueries({ queryKey: getListPurchasePartiesQueryKey() });
        setIsDeleteDialogOpen(false);
        setFormKey((k) => k + 1);
        startAdd();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to delete.", variant: "destructive" });
        setIsDeleteDialogOpen(false);
      },
    });
  };

  // Build initialData for form when editing
  const formInitialData = mode === "edit" && selectedRow
    ? {
        name:          selectedRow.name,
        nameUrdu:      selectedRow.nameUrdu   ?? "",
        address:       selectedRow.address    ?? "",
        city:          selectedRow.city       ?? "",
        phone:         selectedRow.phone      ?? "",
        mobile:        selectedRow.mobile     ?? "",
        openingCredit: selectedRow.openingCredit ?? "",
        openingDebit:  selectedRow.openingDebit  ?? "",
        type:          selectedRow.type       ?? "",
        shikanjaName:  shikanjaNameById(selectedRow.shikanjaId ?? null) === "—"
                         ? "" : shikanjaNameById(selectedRow.shikanjaId ?? null),
      }
    : undefined;

  return (
    <div className="flex flex-col h-full w-full bg-background" data-testid="page-purchase-parties">
      <Header title="Purchase Parties" />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        <Breadcrumb items={["ERP", "Settings", "Purchase Parties"]} />

        {/* ── 1. SINGLE COMBINED TOOLBAR + SEARCH ─────────────────────────── */}
        <div
          className="flex items-center gap-1 p-2 bg-card border rounded-md shadow-sm shrink-0 flex-wrap"
          data-testid="container-toolbar"
        >
          <TBtn icon={RefreshCcw} label="Refresh" onClick={handleRefresh} iconClass="text-blue-600" />
          <Divider />
          <TBtn
            icon={Save} label={isSaving ? "Saving…" : "Save"}
            onClick={handleSave}
            disabled={mode !== "add" || isSaving}
            iconClass="text-green-600"
          />
          <TBtn
            icon={Edit} label={isSaving ? "Updating…" : "Update"}
            onClick={handleSave}
            disabled={mode !== "edit" || isSaving}
            iconClass="text-amber-600"
          />
          <TBtn
            icon={Trash2} label={deletePurchaseParty.isPending ? "Deleting…" : "Delete"}
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={!selectedId || mode !== "edit" || deletePurchaseParty.isPending}
            iconClass="text-red-500"
          />
          <Divider />
          <TBtn icon={LogOut} label="Exit" onClick={exitForm} iconClass="text-slate-600" />
          <Divider />

          {/* Inline search */}
          <div className="flex items-center gap-2 ml-1 flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search purchase parties..."
              data-testid="input-search"
              className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm
                shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1
                focus-visible:ring-ring placeholder:text-muted-foreground"
            />
            <button
              onClick={handleSearch}
              data-testid="button-search"
              className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground
                text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
        </div>

        {/* ── 2. ENTRY FORM ─────────────────────────────────────────────────── */}
        <div className="bg-card border rounded-md p-4 shadow-sm shrink-0">
          <h3 className="font-semibold text-base mb-3">
            {mode === "edit" ? "Edit Purchase Party" : "New Purchase Party"}
          </h3>
          <PurchasePartyForm
            key={formKey}
            initialData={formInitialData}
            currentId={mode === "edit" ? selectedId ?? undefined : undefined}
            onSubmit={onSubmit}
          />
        </div>

        {/* ── 3. PURCHASE PARTY REGISTER ────────────────────────────────────── */}
        <div className="flex-1 overflow-auto border rounded-md bg-card shadow-sm" data-testid="container-entity-table">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-12 font-medium text-foreground">Sr. No.</TableHead>
                <TableHead className="w-12 font-medium text-foreground">ID</TableHead>
                <TableHead className="font-medium text-foreground">Name</TableHead>
                <TableHead className="font-medium text-foreground">Urdu Name</TableHead>
                <TableHead className="w-20 font-medium text-foreground">Type</TableHead>
                <TableHead className="font-medium text-foreground">Shikanja</TableHead>
                <TableHead className="font-medium text-foreground">City</TableHead>
                <TableHead className="font-medium text-foreground">Mobile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    {[1,2,3,4,5,6,7,8].map((j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded w-3/4" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground" data-testid="text-empty-grid">
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    data-testid={`row-entity-${row.id}`}
                    className={`cursor-pointer transition-colors ${selectedId === row.id ? "bg-muted/80" : ""}`}
                    onClick={() => startEdit(row.id)}
                  >
                    <TableCell className="text-muted-foreground text-sm">{page * pageSize + idx + 1}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{row.id}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-sm" dir="rtl">{row.nameUrdu || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {row.type
                        ? <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${row.type === "cash" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {row.type === "cash" ? "Cash" : "Credit"}
                          </span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm">{shikanjaNameForRow(row)}</TableCell>
                    <TableCell className="text-sm">{row.city || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{row.mobile || <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationFooter page={page} pageSize={pageSize} total={data?.total || 0} onPageChange={setPage} />
      </div>

      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        isDeleting={deletePurchaseParty.isPending}
        entityName="purchase party"
      />
    </div>
  );
}
