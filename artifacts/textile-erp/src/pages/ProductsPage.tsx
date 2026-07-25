/**
 * ProductsPage — Desktop ERP style, follows reference image layout.
 *
 * Layout:
 *   Top toolbar   → Refresh | New | Save | Update | Delete | Print | Exit
 *   Form section  → always-visible compact fields
 *   Register grid → double-click row to load into form
 *
 * Keyboard:
 *   Enter → next field   F2 → New   Ctrl+S → Save   Esc → Exit
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
} from "@workspace/api-client-react";
import type { Product, ProductInput } from "@workspace/api-client-react";
import {
  RefreshCcw, FilePlus, Save, Pencil, Trash2, Printer, LogOut,
} from "lucide-react";

// ── Scale display mapping ────────────────────────────────────────────────────
const SCALE_OPTIONS: { value: string; label: string }[] = [
  { value: "Ng",   label: "نگ" },
  { value: "Set",  label: "سیٹ" },
  { value: "Suit", label: "سوٹ" },
  { value: "Than", label: "تھان" },
];

const CATEGORY_OPTIONS = ["Shalwar", "Kameez", "Dupatta", "Embroidery"];

const scaleLabel = (val: string) =>
  SCALE_OPTIONS.find((o) => o.value === val)?.label ?? val;

// ── Empty form state ─────────────────────────────────────────────────────────
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

type Mode = "idle" | "new" | "edit";

// ── ERP Input styles ─────────────────────────────────────────────────────────
const INP =
  "bg-[#0d0d1a] border border-[#444] text-white text-xs h-6 px-1 focus:outline-none focus:border-blue-400 w-full";
const SEL =
  "bg-[#0d0d1a] border border-[#444] text-white text-xs h-6 px-1 focus:outline-none focus:border-blue-400 w-full cursor-pointer";
const LBL = "text-[#aaa] text-xs whitespace-nowrap";

// ── Toolbar button ───────────────────────────────────────────────────────────
function TBtn({
  icon: Icon, label, onClick, disabled, color = "text-white",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 px-4 py-1.5 hover:bg-[#2d2d50] transition-colors disabled:opacity-40 disabled:pointer-events-none ${color}`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

export default function ProductsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [mode, setMode]               = useState<Mode>("idle");
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [form, setForm]               = useState<ProductInput>(EMPTY);
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [msg, setMsg]                 = useState<{ text: string; err?: boolean } | null>(null);

  const PAGE_SIZE = 50;
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useListProducts({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Notify helper ──────────────────────────────────────────────────────────
  function notify(text: string, err = false) {
    setMsg({ text, err });
    setTimeout(() => setMsg(null), 3000);
  }

  // ── Form field update ──────────────────────────────────────────────────────
  function setField<K extends keyof ProductInput>(k: K, v: ProductInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // ── Load a row into the form ───────────────────────────────────────────────
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
  }

  // ── Toolbar actions ────────────────────────────────────────────────────────
  function handleNew() {
    setMode("new");
    setSelectedId(null);
    setForm(EMPTY);
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    refetch();
    setMode("idle");
    setSelectedId(null);
    setForm(EMPTY);
    setSearch("");
    setPage(0);
  }

  function handleExit() {
    if (mode !== "idle") { setMode("idle"); setSelectedId(null); setForm(EMPTY); }
    else setLocation("/stock/add");
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
          handleNew();
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
          setMode("idle");
          setSelectedId(null);
          setForm(EMPTY);
          setDeleteConfirm(false);
        },
        onError: (e: any) => { notify(e?.message ?? "Delete failed.", true); setDeleteConfirm(false); },
      },
    );
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") { e.preventDefault(); handleNew(); }
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); mode === "new" ? handleSave() : mode === "edit" ? handleUpdate() : void 0; }
      if (e.key === "Escape") { e.preventDefault(); handleExit(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedId, form]);

  // ── Enter → next field ─────────────────────────────────────────────────────
  function onEnter(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const form_ = e.currentTarget.closest("div[data-form]");
    if (!form_) return;
    const focusables = Array.from(
      form_.querySelectorAll<HTMLElement>("input,select,textarea"),
    ).filter((el) => !el.hasAttribute("disabled"));
    const idx = focusables.indexOf(e.currentTarget as HTMLElement);
    focusables[idx + 1]?.focus();
  }

  const isBusy = createProduct.isPending || updateProduct.isPending || deleteProduct.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full bg-[#12121e] text-white select-none overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex justify-center border-b border-[#333] bg-[#1a1a2e] shrink-0">
        <TBtn icon={RefreshCcw}  label="Refresh" onClick={handleRefresh} />
        <div className="w-px bg-[#333] my-1" />
        <TBtn icon={FilePlus}    label="New"     onClick={handleNew}    color="text-green-400" />
        <TBtn icon={Save}        label="Save"    onClick={handleSave}   disabled={mode !== "new" || isBusy}   color="text-blue-400" />
        <TBtn icon={Pencil}      label="Update"  onClick={handleUpdate} disabled={mode !== "edit" || isBusy}  color="text-yellow-400" />
        <TBtn icon={Trash2}      label="Delete"  onClick={handleDelete} disabled={!selectedId || isBusy}      color="text-red-400" />
        <div className="w-px bg-[#333] my-1" />
        <TBtn icon={Printer}     label="Print"   disabled color="text-gray-400" />
        <div className="w-px bg-[#333] my-1" />
        <TBtn icon={LogOut}      label="Exit"    onClick={handleExit}  color="text-gray-300" />
      </div>

      {/* ── Status bar ── */}
      {msg && (
        <div className={`text-xs px-3 py-0.5 shrink-0 ${msg.err ? "bg-red-900 text-red-200" : "bg-[#1a3a1a] text-green-300"}`}>
          {msg.text}
        </div>
      )}

      {/* ── Form ── */}
      <div className="border-b border-[#333] bg-[#1a1a2e] px-3 py-2 shrink-0" data-form="">
        {/* Row 1: Item Code | Product Name | Urdu Name */}
        <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1.5 mb-1.5">
          <label className={LBL}>Item Code :</label>
          <div className="flex gap-1">
            <input
              ref={firstFieldRef}
              className={INP}
              value={form.itemCode ?? ""}
              onChange={(e) => setField("itemCode", e.target.value)}
              onKeyDown={onEnter}
              data-testid="input-product-itemcode"
            />
            <button
              className="bg-[#1e3a5f] border border-[#446] text-white text-[10px] px-2 h-6 hover:bg-[#2a4f7f] shrink-0"
              onClick={() => {
                /* search by item code — focus search */
                const el = document.getElementById("reg-search");
                if (el) el.focus();
              }}
            >? Search</button>
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
            placeholder="اردو نام"
            value={form.urduName ?? ""}
            onChange={(e) => setField("urduName", e.target.value)}
            onKeyDown={onEnter}
            data-testid="input-product-urduname"
          />
        </div>

        {/* Row 2: Category | Scale | QTY | تھان (stockFactor) | میٹر (length) | Rate */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className={LBL}>Category:</label>
            <select
              className={`${SEL} w-36`}
              value={form.category ?? ""}
              onChange={(e) => setField("category", e.target.value || null)}
              onKeyDown={onEnter}
              data-testid="select-product-category"
            >
              <option value="">— Select —</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
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
            <label className={`${LBL} font-urdu`}>تھان</label>
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
            <label className={`${LBL} font-urdu`}>میٹر</label>
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
      <div className="flex items-center gap-2 px-3 py-1 bg-[#16162a] border-b border-[#333] shrink-0">
        <span className="text-[11px] text-[#888]">Search:</span>
        <input
          id="reg-search"
          className="bg-[#0d0d1a] border border-[#444] text-white text-xs h-5 px-1.5 w-48 focus:outline-none focus:border-blue-400"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Type to filter..."
        />
        <span className="text-[10px] text-[#666] ml-auto">
          {total} record{total !== 1 ? "s" : ""}
          {total > PAGE_SIZE && ` — page ${page + 1} of ${pages}`}
        </span>
      </div>

      {/* ── Register grid ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0f3460] text-white">
              {["Item Code", "Product Name", "Category", "Scale", "Length", "Rate", "Remarks"].map((h) => (
                <th key={h} className="text-left px-2 py-1 border-r border-[#1e5090] font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-[#222]">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-2 py-1">
                      <div className="h-3 bg-[#2a2a3e] rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-[#555]">
                  No products found.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const isSelected = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-[#222] cursor-pointer transition-colors
                      ${isSelected
                        ? "bg-[#1e3a5f] text-white"
                        : i % 2 === 0
                          ? "bg-[#12121e] hover:bg-[#1a1a30] text-[#ccc]"
                          : "bg-[#15152a] hover:bg-[#1a1a30] text-[#ccc]"
                      }`}
                    onClick={() => setSelectedId(row.id)}
                    onDoubleClick={() => loadRow(row)}
                    data-testid={`row-entity-${row.id}`}
                  >
                    <td className="px-2 py-0.5 border-r border-[#222] font-mono">{row.itemCode}</td>
                    <td className="px-2 py-0.5 border-r border-[#222]">{row.productName}</td>
                    <td className="px-2 py-0.5 border-r border-[#222]">{row.category ?? "—"}</td>
                    <td className="px-2 py-0.5 border-r border-[#222] text-right font-urdu">{scaleLabel(row.scale)}</td>
                    <td className="px-2 py-0.5 border-r border-[#222] text-right">{row.length ?? "—"}</td>
                    <td className="px-2 py-0.5 border-r border-[#222] text-right">{row.rate ?? "—"}</td>
                    <td className="px-2 py-0.5 text-[#888]">{row.remarks ?? ""}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-1 bg-[#16162a] border-t border-[#333] shrink-0">
          <button
            className="text-[10px] px-2 py-0.5 bg-[#0f3460] hover:bg-[#1e5090] disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >◄ Prev</button>
          <span className="text-[10px] text-[#888]">Page {page + 1} / {pages}</span>
          <button
            className="text-[10px] px-2 py-0.5 bg-[#0f3460] hover:bg-[#1e5090] disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
          >Next ►</button>
        </div>
      )}

      {/* ── Mode badge ── */}
      <div className="flex items-center gap-3 px-3 py-0.5 bg-[#0f0f1a] border-t border-[#333] shrink-0 text-[10px]">
        <span className={`px-1.5 py-0.5 rounded ${
          mode === "new"  ? "bg-green-900 text-green-300"  :
          mode === "edit" ? "bg-yellow-900 text-yellow-300" :
                            "bg-[#222] text-[#555]"
        }`}>
          {mode === "new" ? "NEW" : mode === "edit" ? "EDIT" : "BROWSE"}
        </span>
        <span className="text-[#555]">F2=New · Ctrl+S=Save · Esc=Exit · Double-click row to edit</span>
      </div>

      {/* ── Delete confirm overlay ── */}
      {deleteConfirm && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/70">
          <div className="bg-[#1a1a2e] border border-[#444] p-6 text-center max-w-xs">
            <p className="text-sm mb-4">Delete this product?<br /><span className="text-red-400">This cannot be undone.</span></p>
            <div className="flex justify-center gap-4">
              <button className="px-6 py-1 bg-red-700 hover:bg-red-600 text-white text-sm" onClick={confirmDelete} disabled={isBusy}>
                {isBusy ? "Deleting…" : "Delete"}
              </button>
              <button className="px-6 py-1 bg-[#333] hover:bg-[#444] text-white text-sm" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
