import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Save,
  Pencil,
  Trash2,
  LogOut,
  Settings,
  UserCircle,
  Plus,
  Loader2,
} from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/master/ConfirmDeleteDialog";
import { EntityTable } from "@/components/master/EntityTable";
import { PaginationFooter } from "@/components/master/PaginationFooter";
import { useMasterData } from "@/hooks/useMasterData";
import { useToast } from "@/hooks/use-toast";
import {
  useNextDocumentNumber,
  DOC_TYPES,
  nextNumberQueryKey,
} from "@/hooks/useNextDocumentNumber";
import {
  useListSaleGatePasses,
  useGetSaleGatePass,
  useCreateSaleGatePass,
  useUpdateSaleGatePass,
  useDeleteSaleGatePass,
  useListProducts,
  useListSaleParties,
  useListShikanja,
  getListSaleGatePassesQueryKey,
  getGetSaleGatePassQueryKey,
  SaleGatePassInput,
  SaleGatePass,
  Product,
} from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CommittedRow = {
  id: string;
  productId: number;
  productName: string;
  scale: string;
  qty: number;
  gazana: number;
  meter: number;
  rate: number;
  amount: number;
};

type EntryState = {
  product: Product | null;
  qty: string;
  gazana: string;
  meter: string;
  rate: string;
  amount: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const toNum = (v: string | number | undefined | null) =>
  v === "" || v === undefined || v === null ? 0 : Number(v);

const emptyEntry = (): EntryState => ({
  product: null,
  qty: "",
  gazana: "",
  meter: "",
  rate: "",
  amount: "",
});

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Component ─────────────────────────────────────────────────────────────────

export default function SaleGatePassPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Master-data pagination / selection (unchanged) ─────────────────────────
  const {
    page,
    setPage,
    pageSize,
    selectedId,
    mode,
    startAdd,
    startEdit,
    exitForm,
  } = useMasterData();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // ── API queries (unchanged) ────────────────────────────────────────────────
  const { data, isLoading, refetch } = useListSaleGatePasses({
    limit: pageSize,
    offset: page * pageSize,
  });
  const { data: fullRecord, isLoading: isLoadingRecord } = useGetSaleGatePass(
    selectedId ?? 0,
    {
      query: {
        queryKey: getGetSaleGatePassQueryKey(selectedId ?? 0),
        enabled: mode === "edit" && selectedId !== null,
      },
    }
  );
  const { data: nextNumber } = useNextDocumentNumber(DOC_TYPES.SaleGatePass);
  const { data: productsData } = useListProducts({ limit: 200 });
  const { data: partiesData } = useListSaleParties({ limit: 200 });
  const { data: shikanjaData } = useListShikanja({ limit: 200 });

  const createGP = useCreateSaleGatePass();
  const updateGP = useUpdateSaleGatePass();
  const deleteGP = useDeleteSaleGatePass();

  const products = productsData?.rows ?? [];
  const saleParties = partiesData?.rows ?? [];
  const shikanjaList = shikanjaData?.rows ?? [];
  const partyMap: Record<number, string> = Object.fromEntries(
    (partiesData?.rows ?? []).map((p) => [p.id, p.name])
  );
  const shikanjaMap: Record<number, string> = Object.fromEntries(
    (shikanjaData?.rows ?? []).map((s) => [s.id, s.name])
  );

  // ── Header-form local state ────────────────────────────────────────────────
  const [date, setDate] = useState(todayISO);
  const [salePartyId, setSalePartyId] = useState("");
  const [noOfBags, setNoOfBags] = useState("");
  const [shikanjaId, setShikanjaId] = useState("");
  const [remarks, setRemarks] = useState("");

  // ── Committed items (the actual gate-pass lines) ───────────────────────────
  const [rows, setRows] = useState<CommittedRow[]>([]);

  // ── Entry-bar staging state ────────────────────────────────────────────────
  const [entry, setEntry] = useState<EntryState>(emptyEntry);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Entry-bar field refs for Enter-key focus advance
  const productInputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const gazanaRef = useRef<HTMLInputElement>(null);
  const meterRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // ── Reset when switching to "add" mode ────────────────────────────────────
  useEffect(() => {
    if (mode === "add") {
      setDate(todayISO());
      setSalePartyId("");
      setNoOfBags("");
      setShikanjaId("");
      setRemarks("");
      setRows([]);
      setEntry(emptyEntry());
      setSearchTerm("");
    }
  }, [mode]);

  // ── Populate form when fullRecord loads in edit mode ──────────────────────
  useEffect(() => {
    if (mode === "edit" && fullRecord) {
      setDate(fullRecord.date ?? todayISO());
      setSalePartyId(String(fullRecord.salePartyId));
      setNoOfBags(fullRecord.noOfBags != null ? String(fullRecord.noOfBags) : "");
      setShikanjaId(
        fullRecord.shikanjaId != null ? String(fullRecord.shikanjaId) : ""
      );
      setRemarks(fullRecord.remarks ?? "");
      setRows(
        (fullRecord.items ?? []).map((item) => ({
          id: crypto.randomUUID(),
          productId: item.productId,
          productName:
            products.find((p) => p.id === item.productId)?.productName ??
            `#${item.productId}`,
          scale:
            products.find((p) => p.id === item.productId)?.scale ?? "",
          qty: toNum(item.qty),
          gazana: toNum(item.gazana),
          meter: toNum(item.meter),
          rate: toNum(item.rate),
          amount: toNum(item.amount),
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullRecord, mode]);

  // ── GP number display ──────────────────────────────────────────────────────
  const gpNo =
    mode === "edit" ? (fullRecord?.gpNumber ?? "…") : (nextNumber ?? "Auto");

  // ── Product search ─────────────────────────────────────────────────────────
  const filteredProducts = (() => {
    const q = searchTerm.trim();
    if (!q) return products.slice(0, 40);
    const words = q.split(/\s+/);
    return products
      .filter((p) =>
        words.every(
          (w) =>
            p.itemCode.toLowerCase().includes(w.toLowerCase()) ||
            p.productName.toLowerCase().includes(w.toLowerCase())
        )
      )
      .slice(0, 40);
  })();

  const selectProduct = useCallback(
    (product: Product) => {
      setEntry((prev) => ({ ...prev, product }));
      setSearchTerm(`${product.itemCode} – ${product.productName}`);
      setShowSuggestions(false);
      setTimeout(() => qtyRef.current?.focus(), 0);
    },
    []
  );

  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filteredProducts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredProducts[highlightIndex])
        selectProduct(filteredProducts[highlightIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // ── Commit an entry-bar row to the items list ──────────────────────────────
  const canCommit = entry.product !== null && toNum(entry.qty) > 0;

  const commitEntry = useCallback(() => {
    if (!canCommit || !entry.product) return;
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: entry.product!.id,
        productName: entry.product!.productName,
        scale: entry.product!.scale,
        qty: toNum(entry.qty),
        gazana: toNum(entry.gazana),
        meter: toNum(entry.meter),
        rate: toNum(entry.rate),
        amount: toNum(entry.amount),
      },
    ]);
    setEntry(emptyEntry());
    setSearchTerm("");
    setTimeout(() => productInputRef.current?.focus(), 0);
  }, [canCommit, entry]);

  const deleteRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  // ── Live totals ────────────────────────────────────────────────────────────
  const totals = rows.reduce(
    (acc, r) => {
      acc.qty += r.qty;
      acc.gazana += r.gazana;
      acc.meter += r.meter;
      acc.amount += r.amount;
      return acc;
    },
    { qty: 0, gazana: 0, meter: 0, amount: 0 }
  );

  // ── Invalidate next-number cache ───────────────────────────────────────────
  const invalidateNextNumber = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: nextNumberQueryKey(DOC_TYPES.SaleGatePass),
    });
  }, [queryClient]);

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: getListSaleGatePassesQueryKey(),
    });
    invalidateNextNumber();
    refetch();
    startAdd();
  }, [queryClient, invalidateNextNumber, refetch, startAdd]);

  // ── Assemble payload from local state ─────────────────────────────────────
  const assemblePayload = useCallback((): SaleGatePassInput => ({
    date,
    salePartyId: Number(salePartyId),
    noOfBags: noOfBags ? Number(noOfBags) : undefined,
    shikanjaId: shikanjaId ? Number(shikanjaId) : undefined,
    remarks: remarks || undefined,
    items: rows.map((r) => ({
      productId: r.productId,
      qty: r.qty ? String(r.qty) : undefined,
      gazana: r.gazana ? String(r.gazana) : undefined,
      meter: r.meter ? String(r.meter) : undefined,
      rate: r.rate ? String(r.rate) : undefined,
      amount: r.amount ? String(r.amount) : undefined,
    })),
  }), [date, salePartyId, noOfBags, shikanjaId, remarks, rows]);

  // ── Validate before save ───────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    if (!salePartyId || Number(salePartyId) === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a Sale Party.",
        variant: "destructive",
      });
      return false;
    }
    if (rows.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one item.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }, [salePartyId, rows, toast]);

  // ── Save / Update (existing mutation logic, unchanged) ─────────────────────
  const handleSave = useCallback(() => {
    if (!validate()) return;
    const formData = assemblePayload();
    if (mode === "add") {
      createGP.mutate(
        { data: formData },
        {
          onSuccess: () => {
            toast({ title: "Success", description: "Sale Gate Pass created." });
            queryClient.invalidateQueries({
              queryKey: getListSaleGatePassesQueryKey(),
            });
            invalidateNextNumber();
            startAdd();
          },
          onError: (err: any) =>
            toast({
              title: "Error",
              description: err?.message ?? "Failed to create gate pass.",
              variant: "destructive",
            }),
        }
      );
    } else if (mode === "edit" && selectedId) {
      updateGP.mutate(
        { id: selectedId, data: formData },
        {
          onSuccess: () => {
            toast({ title: "Success", description: "Sale Gate Pass updated." });
            queryClient.invalidateQueries({
              queryKey: getListSaleGatePassesQueryKey(),
            });
            invalidateNextNumber();
            startAdd();
          },
          onError: (err: any) =>
            toast({
              title: "Error",
              description: err?.message ?? "Failed to update gate pass.",
              variant: "destructive",
            }),
        }
      );
    }
  }, [
    validate,
    assemblePayload,
    mode,
    selectedId,
    createGP,
    updateGP,
    toast,
    queryClient,
    invalidateNextNumber,
    startAdd,
  ]);

  // ── Delete (unchanged logic) ───────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    deleteGP.mutate(
      { id: selectedId },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Sale Gate Pass deleted." });
          queryClient.invalidateQueries({
            queryKey: getListSaleGatePassesQueryKey(),
          });
          invalidateNextNumber();
          setIsDeleteDialogOpen(false);
          startAdd();
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to delete gate pass.",
            variant: "destructive",
          });
          setIsDeleteDialogOpen(false);
        },
      }
    );
  }, [selectedId, deleteGP, toast, queryClient, invalidateNextNumber, startAdd]);

  // ── Keyboard shortcuts (unchanged logic) ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (
        e.key === "Delete" &&
        !isTyping &&
        selectedId &&
        mode === "idle"
      ) {
        e.preventDefault();
        setIsDeleteDialogOpen(true);
      } else if (e.key === "Escape" && !isTyping) {
        e.preventDefault();
        exitForm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, selectedId, mode, exitForm]);

  const isSaving = createGP.isPending || updateGP.isPending;
  const isDeleting = deleteGP.isPending;

  // ── CSS shorthands (matching Purchase GP exactly) ─────────────────────────
  const toolbarBtn =
    "flex flex-col items-center gap-1.5 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const inputCls =
    "w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400";
  const labelCls = "block text-xs font-medium text-gray-500 mb-1";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6">
      <div className="max-w-7xl mx-auto bg-white border border-gray-200 rounded-lg overflow-hidden">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === "edit" ? "Edit Sale Gate Pass" : "Sale Gate Pass"}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <Settings size={18} className="cursor-pointer hover:text-gray-800" />
            <UserCircle size={20} className="cursor-pointer hover:text-gray-800" />
          </div>
        </div>

        {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
        <div className="px-6 pt-3 text-sm text-gray-500 flex items-center gap-2">
          <span>Home</span>
          <span>›</span>
          <span>Stock</span>
          <span>›</span>
          <span>Sales</span>
          <span>›</span>
          <span className="text-gray-800 font-medium">Gate Pass</span>
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="mx-6 mt-4 border border-gray-200 rounded-lg px-2 py-1 flex items-center divide-x divide-gray-100">
          <button
            className={toolbarBtn}
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw size={18} className="text-blue-600" />
            <span className="text-xs">Refresh</span>
          </button>
          <button
            className={toolbarBtn}
            onClick={handleSave}
            disabled={mode !== "add" || isSaving}
            title="Save (Ctrl+S)"
          >
            {isSaving && mode === "add" ? (
              <Loader2 size={18} className="text-green-600 animate-spin" />
            ) : (
              <Save size={18} className="text-green-600" />
            )}
            <span className="text-xs">Save</span>
          </button>
          <button
            className={toolbarBtn}
            onClick={handleSave}
            disabled={mode !== "edit" || isSaving}
            title="Update (Ctrl+S)"
          >
            {isSaving && mode === "edit" ? (
              <Loader2 size={18} className="text-amber-600 animate-spin" />
            ) : (
              <Pencil size={18} className="text-amber-600" />
            )}
            <span className="text-xs">Update</span>
          </button>
          <button
            className={toolbarBtn}
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={!selectedId || mode !== "edit" || isDeleting}
            title="Delete"
          >
            {isDeleting ? (
              <Loader2 size={18} className="text-red-600 animate-spin" />
            ) : (
              <Trash2 size={18} className="text-red-600" />
            )}
            <span className="text-xs">Delete</span>
          </button>
          <button
            className={toolbarBtn}
            onClick={exitForm}
            title="Exit (Esc)"
          >
            <LogOut size={18} className="text-gray-500" />
            <span className="text-xs">Exit</span>
          </button>
        </div>

        {/* ── Keyboard shortcut hints ───────────────────────────────────────── */}
        <div className="mx-6 mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span className="border border-gray-300 rounded px-1.5 py-0.5 bg-gray-100">
            Ctrl+S
          </span>
          <span>Save</span>
          <span className="border border-gray-300 rounded px-1.5 py-0.5 bg-gray-100">
            Del
          </span>
          <span>Delete</span>
          <span className="border border-gray-300 rounded px-1.5 py-0.5 bg-gray-100">
            Esc
          </span>
          <span>Exit</span>
        </div>

        {/* Loading spinner while fetching edit record */}
        {mode === "edit" && isLoadingRecord && (
          <div className="mx-6 mb-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading record…
          </div>
        )}

        {/* ── Header fields ─────────────────────────────────────────────────── */}
        <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {/* GP # — read-only */}
          <div>
            <label className={labelCls}>GP #</label>
            <input
              value={gpNo}
              readOnly
              className={`${inputCls} bg-gray-50 text-gray-400 font-mono`}
              data-testid="input-sgp-number"
            />
          </div>

          {/* Date */}
          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
              data-testid="input-sgp-date"
            />
          </div>

          {/* Sale Party */}
          <div>
            <label className={labelCls}>Sale Party</label>
            <select
              value={salePartyId}
              onChange={(e) => setSalePartyId(e.target.value)}
              className={inputCls}
              data-testid="select-sgp-party"
            >
              <option value="">Select party…</option>
              {saleParties.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* No. of Bags — Sale GP specific */}
          <div>
            <label className={labelCls}>No. of Bags</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={noOfBags}
              onChange={(e) => setNoOfBags(e.target.value)}
              className={inputCls}
              data-testid="input-sgp-bags"
            />
          </div>

          {/* Shikanja — Sale GP specific */}
          <div>
            <label className={labelCls}>Shikanja</label>
            <select
              value={shikanjaId}
              onChange={(e) => setShikanjaId(e.target.value)}
              className={inputCls}
              data-testid="select-sgp-shikanja"
            >
              <option value="">— None —</option>
              {shikanjaList.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className={labelCls}>Remarks</label>
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional…"
              className={inputCls}
              data-testid="input-sgp-remarks"
            />
          </div>
        </div>

        {/* ── Fixed entry bar ───────────────────────────────────────────────── */}
        <div className="mx-6 mb-5 border border-blue-200 bg-blue-50/40 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-3 items-end">

            {/* Product search — col-span-4 */}
            <div className="col-span-4 relative">
              <label className={labelCls}>Product</label>
              <input
                ref={productInputRef}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setEntry((prev) => ({ ...prev, product: null }));
                  setShowSuggestions(true);
                  setHighlightIndex(0);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() =>
                  setTimeout(() => setShowSuggestions(false), 120)
                }
                onKeyDown={handleProductKeyDown}
                placeholder="Type to search… e.g. print, lawn"
                className={inputCls}
                data-testid="input-sgp-product-search"
              />
              {showSuggestions && filteredProducts.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
                  {filteredProducts.map((p, i) => (
                    <div
                      key={p.id}
                      onMouseDown={() => selectProduct(p)}
                      onMouseEnter={() => setHighlightIndex(i)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
                        i === highlightIndex
                          ? "bg-blue-100 text-blue-800"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                        {p.itemCode}
                      </span>
                      <span className="truncate">{p.productName}</span>
                      <span className="text-xs text-gray-400 shrink-0 ml-auto">
                        {p.scale}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Qty */}
            <div className="col-span-1">
              <label className={labelCls}>Qty</label>
              <input
                ref={qtyRef}
                type="number"
                step="0.01"
                min="0"
                value={entry.qty}
                onChange={(e) =>
                  setEntry((prev) => ({ ...prev, qty: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") gazanaRef.current?.focus();
                }}
                placeholder="0"
                className={inputCls}
                data-testid="input-entry-qty"
              />
            </div>

            {/* Gazana — Sale GP specific field */}
            <div className="col-span-1">
              <label className={labelCls}>Gazana</label>
              <input
                ref={gazanaRef}
                type="number"
                step="0.01"
                min="0"
                value={entry.gazana}
                onChange={(e) =>
                  setEntry((prev) => ({ ...prev, gazana: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") meterRef.current?.focus();
                }}
                placeholder="0"
                className={inputCls}
                data-testid="input-entry-gazana"
              />
            </div>

            {/* Meter */}
            <div className="col-span-1">
              <label className={labelCls}>Meter</label>
              <input
                ref={meterRef}
                type="number"
                step="0.01"
                min="0"
                value={entry.meter}
                onChange={(e) =>
                  setEntry((prev) => ({ ...prev, meter: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") rateRef.current?.focus();
                }}
                placeholder="0"
                className={inputCls}
                data-testid="input-entry-meter"
              />
            </div>

            {/* Rate */}
            <div className="col-span-1">
              <label className={labelCls}>Rate</label>
              <input
                ref={rateRef}
                type="number"
                step="0.01"
                min="0"
                value={entry.rate}
                onChange={(e) =>
                  setEntry((prev) => ({ ...prev, rate: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") amountRef.current?.focus();
                }}
                placeholder="0.00"
                className={inputCls}
                data-testid="input-entry-rate"
              />
            </div>

            {/* Amount — total for this line */}
            <div className="col-span-2">
              <label className={labelCls}>Amount</label>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                min="0"
                value={entry.amount}
                onChange={(e) =>
                  setEntry((prev) => ({ ...prev, amount: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEntry();
                  }
                }}
                placeholder="0.00"
                className={`${inputCls} font-semibold text-blue-700`}
                data-testid="input-entry-amount"
              />
            </div>

            {/* Add button */}
            <div className="col-span-2">
              <button
                type="button"
                onClick={commitEntry}
                disabled={!canCommit}
                className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md px-3 py-2 text-sm font-medium transition-colors"
                data-testid="button-add-row"
              >
                <Plus size={15} />
                Add (Enter)
              </button>
            </div>
          </div>
        </div>

        {/* ── Items table + side totals panel ──────────────────────────────── */}
        <div className="px-6 pb-6 flex gap-5">

          {/* Items table */}
          <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                  <th className="px-3 py-2 font-medium w-8">#</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium w-16">Scale</th>
                  <th className="px-3 py-2 font-medium w-16 text-right">Qty</th>
                  <th className="px-3 py-2 font-medium w-20 text-right">Gazana</th>
                  <th className="px-3 py-2 font-medium w-20 text-right">Meter</th>
                  <th className="px-3 py-2 font-medium w-20 text-right">Rate</th>
                  <th className="px-3 py-2 font-medium w-24 text-right">Amount</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No items yet — use the bar above to add products.
                    </td>
                  </tr>
                )}
                {rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2">{r.productName}</td>
                    <td className="px-3 py-2 text-gray-500">{r.scale}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.gazana}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.meter}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.rate}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-700 tabular-nums">
                      {r.amount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(r.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove row"
                        data-testid={`button-delete-row-${idx}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Side totals panel */}
          <div className="w-56 shrink-0 border border-gray-200 rounded-lg p-5 bg-gray-50 flex flex-col gap-4 h-fit">
            <div>
              <div className="text-xs text-gray-500">QTY</div>
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">
                {totals.qty}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Gazana</div>
              <div className="text-2xl font-semibold text-gray-700 tabular-nums">
                {totals.gazana}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Meters</div>
              <div className="text-2xl font-semibold text-green-600 tabular-nums">
                {totals.meter}
              </div>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500">Total Amount</div>
              <div className="text-2xl font-bold text-blue-600 tabular-nums">
                {totals.amount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
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
