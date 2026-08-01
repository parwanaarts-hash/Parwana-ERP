/**
 * ProductsPage — Desktop ERP style, uses the app's design-system tokens.
 *
 * Layout:
 *   Top toolbar   → Refresh | Save | Update | Delete | Print | Exit
 *   Form section  → always-visible compact fields
 *   Register grid → double-click row to load into form
 *
 * Keyboard:
 *   Enter → next field   Ctrl+S → Save   Esc → Exit
 *
 * ID / Item Code lookup:
 *   - New entry: the ID field shows the next available DB id (total + 1).
 *   - The Item Code field works as a lookup: type an existing code and press
 *     Enter to load that product into the form in edit mode.
 *   - "Record not found" message shown when the code doesn't exist.
 */

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
  useListCategories,
  getListProductsQueryOptions,
} from "@workspace/api-client-react";
import type { Product, ProductInput, Category } from "@workspace/api-client-react";
import { RefreshCcw, Save, Pencil, Trash2, Printer, LogOut } from "lucide-react";

// ── Scale options ────────────────────────────────────────────────────────────
const SCALE_OPTIONS = [
  { value: "Ng",   label: "Ng"   },
  { value: "Set",  label: "Set"  },
  { value: "Suit", label: "Suit" },
  { value: "Than", label: "Than" },
];


const scaleLabel = (val: string) =>
  SCALE_OPTIONS.find((o) => o.value === val)?.label ?? val;

// ── Empty form ────────────────────────────────────────────────────────────────
const EMPTY: ProductInput = {
  itemCode: "",
  productName: "",
  urduName: "",
  category: "",
  scale: "Ng",
  qty: 0,
  stockFactor: 1,
  length: "",
  rate: "",
  remarks: "",
};

type Mode = "new" | "edit";

// ── Shared input / label classes (theme-aware) ────────────────────────────────
const INP =
  "bg-background border border-border text-foreground text-xs h-6 px-1.5 " +
  "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 w-full rounded-sm";
const SEL =
  "bg-background border border-border text-foreground text-xs h-6 px-1 " +
  "focus:outline-none focus:border-primary w-full cursor-pointer rounded-sm";
const LBL = "text-muted-foreground text-xs whitespace-nowrap";

// ── Toolbar button ────────────────────────────────────────────────────────────
function TBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  className = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 px-4 py-1.5 hover:bg-muted
        transition-colors disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

export default function ProductsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [mode, setMode]                   = useState<Mode>("new");
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [form, setForm]                   = useState<ProductInput>(EMPTY);
  const [search, setSearch]               = useState("");
  const [page, setPage]                   = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [msg, setMsg]                     = useState<{ text: string; err?: boolean } | null>(null);
  const [mainCategoryId, setMainCategoryId] = useState<number | null>(null);

  const PAGE_SIZE    = 50;
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useListProducts({
    search: search || undefined,
    limit:  PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  // ── Category data for Main → Sub selection ───────────────────────────────
  const { data: mainCatsData } = useListCategories({ limit: 500, offset: 0, topLevelOnly: true });
  const { data: allCatsData }  = useListCategories({ limit: 500, offset: 0 });
  const mainCategories  = (mainCatsData?.rows  as Category[] | undefined) ?? [];
  const subCategories   = (allCatsData?.rows   as Category[] | undefined)?.filter(
    (c: Category) => c.parentId === mainCategoryId
  ) ?? [];

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Next available DB id shown in the ID display field
  const nextSerial = total + 1;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function notify(text: string, err = false) {
    setMsg({ text, err });
    setTimeout(() => setMsg(null), 3500);
  }

  function setField<K extends keyof ProductInput>(k: K, v: ProductInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function loadRow(row: Product) {
    setSelectedId(row.id);
    setMode("edit");
    setForm({
      itemCode:    row.itemCode    ?? "",
      productName: row.productName ?? "",
      urduName:    row.urduName    ?? "",
      category:    row.category    ?? "",
      scale:       row.scale       ?? "Ng",
      qty:         row.qty         ?? 0,
      stockFactor: row.stockFactor ?? 1,
      length:      row.length      ?? "",
      rate:        row.rate        ?? "",
      remarks:     row.remarks     ?? "",
    });
    // Derive main category from stored sub-category name
    if (row.category && allCatsData?.rows) {
      const subCat = (allCatsData.rows as Category[]).find((c: Category) => c.name === row.category);
      setMainCategoryId(subCat?.parentId ?? null);
    } else {
      setMainCategoryId(null);
    }
  }

  function resetToNew() {
    setMode("new");
    setSelectedId(null);
    setForm(EMPTY);
    setMainCategoryId(null);
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }

  /**
   * Lookup by itemCode: search for an exact match.
   * If found → load in edit mode. If not found → notify and keep new mode.
   */
  async function lookupByItemCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    // If already editing this exact item, do nothing
    if (mode === "edit" && form.itemCode === trimmed) return;
    try {
      const result = await queryClient.fetchQuery(
        getListProductsQueryOptions({ search: trimmed, limit: 10, offset: 0 })
      );
      const match = (result?.rows as Product[] | undefined)?.find(
        (r) => r.itemCode.toLowerCase() === trimmed.toLowerCase()
      );
      if (match) {
        loadRow(match);
      } else {
        // Not found — stay in new mode, keep the typed code
        notify(`Item Code "${trimmed}" not found. Form is ready for a new entry.`, true);
      }
    } catch {
      notify("Lookup failed. Please try again.", true);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    refetch();
    resetToNew();
    setSearch("");
    setPage(0);
  }

  function handleExit() {
    setLocation("/stock/add");
  }

  function handleSave() {
    if (!form.itemCode.trim())    { notify("Item Code is required.", true); return; }
    if (!form.productName.trim()) { notify("Product Name is required.", true); return; }
    createProduct.mutate(
      { data: form as any },
      {
        onSuccess: () => {
          notify("Product saved.");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          refetch();
          resetToNew();
        },
        onError: (e: any) => notify(e?.message ?? "Save failed.", true),
      },
    );
  }

  function handleUpdate() {
    if (!selectedId)              { notify("Select a product first.", true); return; }
    if (!form.itemCode.trim())    { notify("Item Code is required.", true); return; }
    if (!form.productName.trim()) { notify("Product Name is required.", true); return; }
    updateProduct.mutate(
      { id: selectedId, data: form as any },
      {
        onSuccess: () => {
          notify("Product updated.");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          refetch();
          resetToNew();
        },
        onError: (e: any) => notify(e?.message ?? "Update failed.", true),
      },
    );
  }

  function handleDelete() {
    if (!selectedId) { notify("Select a product first.", true); return; }
    setDeleteConfirm(true);
  }

  function confirmDelete() {
    if (!selectedId) return;
    deleteProduct.mutate(
      { id: selectedId },
      {
        onSuccess: () => {
          notify("Product deleted.");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          refetch();
          resetToNew();
          setDeleteConfirm(false);
        },
        onError: (e: any) => {
          notify(e?.message ?? "Delete failed.", true);
          setDeleteConfirm(false);
        },
      },
    );
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        mode === "new" ? handleSave() : mode === "edit" ? handleUpdate() : void 0;
      }
      if (e.key === "Escape") { e.preventDefault(); handleExit(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedId, form]);

  // ── Enter → next field ────────────────────────────────────────────────────
  function onEnter(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const wrapper = e.currentTarget.closest("div[data-form]");
    if (!wrapper) return;
    const els = Array.from(
      wrapper.querySelectorAll<HTMLElement>("input,select,textarea"),
    ).filter((el) => !el.hasAttribute("disabled"));
    const idx = els.indexOf(e.currentTarget as HTMLElement);
    els[idx + 1]?.focus();
  }

  // Item Code field: Enter triggers lookup, then moves focus
  function onItemCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = (e.currentTarget as HTMLInputElement).value;
      lookupByItemCode(val).then(() => {
        // move focus to next field after lookup completes
        const wrapper = e.currentTarget.closest("div[data-form]");
        if (!wrapper) return;
        const els = Array.from(
          wrapper.querySelectorAll<HTMLElement>("input,select,textarea"),
        ).filter((el) => !el.hasAttribute("disabled"));
        const idx = els.indexOf(e.currentTarget as HTMLElement);
        els[idx + 1]?.focus();
      });
    }
  }

  const isBusy =
    createProduct.isPending || updateProduct.isPending || deleteProduct.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground select-none overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex justify-center border-b border-border bg-card shrink-0 shadow-sm">
        <TBtn icon={RefreshCcw} label="Refresh" onClick={handleRefresh} />
        <div className="w-px bg-border my-1" />
        <TBtn
          icon={Save}   label="Save"
          onClick={handleSave}
          disabled={mode !== "new" || isBusy}
          className="text-primary"
        />
        <TBtn
          icon={Pencil} label="Update"
          onClick={handleUpdate}
          disabled={mode !== "edit" || isBusy}
          className="text-amber-600"
        />
        <TBtn
          icon={Trash2} label="Delete"
          onClick={handleDelete}
          disabled={!selectedId || isBusy}
          className="text-destructive"
        />
        <div className="w-px bg-border my-1" />
        <TBtn icon={Printer} label="Print"  disabled className="text-muted-foreground" />
        <div className="w-px bg-border my-1" />
        <TBtn icon={LogOut}  label="Exit"   onClick={handleExit} className="text-muted-foreground" />
      </div>

      {/* ── Status bar ── */}
      {msg && (
        <div
          className={`text-xs px-3 py-0.5 shrink-0 font-medium ${
            msg.err
              ? "bg-destructive/10 text-destructive border-b border-destructive/20"
              : "bg-green-50 text-green-700 border-b border-green-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ── Form ── */}
      <div
        className="border-b border-border bg-card px-3 py-2 shrink-0 shadow-sm"
        data-form=""
      >
        {/* Row 1: DB ID (display) | Item Code (lookup) | Product Name | Urdu Name */}
        <div className="grid grid-cols-[auto_auto_1fr_auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1.5 mb-1.5">

          {/* DB ID — read-only display of next serial or current record's id */}
          <label className={LBL}>ID :</label>
          <input
            readOnly
            tabIndex={-1}
            value={mode === "edit" && selectedId ? selectedId : nextSerial}
            className={
              "bg-muted/50 border border-border text-muted-foreground text-xs h-6 px-1.5 w-12 rounded-sm cursor-default select-none"
            }
            title={mode === "edit" ? `Record ID: ${selectedId}` : `Next available ID: ${nextSerial}`}
          />

          <label className={LBL}>Item Code :</label>
          <div className="flex gap-1">
            <input
              ref={firstFieldRef}
              className={INP}
              value={form.itemCode ?? ""}
              onChange={(e) => setField("itemCode", e.target.value)}
              onKeyDown={onItemCodeKeyDown}
              data-testid="input-product-itemcode"
              title="Type an existing Item Code and press Enter to load that product"
            />
            <button
              className="bg-muted border border-border text-muted-foreground hover:bg-accent text-[10px] px-2 h-6 shrink-0 rounded-sm"
              onClick={() => document.getElementById("reg-search")?.focus()}
            >
              ? Search
            </button>
          </div>

          <label className={LBL}>Item Name :</label>
          <input
            className={INP}
            value={form.productName ?? ""}
            onChange={(e) => setField("productName", e.target.value)}
            onKeyDown={onEnter}
            data-testid="input-product-name"
          />

          <label className={LBL}>Urdu Name :</label>
          <input
            className={`${INP} text-right`}
            dir="rtl"
            placeholder="Urdu Name"
            value={form.urduName ?? ""}
            onChange={(e) => setField("urduName", e.target.value)}
            onKeyDown={onEnter}
            data-testid="input-product-urduname"
          />
        </div>

        {/* Row 2: Category | Scale | QTY | Stock Factor | Length | Rate | Remarks */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className={LBL}>Main Category:</label>
            <select
              className={`${SEL} w-36`}
              value={mainCategoryId ?? ""}
              data-testid="select-product-maincategory"
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setMainCategoryId(val);
                setField("category", null);
              }}
              onKeyDown={onEnter}
            >
              <option value="">— Select —</option>
              {mainCategories.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className={LBL}>Sub Category:</label>
            <select
              className={`${SEL} w-36`}
              value={form.category ?? ""}
              disabled={!mainCategoryId}
              data-testid="select-product-subcategory"
              onChange={(e) => setField("category", e.target.value || null)}
              onKeyDown={onEnter}
            >
              <option value="">— Select —</option>
              {subCategories.map((c: Category) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className={LBL}>Scale:</label>
            <select
              className={`${SEL} w-20`}
              value={form.scale ?? "Ng"}
              onChange={(e) => setField("scale", e.target.value)}
              onKeyDown={onEnter}
              data-testid="select-product-scale"
            >
              {SCALE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className={LBL}>QTY</label>
            <input
              type="number"
              className={`${INP} w-16`}
              value={form.qty ?? 0}
              onChange={(e) => setField("qty", Number(e.target.value))}
              onKeyDown={onEnter}
              data-testid="input-product-qty"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className={LBL}>Stock Factor</label>
            <input
              type="number"
              className={`${INP} w-16`}
              value={form.stockFactor ?? 1}
              onChange={(e) => setField("stockFactor", Number(e.target.value))}
              onKeyDown={onEnter}
              data-testid="input-product-stockfactor"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className={LBL}>Length (m)</label>
            <input
              type="number"
              className={`${INP} w-20`}
              placeholder="0"
              value={form.length ?? ""}
              onChange={(e) => setField("length", e.target.value || null)}
              onKeyDown={onEnter}
              data-testid="input-product-length"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className={LBL}>Rate:</label>
            <input
              type="number"
              className={`${INP} w-20`}
              placeholder="0"
              value={form.rate ?? ""}
              onChange={(e) => setField("rate", e.target.value || null)}
              onKeyDown={onEnter}
              data-testid="input-product-rate"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <label className={LBL}>Remarks:</label>
            <input
              className={`${INP} min-w-0`}
              value={form.remarks ?? ""}
              onChange={(e) => setField("remarks", e.target.value || null)}
              onKeyDown={onEnter}
              data-testid="input-product-remarks"
            />
          </div>
        </div>
      </div>

      {/* ── Register search bar ── */}
      <div className="flex items-center gap-2 px-3 py-1 bg-muted/40 border-b border-border shrink-0">
        <span className="text-[11px] text-muted-foreground">Search:</span>
        <input
          id="reg-search"
          className="bg-background border border-border text-foreground text-xs h-5 px-1.5 w-48
            focus:outline-none focus:border-primary rounded-sm"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Type to filter..."
        />
        <span className="text-[10px] text-muted-foreground ml-auto">
          {total} record{total !== 1 ? "s" : ""}
          {total > PAGE_SIZE && ` — page ${page + 1} of ${pages}`}
        </span>
      </div>

      {/* ── Register grid ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-primary text-primary-foreground">
              {["ID", "Item Code", "Product Name", "Category", "Scale", "Length", "Rate", "Remarks"].map((h) => (
                <th
                  key={h}
                  className="text-left px-2 py-1.5 border-r border-primary/40 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-2 py-1">
                      <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const isSelected = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : i % 2 === 0
                        ? "bg-background hover:bg-muted/60 text-foreground"
                        : "bg-muted/30 hover:bg-muted/60 text-foreground"
                    }`}
                    onClick={() => setSelectedId(row.id)}
                    onDoubleClick={() => loadRow(row)}
                    data-testid={`row-entity-${row.id}`}
                  >
                    <td className="px-2 py-0.5 border-r border-border font-mono text-muted-foreground">{row.id}</td>
                    <td className="px-2 py-0.5 border-r border-border font-mono">{row.itemCode}</td>
                    <td className="px-2 py-0.5 border-r border-border">{row.productName}</td>
                    <td className="px-2 py-0.5 border-r border-border">{row.category ?? "—"}</td>
                    <td className="px-2 py-0.5 border-r border-border text-right font-urdu">{scaleLabel(row.scale)}</td>
                    <td className="px-2 py-0.5 border-r border-border text-right">{row.length ?? "—"}</td>
                    <td className="px-2 py-0.5 border-r border-border text-right">{row.rate ?? "—"}</td>
                    <td className="px-2 py-0.5 text-muted-foreground">{row.remarks ?? ""}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-1 bg-card border-t border-border shrink-0">
          <button
            className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/80 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ◄ Prev
          </button>
          <span className="text-[10px] text-muted-foreground">
            Page {page + 1} / {pages}
          </span>
          <button
            className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/80 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
          >
            Next ►
          </button>
        </div>
      )}

      {/* ── Mode badge / hint bar ── */}
      <div className="flex items-center gap-3 px-3 py-0.5 bg-muted/40 border-t border-border shrink-0 text-[10px]">
        <span
          className={`px-1.5 py-0.5 rounded font-semibold ${
            mode === "new"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {mode === "new" ? "NEW" : "EDIT"}
        </span>
        <span className="text-muted-foreground">
          Ctrl+S=Save · Esc=Exit · Type Item Code + Enter to look up · Double-click row to edit
        </span>
      </div>

      {/* ── Delete confirm overlay ── */}
      {deleteConfirm && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40">
          <div className="bg-card border border-border rounded-md p-6 text-center max-w-xs shadow-xl">
            <p className="text-sm mb-4 text-foreground">
              Delete this product?
              <br />
              <span className="text-destructive font-medium">This cannot be undone.</span>
            </p>
            <div className="flex justify-center gap-3">
              <button
                className="px-5 py-1.5 bg-destructive text-destructive-foreground rounded-sm text-sm hover:bg-destructive/90"
                onClick={confirmDelete}
                disabled={isBusy}
              >
                {isBusy ? "Deleting…" : "Delete"}
              </button>
              <button
                className="px-5 py-1.5 bg-muted text-foreground rounded-sm text-sm hover:bg-muted/80 border border-border"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
