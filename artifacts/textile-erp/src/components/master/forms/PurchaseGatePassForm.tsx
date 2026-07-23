import { useEffect } from "react";
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
import { Plus, Trash2 } from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId: z.coerce.number().min(1, "Select a product"),
  qty: z.string().optional(),
  gazana: z.string().optional(),
  rate: z.string().optional(),
  receivedQty: z.string().optional(),
});

const schema = z.object({
  date: z.string().min(1, "Required"),
  purchasePartyId: z.coerce.number().min(1, "Select a party"),
  lotNumber: z.string().min(1, "Required"),
  remarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type FormData = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

interface PurchaseGatePassFormProps {
  gpNumber?: string;
  initialData?: PurchaseGatePass;
  products: Product[];
  purchaseParties: PurchaseParty[];
  onSubmit: (data: PurchaseGatePassInput) => void;
}

const today = new Date().toISOString().split("T")[0];

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
  items:
    d?.items && d.items.length > 0
      ? d.items.map((item) => ({
          productId: item.productId,
          qty: item.qty ?? "",
          gazana: item.gazana ?? "",
          rate: item.rate ?? "",
          receivedQty: item.receivedQty ?? "",
        }))
      : [emptyItem()],
});

export function PurchaseGatePassForm({
  gpNumber,
  initialData,
  products,
  purchaseParties,
  onSubmit,
}: PurchaseGatePassFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(initialData),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Reset form whenever initialData changes (e.g. switching records)
  useEffect(() => {
    form.reset(defaultValues(initialData));
  }, [initialData?.id]); // only re-reset when the record id changes

  const handleSubmit = (data: FormData) => {
    const payload: PurchaseGatePassInput = {
      date: data.date,
      purchasePartyId: Number(data.purchasePartyId),
      lotNumber: data.lotNumber,
      remarks: data.remarks || undefined,
      items: data.items.map((item) => ({
        productId: Number(item.productId),
        qty: item.qty || undefined,
        gazana: item.gazana || undefined,
        rate: item.rate || undefined,
        receivedQty: item.receivedQty || undefined,
      })),
    };
    onSubmit(payload);
  };

  const addRow = () => append(emptyItem());

  // Shared class for compact inline inputs in the grid
  const cellInput =
    "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

  return (
    <Form {...form}>
      <form
        id="entity-form"
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5"
      >
        {/* ── Header Fields ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* GP Number – read-only */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">
              GP # / جی پی نمبر
            </label>
            <Input
              value={gpNumber ?? "Auto"}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              data-testid="input-gp-number"
            />
          </div>

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date / تاریخ</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    data-testid="input-gp-date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Purchase Party */}
          <FormField
            control={form.control}
            name="purchasePartyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Party / فریق</FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-gp-party">
                      <SelectValue placeholder="Select party..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {purchaseParties.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Lot Number */}
          <FormField
            control={form.control}
            name="lotNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lot # / لاٹ نمبر</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-gp-lotnumber" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remarks */}
          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks / ریمارکس</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Optional..."
                    data-testid="input-gp-remarks"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Items Grid ────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              Items / اشیاء
              {(form.formState.errors.items as any)?.message && (
                <span className="ml-2 text-xs font-normal text-destructive">
                  — {(form.formState.errors.items as any).message}
                </span>
              )}
            </h4>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              data-testid="button-add-row"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          </div>

          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs w-8 text-muted-foreground">
                    #
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">
                    Product / پروڈکٹ
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-24 text-muted-foreground">
                    Qty / مقدار
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-24 text-muted-foreground">
                    Gazana / گزانہ
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-28 text-muted-foreground">
                    Rate / ریٹ
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-28 text-muted-foreground">
                    Rcvd Qty / موصول
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr
                    key={field.id}
                    className="border-t hover:bg-muted/20 transition-colors"
                  >
                    {/* Row number */}
                    <td className="px-3 py-1.5 text-muted-foreground text-xs">
                      {index + 1}
                    </td>

                    {/* Product dropdown */}
                    <td className="px-2 py-1.5 min-w-[180px]">
                      <select
                        {...form.register(`items.${index}.productId`, {
                          valueAsNumber: true,
                        })}
                        className={cellInput}
                        data-testid={`select-item-product-${index}`}
                      >
                        <option value={0}>— Select product —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.itemCode} – {p.productName}
                          </option>
                        ))}
                      </select>
                      {form.formState.errors.items?.[index]?.productId && (
                        <p className="text-xs text-destructive mt-0.5">
                          {
                            form.formState.errors.items[index].productId
                              ?.message
                          }
                        </p>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        {...form.register(`items.${index}.qty`)}
                        className={cellInput}
                        data-testid={`input-item-qty-${index}`}
                      />
                    </td>

                    {/* Gazana */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        {...form.register(`items.${index}.gazana`)}
                        className={cellInput}
                        data-testid={`input-item-gazana-${index}`}
                      />
                    </td>

                    {/* Rate */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...form.register(`items.${index}.rate`)}
                        className={cellInput}
                        data-testid={`input-item-rate-${index}`}
                      />
                    </td>

                    {/* Received Qty – Tab/Enter on last row adds new row */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        {...form.register(`items.${index}.receivedQty`)}
                        className={cellInput}
                        data-testid={`input-item-receivedqty-${index}`}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            index === fields.length - 1
                          ) {
                            e.preventDefault();
                            addRow();
                          }
                        }}
                      />
                    </td>

                    {/* Delete row */}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => fields.length > 1 && remove(index)}
                        disabled={fields.length <= 1}
                        className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground transition-colors"
                        data-testid={`button-delete-row-${index}`}
                        title="Delete row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Enter</kbd> in the last row to add another line.
          </p>
        </div>
      </form>
    </Form>
  );
}
