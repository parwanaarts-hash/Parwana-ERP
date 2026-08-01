import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useListShikanja } from "@workspace/api-client-react";

const schema = z.object({
  name:          z.string().min(1, "Required"),
  nameUrdu:      z.string().optional(),
  address:       z.string().optional(),
  city:          z.string().optional(),
  phone:         z.string().optional(),
  mobile:        z.string().optional(),
  creditLimit:   z.string().optional(),
  openingCredit: z.string().optional(),
  openingDebit:  z.string().optional(),
  type:          z.string().optional(),
  shikanjaName:  z.string().optional(),
});

export type SalePartyFormData = z.infer<typeof schema>;

interface SalePartyFormProps {
  initialData?: Partial<SalePartyFormData>;
  currentId?: number;
  onSubmit: (data: SalePartyFormData) => void | Promise<void>;
}

export function SalePartyForm({ initialData, currentId, onSubmit }: SalePartyFormProps) {
  const { data: shikanjaData } = useListShikanja({ limit: 500 });

  const form = useForm<SalePartyFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:          initialData?.name          ?? "",
      nameUrdu:      initialData?.nameUrdu      ?? "",
      address:       initialData?.address       ?? "",
      city:          initialData?.city          ?? "",
      phone:         initialData?.phone         ?? "",
      mobile:        initialData?.mobile        ?? "",
      creditLimit:   initialData?.creditLimit   ?? "",
      openingCredit: initialData?.openingCredit ?? "",
      openingDebit:  initialData?.openingDebit  ?? "",
      type:          initialData?.type          ?? "",
      shikanjaName:  initialData?.shikanjaName  ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name:          initialData?.name          ?? "",
      nameUrdu:      initialData?.nameUrdu      ?? "",
      address:       initialData?.address       ?? "",
      city:          initialData?.city          ?? "",
      phone:         initialData?.phone         ?? "",
      mobile:        initialData?.mobile        ?? "",
      creditLimit:   initialData?.creditLimit   ?? "",
      openingCredit: initialData?.openingCredit ?? "",
      openingDebit:  initialData?.openingDebit  ?? "",
      type:          initialData?.type          ?? "",
      shikanjaName:  initialData?.shikanjaName  ?? "",
    });
  }, [initialData]);

  const labelClass = "text-sm font-medium text-muted-foreground w-28 shrink-0";
  const rowClass   = "flex items-center gap-2";

  return (
    <Form {...form}>
      <form id="entity-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">

        {/* Row 1: ID + Name (English) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <div className={rowClass}>
            <span className={labelClass}>ID:</span>
            <Input
              readOnly
              value={currentId ?? ""}
              className="bg-muted/40 cursor-default text-muted-foreground w-24"
            />
          </div>

          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Name:</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-name" className="flex-1" autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 2: Urdu Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <FormField control={form.control} name="nameUrdu" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Urdu Name:</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-nameurdu" className="flex-1" dir="rtl" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 3: Address */}
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem className={rowClass}>
            <FormLabel className={labelClass}>Address:</FormLabel>
            <FormControl>
              <textarea
                {...field}
                rows={2}
                data-testid="input-saleparty-address"
                className="flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm
                  focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Row 4: City + Shikanja */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>City:</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-city" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="shikanjaName" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Shikanja:</FormLabel>
              <FormControl>
                <div className="flex-1">
                  <input
                    {...field}
                    list="shikanja-options-sale"
                    data-testid="input-saleparty-shikanja"
                    placeholder="Select or type new..."
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm
                      focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <datalist id="shikanja-options-sale">
                    {shikanjaData?.rows?.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 5: Phone + Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Ph #:</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-phone" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="mobile" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Mobile #:</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-mobile" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 6: Opening Credit + Opening Debit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <FormField control={form.control} name="openingCredit" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Opening Credit:</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" {...field} data-testid="input-saleparty-openingcredit" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="openingDebit" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Opening Debit:</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" {...field} data-testid="input-saleparty-openingdebit" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 7: Type + Credit Limit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Type:</FormLabel>
              <FormControl>
                <select
                  {...field}
                  data-testid="input-saleparty-type"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">-- Select --</option>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="creditLimit" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Credit Limit:</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" {...field} data-testid="input-saleparty-creditlimit" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

      </form>
    </Form>
  );
}
