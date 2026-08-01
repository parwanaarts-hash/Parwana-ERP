import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PurchaseGatePassInput,
  PurchaseGatePass,
  Product,
  PurchaseParty,
} from "@workspace/api-client-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Plus, Trash2 } from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  productId: z.coerce.number().min(1, "Select a product"),
  qty: z.string().optional(),
  gazana: z.string().optional(),
  rate: z.string().optional(),
  receivedQty: z.string().optional(),
});

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  purchasePartyId: z.coerce.number().min(1, "Select a party"),
  lotNumber: z.string().min(1, "Lot # is required"),
  remarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type FormData = z.infer<typeof schema>;

// ── Product search ────────────────────────────────────────────────────────────
// Matches against itemCode and productName (English).
// When the backend adds urduName, add: || (p.urduName ?? "").includes(q)
// Urdu is RTL and does not use toLowerCase — keep that branch separate.
function matchesProduct(p: Product, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    p.itemCode.toLowerCase().includes(lower) ||
    p.productName.toLowerCase().includes(lower)
  );
}

// ── ProductCombobox ───────────────────────────────────────────────────────────
interface ProductComboboxProps {
  productId: number;
  products: Product[];
  onSelect: (id: number) => void;
  onMoveNext: () => void;
  rowIdx: number;
  // Future: urduNames?: Record<number, string>  ← injected for print display
}

function ProductCombobox({
  productId,
  products,
  onSelect,
  onMoveNext,
  rowIdx,
}: ProductComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hiIdx, setHiIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = products.find(p => p.id === productId);
  // Display: English values only. Urdu display for print documents will be
  // injected separately without changing this data-entry screen.
  const displayVal = open
    ? query
    : selected
    ? `${selected.itemCode} – ${selected.productName}`
    : "";

  const filtered = (() => {
    const q = query.trim();
    const list = q ? products.filter(p => matchesProduct(p, q)) : products;
    return list.slice(0, 40);
  })();

  const pick = (p: Product) => {
    onSelect(p.id);
    setQuery("");
    setOpen(false);
    onMoveNext();
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={displayVal}
        placeholder="Search by code or name…"
        autoComplete="off"
        spellCheck={false}
        data-grid-row={rowIdx}
        data-grid-col={0}
        // data-product-id stored for future Urdu print overlay
        data-product-id={productId || undefined}
        className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setHiIdx(0);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHiIdx(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={e => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHiIdx(i => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHiIdx(i => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (open && filtered[hiIdx]) {
              pick(filtered[hiIdx]);
            } else if (!open && productId) {
              onMoveNext();
            } else {
              setOpen(true);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] top-full left-0 mt-0.5 w-96 max-h-56 overflow-y-auto bg-popover border rounded-md shadow-xl">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              onMouseDown={() => pick(p)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer select-none ${
                i === hiIdx
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <span
                className={`font-mono text-xs px-1.5 py-0.5 rounded shrink-0 ${
                  i === hiIdx
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.itemCode}
              </span>
              <span className="truncate flex-1">{p.productName}</span>
              <span
                className={`text-xs shrink-0 ${
                  i === hiIdx
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                }`}
              >
                {p.scale}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split("T")[0];
const toNum = (s?: string) => parseFloat(s || "0") || 0;
const fmtNum = (n: number, dec = 3) =>
  n.toLocaleString("en-PK", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

const emptyItem = (): FormData["items"][0] => ({
  productId: 0,
  qty: "",
  gazana: "",
  rate: "",
  receivedQty: "",
});

const defaultValues = (d?: PurchaseGatePass): FormData => ({
  date: d?.date ?? today,
  purchasePartyId: d?.purchasePartyId ?? 0,
  lotNumber: d?.lotNumber ?? "",
  remarks: d?.remarks ?? "",
  items: d?.items?.length
    ? d.items.map(i => ({
        productId: i.productId,
        qty: i.qty ?? "",
        gazana: i.gazana ?? "",
        rate: i.rate ?? "",
        receivedQty: i.receivedQty ?? "",
      }))
    : [emptyItem()],
});

const cellCls =
  "h-8 w-full rounded border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring tabular-nums";

// ── Main form ─────────────────────────────────────────────────────────────────
export interface PurchaseGatePassFormProps {
  gpNumber?: string;
  initialData?: PurchaseGatePass;
  products: Product[];
  purchaseParties: PurchaseParty[];
  onSubmit: (data: PurchaseGatePassInput) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function PurchaseGatePassForm({
  gpNumber,
  initialData,
  products,
  purchaseParties,
  onSubmit,
  onDirtyChange,
}: PurchaseGatePassFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(initialData),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Reset when switching records
  useEffect(() => {
    form.reset(defaultValues(initialData));
  }, [initialData?.id]);

  // Propagate dirty state upward
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Browser-level unsaved-changes guard
  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  // Live totals — qty and gazana only.
  // NOTE: Amount (qty × rate) is NOT computed here. Monetary totals belong
  // to the Purchase Bill, not the Gate Pass. The backend stores no amount
  // field on gate pass items; billing happens at purchase_bill_items.
  const watchedItems = form.watch("items");
  const totalQty = watchedItems.reduce((s, i) => s + toNum(i.qty), 0);
  const totalGazana = watchedItems.reduce((s, i) => s + toNum(i.gazana), 0);

  // Focus management
  const focusCell = useCallback((row: number, col: number) => {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-grid-row="${row}"][data-grid-col="${col}"]`
      );
      el?.focus();
    }, 25);
  }, []);

  const handleCellEnter = useCallback(
    (rowIdx: number, colIdx: number, currentFieldsLen: number) => {
      const LAST_COL = 4; // receivedQty
      if (colIdx < LAST_COL) {
        focusCell(rowIdx, colIdx + 1);
      } else {
        if (rowIdx === currentFieldsLen - 1) {
          append(emptyItem());
          setTimeout(() => focusCell(rowIdx + 1, 0), 60);
        } else {
          focusCell(rowIdx + 1, 0);
        }
      }
    },
    [append, focusCell]
  );

  const handleProductSelect = useCallback(
    (rowIdx: number, productId: number) => {
      form.setValue(`items.${rowIdx}.productId`, productId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      // Rate is NOT auto-filled from any local cache.
      // Rate comes from what the operator types per transaction.
      // If a "last rate" feature is needed in future, it must come from the
      // backend (e.g. a GET /products/:id/last-rate endpoint), never from
      // browser storage.
    },
    [form]
  );

  const handleSubmit = (data: FormData) => {
    const payload: PurchaseGatePassInput = {
      date: data.date,
      purchasePartyId: Number(data.purchasePartyId),
      lotNumber: data.lotNumber,
      remarks: data.remarks || undefined,
      items: data.items.map(item => ({
        productId: Number(item.productId),
        qty: item.qty || undefined,
        gazana: item.gazana || undefined,
        rate: item.rate || undefined,
        receivedQty: item.receivedQty || undefined,
      })),
    };
    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form
        id="entity-form"
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col"
      >
        {/* ── Unsaved changes banner ────────────────────────────────────────── */}
        {isDirty && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Unsaved changes —{" "}
            <kbd className="mx-0.5 px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs font-mono">
              Ctrl+S
            </kbd>{" "}
            to save or{" "}
            <kbd className="mx-0.5 px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs font-mono">
              Esc
            </kbd>{" "}
            to discard
          </div>
        )}

        {/* ── Header strip ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 px-4 py-3 bg-muted/20 border-b">
          {/* GP # — system-assigned, read-only */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground leading-none">
              GP #
            </label>
            <Input
              value={gpNumber ?? "Auto"}
              readOnly
              disabled
              className="h-8 text-sm bg-muted/60 cursor-not-allowed font-mono"
              data-testid="input-gp-number"
            />
          </div>

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs font-medium text-muted-foreground leading-none">
                  Date
                </FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    className="h-8 text-sm"
                    data-testid="input-gp-date"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (
                          e.currentTarget
                            .closest("form")
                            ?.querySelector(
                              "[data-testid='select-gp-party'] button"
                            ) as HTMLElement | null
                        )?.focus();
                      }
                    }}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Purchase Party */}
          <FormField
            control={form.control}
            name="purchasePartyId"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs font-medium text-muted-foreground leading-none">
                  Purchase Party
                </FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={v => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger
                      className="h-8 text-sm"
                      data-testid="select-gp-party"
                    >
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {purchaseParties.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Lot # */}
          <FormField
            control={form.control}
            name="lotNumber"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs font-medium text-muted-foreground leading-none">
                  Lot #
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-8 text-sm font-mono"
                    data-testid="input-gp-lotnumber"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (
                          e.currentTarget
                            .closest("form")
                            ?.querySelector(
                              "[data-testid='input-gp-remarks']"
                            ) as HTMLElement | null
                        )?.focus();
                      }
                    }}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Remarks */}
          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem className="space-y-1 lg:col-span-2">
                <FormLabel className="text-xs font-medium text-muted-foreground leading-none">
                  Remarks
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-8 text-sm"
                    data-testid="input-gp-remarks"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusCell(0, 0);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        {/* ── Items grid ────────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1">
          {/* Grid toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/10 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Items
              {(form.formState.errors.items as { message?: string } | undefined)
                ?.message && (
                <span className="ml-2 normal-case font-normal text-destructive">
                  —{" "}
                  {
                    (
                      form.formState.errors.items as {
                        message?: string;
                      }
                    ).message
                  }
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                append(emptyItem());
                setTimeout(() => focusCell(fields.length, 0), 60);
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 px-2.5 py-1.5 rounded-md hover:bg-blue-50 transition-colors border border-blue-200 hover:border-blue-300"
              data-testid="button-add-row"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          </div>

          {/* Grid */}
          <div
            className="overflow-auto"
            style={{ minHeight: "260px", maxHeight: "420px" }}
          >
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="border-b border-r px-2 py-2 text-center text-xs font-medium text-muted-foreground w-8 select-none">
                    #
                  </th>
                  <th
                    className="border-b border-r px-3 py-2 text-left text-xs font-medium text-muted-foreground select-none"
                    style={{ minWidth: "220px" }}
                  >
                    Product
                  </th>
                  <th className="border-b border-r px-3 py-2 text-right text-xs font-medium text-muted-foreground w-24 select-none">
                    Qty
                  </th>
                  <th className="border-b border-r px-3 py-2 text-right text-xs font-medium text-muted-foreground w-24 select-none">
                    Gazana
                  </th>
                  <th className="border-b border-r px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28 select-none">
                    Rate
                  </th>
                  <th className="border-b border-r px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28 select-none">
                    Rcvd Qty
                  </th>
                  <th className="border-b px-2 py-2 text-center text-xs text-muted-foreground w-10 select-none" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const row = watchedItems[index];
                  // pendingQty = qty − receivedQty, computed at runtime for
                  // operator awareness. Not sent to backend separately.
                  const pendingQty =
                    toNum(row?.qty) - toNum(row?.receivedQty);

                  return (
                    <tr
                      key={field.id}
                      className="border-b hover:bg-blue-50/20 transition-colors group"
                    >
                      {/* Row # */}
                      <td className="border-r px-2 py-1 text-center text-xs text-muted-foreground select-none">
                        {index + 1}
                      </td>

                      {/* Product combobox */}
                      <td className="border-r px-1.5 py-1">
                        <ProductCombobox
                          productId={row?.productId ?? 0}
                          products={products}
                          onSelect={id => handleProductSelect(index, id)}
                          onMoveNext={() => focusCell(index, 1)}
                          rowIdx={index}
                        />
                        {form.formState.errors.items?.[index]?.productId && (
                          <p className="text-xs text-destructive mt-0.5 px-0.5">
                            {
                              form.formState.errors.items[index].productId
                                ?.message
                            }
                          </p>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="border-r px-1.5 py-1">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0"
                          {...form.register(`items.${index}.qty`)}
                          data-grid-row={index}
                          data-grid-col={1}
                          className={cellCls}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCellEnter(index, 1, fields.length);
                            }
                          }}
                        />
                      </td>

                      {/* Gazana */}
                      <td className="border-r px-1.5 py-1">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0"
                          {...form.register(`items.${index}.gazana`)}
                          data-grid-row={index}
                          data-grid-col={2}
                          className={cellCls}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCellEnter(index, 2, fields.length);
                            }
                          }}
                        />
                      </td>

                      {/* Rate */}
                      <td className="border-r px-1.5 py-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...form.register(`items.${index}.rate`)}
                          data-grid-row={index}
                          data-grid-col={3}
                          className={cellCls}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCellEnter(index, 3, fields.length);
                            }
                          }}
                        />
                      </td>

                      {/* Received Qty */}
                      <td className="border-r px-1.5 py-1">
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0"
                            {...form.register(`items.${index}.receivedQty`)}
                            data-grid-row={index}
                            data-grid-col={4}
                            className={cellCls}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCellEnter(index, 4, fields.length);
                              }
                            }}
                          />
                          {/* Pending indicator — operator awareness only */}
                          {toNum(row?.qty) > 0 && pendingQty !== 0 && (
                            <span
                              className={`text-[10px] text-right tabular-nums leading-none ${
                                pendingQty > 0
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              Pending: {fmtNum(pendingQty)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Delete row */}
                      <td className="px-1.5 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length <= 1}
                          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete row"
                          data-testid={`button-delete-row-${index}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Totals footer ────────────────────────────────────────────────── */}
          {/* Only qty and gazana are totalled here. Amount totals belong to   */}
          {/* the Purchase Bill — the gate pass has no monetary total.         */}
          <div className="flex items-center gap-8 px-4 py-2.5 bg-muted/30 border-t text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Total Qty:
              </span>
              <span className="font-semibold tabular-nums min-w-[4rem] text-right">
                {totalQty > 0 ? fmtNum(totalQty) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Total Gazana:
              </span>
              <span className="font-semibold tabular-nums min-w-[4rem] text-right">
                {totalGazana > 0 ? fmtNum(totalGazana) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Total Items:
              </span>
              <span className="font-semibold tabular-nums">
                {fields.length}
              </span>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
