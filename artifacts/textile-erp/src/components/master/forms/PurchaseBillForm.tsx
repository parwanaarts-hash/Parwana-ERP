import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PurchaseBillInput,
  PurchaseBill,
  PurchaseParty,
  PurchaseGatePass,
  Product,
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
import { Search } from "lucide-react";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  billDate: z.string().min(1, "Bill date is required"),
  purchasePartyId: z.coerce.number().min(1, "Select a party"),
  billAmount: z.string().optional(),
  remarks: z.string().optional(),
  gatePassIds: z.array(z.number()).min(1, "Select at least one gate pass"),
});

type FormData = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

interface PurchaseBillFormProps {
  billNumber?: string;
  initialData?: PurchaseBill;
  purchaseParties: PurchaseParty[];
  availableGatePasses: PurchaseGatePass[];
  products: Product[];
  onSubmit: (data: PurchaseBillInput) => void;
}

const today = new Date().toISOString().split("T")[0];

const defaultValues = (d?: PurchaseBill): FormData => ({
  billDate: d?.billDate ?? today,
  purchasePartyId: d?.purchasePartyId ?? 0,
  billAmount: d?.billAmount ?? "",
  remarks: d?.remarks ?? "",
  gatePassIds: d?.gatePassIds ?? [],
});

export function PurchaseBillForm({
  billNumber,
  initialData,
  purchaseParties,
  availableGatePasses,
  products,
  onSubmit,
}: PurchaseBillFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(initialData),
  });

  const [gpSearch, setGpSearch] = useState("");

  // Reset form when switching records
  useEffect(() => {
    form.reset(defaultValues(initialData));
    setGpSearch("");
  }, [initialData?.id]);

  const selectedGpIds: number[] = form.watch("gatePassIds");

  const toggleGatePass = (id: number) => {
    const current = form.getValues("gatePassIds");
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    form.setValue("gatePassIds", next, { shouldValidate: true });
  };

  const filteredGatePasses = availableGatePasses.filter((gp) => {
    if (!gpSearch.trim()) return true;
    const q = gpSearch.toLowerCase();
    return (
      gp.gpNumber?.toLowerCase().includes(q) ||
      gp.lotNumber?.toLowerCase().includes(q) ||
      gp.date?.toLowerCase().includes(q)
    );
  });

  const productMap: Record<number, string> = Object.fromEntries(
    products.map((p) => [p.id, `${p.itemCode} – ${p.productName}`])
  );

  const handleSubmit = (data: FormData) => {
    const payload: PurchaseBillInput = {
      billDate: data.billDate,
      purchasePartyId: Number(data.purchasePartyId),
      billAmount: data.billAmount || undefined,
      remarks: data.remarks || undefined,
      gatePassIds: data.gatePassIds,
    };
    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form
        id="entity-form"
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5"
      >
        {/* ── Header Fields ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Bill Number – read-only */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Bill No</label>
            <Input
              value={billNumber ?? "Auto"}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              data-testid="input-bill-number"
            />
          </div>

          {/* Bill Date */}
          <FormField
            control={form.control}
            name="billDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bill Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-bill-date" />
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
                <FormLabel>Purchase Party</FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-bill-party">
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

          {/* Bill Amount */}
          <FormField
            control={form.control}
            name="billAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bill Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...field}
                    data-testid="input-bill-amount"
                  />
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
                <FormLabel>Remarks</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Optional..."
                    data-testid="input-bill-remarks"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Gate Pass Selection ────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              Gate Pass Selection
              {form.formState.errors.gatePassIds && (
                <span className="ml-2 text-xs font-normal text-destructive">
                  — {form.formState.errors.gatePassIds.message}
                </span>
              )}
            </h4>
            {selectedGpIds.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedGpIds.length} selected
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search gate passes..."
              value={gpSearch}
              onChange={(e) => setGpSearch(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-gp-search"
            />
          </div>

          {/* Checkbox list */}
          <div
            className="border rounded-md overflow-hidden"
            data-testid="container-gp-list"
          >
            <div className="bg-muted/50 border-b px-3 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
              <span className="col-span-1" />
              <span className="col-span-3">GP #</span>
              <span className="col-span-4">Date</span>
              <span className="col-span-4">Lot #</span>
            </div>

            <div className="max-h-48 overflow-y-auto">
              {filteredGatePasses.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {availableGatePasses.length === 0
                    ? "No unlinked gate passes available."
                    : "No gate passes match the search."}
                </p>
              ) : (
                filteredGatePasses.map((gp) => {
                  const checked = selectedGpIds.includes(gp.id);
                  return (
                    <label
                      key={gp.id}
                      className={`grid grid-cols-12 gap-2 items-center px-3 py-2 text-sm cursor-pointer border-t first:border-t-0 transition-colors ${
                        checked
                          ? "bg-blue-50 hover:bg-blue-100"
                          : "hover:bg-muted/30"
                      }`}
                      data-testid={`gp-row-${gp.id}`}
                    >
                      <span className="col-span-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGatePass(gp.id)}
                          className="accent-blue-600"
                          data-testid={`gp-check-${gp.id}`}
                        />
                      </span>
                      <span className="col-span-3 font-medium">
                        {gp.gpNumber ?? `#${gp.id}`}
                      </span>
                      <span className="col-span-4 text-muted-foreground">
                        {gp.date}
                      </span>
                      <span className="col-span-4 text-muted-foreground">
                        {gp.lotNumber ?? "—"}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Bill Items (read-only) ─────────────────────────────────────────── */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Bill Items</h4>

          {initialData?.items && initialData.items.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-xs w-8 text-muted-foreground">#</th>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Product</th>
                    <th className="text-left px-3 py-2 font-medium text-xs w-24 text-muted-foreground">Qty</th>
                    <th className="text-left px-3 py-2 font-medium text-xs w-24 text-muted-foreground">Gazana</th>
                    <th className="text-left px-3 py-2 font-medium text-xs w-28 text-muted-foreground">Rate</th>
                    <th className="text-left px-3 py-2 font-medium text-xs w-28 text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {initialData.items.map((item, i) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-3 py-1.5">{productMap[item.productId] ?? `#${item.productId}`}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{item.qty ?? "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{item.gazana ?? "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{item.rate ?? "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{item.amount ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border rounded-md px-3 py-4 bg-muted/20">
              Items are generated automatically from the selected gate passes when the bill is saved.
            </p>
          )}
        </div>
      </form>
    </Form>
  );
}
