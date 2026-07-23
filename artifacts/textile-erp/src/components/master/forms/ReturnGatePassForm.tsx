import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ReturnGatePassInput,
  ReturnGatePass,
  ReturnGatePassItemInputReturnType,
  Product,
  SaleParty,
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
  returnType: z.enum(["Fresh", "BMall"]).optional(),
  qty: z.string().optional(),
  gazana: z.string().optional(),
  rate: z.string().optional(),
});

const schema = z.object({
  date: z.string().min(1, "Required"),
  salePartyId: z.coerce.number().min(1, "Select a party"),
  remarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type FormData = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

interface ReturnGatePassFormProps {
  gpNumber?: string;
  initialData?: ReturnGatePass;
  products: Product[];
  saleParties: SaleParty[];
  onSubmit: (data: ReturnGatePassInput) => void;
}

const today = new Date().toISOString().split("T")[0];

const emptyItem = (): FormData["items"][0] => ({
  productId: 0,
  returnType: undefined,
  qty: "",
  gazana: "",
  rate: "",
});

const defaultValues = (d?: ReturnGatePass): FormData => ({
  date: d?.date ?? today,
  salePartyId: d?.salePartyId ?? 0,
  remarks: d?.remarks ?? "",
  items:
    d?.items && d.items.length > 0
      ? d.items.map((item) => ({
          productId: item.productId,
          returnType: (item.returnType as "Fresh" | "BMall") ?? undefined,
          qty: item.qty ?? "",
          gazana: item.gazana ?? "",
          rate: item.rate ?? "",
        }))
      : [emptyItem()],
});

export function ReturnGatePassForm({
  gpNumber,
  initialData,
  products,
  saleParties,
  onSubmit,
}: ReturnGatePassFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(initialData),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    form.reset(defaultValues(initialData));
  }, [initialData?.id]);

  const handleSubmit = (data: FormData) => {
    const payload: ReturnGatePassInput = {
      date: data.date,
      salePartyId: Number(data.salePartyId),
      remarks: data.remarks || undefined,
      items: data.items.map((item) => ({
        productId: Number(item.productId),
        returnType: item.returnType as ReturnGatePassItemInputReturnType | undefined,
        qty: item.qty || undefined,
        gazana: item.gazana || undefined,
        rate: item.rate || undefined,
      })),
    };
    onSubmit(payload);
  };

  const addRow = () => append(emptyItem());

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GP Number – read-only */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">GP #</label>
            <Input
              value={gpNumber ?? "Auto"}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              data-testid="input-rgp-number"
            />
          </div>

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-rgp-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sale Party */}
          <FormField
            control={form.control}
            name="salePartyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale Party</FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-rgp-party">
                      <SelectValue placeholder="Select party..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {saleParties.map((p) => (
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

          {/* Remarks */}
          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Optional..."
                    data-testid="input-rgp-remarks"
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
              Items
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
                  <th className="text-left px-3 py-2 font-medium text-xs w-8 text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Product</th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-28 text-muted-foreground">Return Type</th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-24 text-muted-foreground">Qty</th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-24 text-muted-foreground">Gazana</th>
                  <th className="text-left px-3 py-2 font-medium text-xs w-28 text-muted-foreground">Rate</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr
                    key={field.id}
                    className="border-t hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-1.5 text-muted-foreground text-xs">{index + 1}</td>

                    {/* Product */}
                    <td className="px-2 py-1.5 min-w-[180px]">
                      <select
                        {...form.register(`items.${index}.productId`, { valueAsNumber: true })}
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
                          {form.formState.errors.items[index].productId?.message}
                        </p>
                      )}
                    </td>

                    {/* Return Type */}
                    <td className="px-2 py-1.5">
                      <select
                        {...form.register(`items.${index}.returnType`)}
                        className={cellInput}
                        data-testid={`select-item-returntype-${index}`}
                      >
                        <option value="">— Type —</option>
                        <option value="Fresh">Fresh</option>
                        <option value="BMall">B Mall</option>
                      </select>
                    </td>

                    {/* Qty */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number" step="0.01" min="0" placeholder="0"
                        {...form.register(`items.${index}.qty`)}
                        className={cellInput}
                        data-testid={`input-item-qty-${index}`}
                      />
                    </td>

                    {/* Gazana */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number" step="0.01" min="0" placeholder="0"
                        {...form.register(`items.${index}.gazana`)}
                        className={cellInput}
                        data-testid={`input-item-gazana-${index}`}
                      />
                    </td>

                    {/* Rate — Enter on last row appends new row */}
                    <td className="px-2 py-1.5">
                      <input
                        type="number" step="0.01" min="0" placeholder="0.00"
                        {...form.register(`items.${index}.rate`)}
                        className={cellInput}
                        data-testid={`input-item-rate-${index}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && index === fields.length - 1) {
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
