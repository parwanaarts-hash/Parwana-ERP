import { useEffect, useRef, useState } from "react";
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
  openingCredit: z.string().optional(),
  openingDebit:  z.string().optional(),
  type:          z.string().optional(),
  shikanjaName:  z.string().optional(),
});

export type PurchasePartyFormData = z.infer<typeof schema>;

interface PurchasePartyFormProps {
  initialData?: Partial<PurchasePartyFormData>;
  /** The numeric DB id of the currently loaded record (edit mode). */
  currentId?: number;
  /** Next available serial to show when no record is loaded (new mode). */
  nextSerial?: number;
  /** Called when user commits a value in the ID field (Enter or blur). */
  onSerialCommit?: (val: string) => void;
  onSubmit: (data: PurchasePartyFormData) => void | Promise<void>;
}

export function PurchasePartyForm({
  initialData,
  currentId,
  nextSerial,
  onSerialCommit,
  onSubmit,
}: PurchasePartyFormProps) {
  const { data: shikanjaData } = useListShikanja({ limit: 500 });

  // Local state for the editable serial/ID input
  const displaySerial = currentId ?? nextSerial;
  const [serialVal, setSerialVal] = useState(displaySerial?.toString() ?? "");
  const prevSerialRef = useRef(serialVal);

  // Sync whenever the parent pushes a new id/serial
  useEffect(() => {
    const next = (currentId ?? nextSerial)?.toString() ?? "";
    setSerialVal(next);
    prevSerialRef.current = next;
  }, [currentId, nextSerial]);

  const form = useForm<PurchasePartyFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:          initialData?.name          ?? "",
      nameUrdu:      initialData?.nameUrdu      ?? "",
      address:       initialData?.address       ?? "",
      city:          initialData?.city          ?? "",
      phone:         initialData?.phone         ?? "",
      mobile:        initialData?.mobile        ?? "",
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
      openingCredit: initialData?.openingCredit ?? "",
      openingDebit:  initialData?.openingDebit  ?? "",
      type:          initialData?.type          ?? "",
      shikanjaName:  initialData?.shikanjaName  ?? "",
    });
  }, [initialData]);

  function commitSerial() {
    if (serialVal !== prevSerialRef.current) {
      prevSerialRef.current = serialVal;
      onSerialCommit?.(serialVal);
    }
  }

  const labelClass = "text-sm font-medium text-muted-foreground w-28 shrink-0";
  const rowClass   = "flex items-center gap-2";

  return (
    <Form {...form}>
      <form id="entity-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">

        {/* Row 1: ID (editable lookup) + Name (English) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {/* ID — editable; Enter triggers lookup */}
          <div className={rowClass}>
            <span className={labelClass}>ID:</span>
            <input
              type="number"
              min="1"
              value={serialVal}
              onChange={(e) => setSerialVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSerial();
                }
              }}
              onBlur={commitSerial}
              placeholder="Auto"
              title="Enter an existing ID and press Enter to load that record"
              className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm shadow-sm
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Name (English) */}
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Name:</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-purchaseparty-name" className="flex-1" autoFocus />
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
                <Input {...field} data-testid="input-purchaseparty-nameurdu" className="flex-1" dir="rtl" />
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
                data-testid="input-purchaseparty-address"
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
                <Input {...field} data-testid="input-purchaseparty-city" className="flex-1" />
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
                    list="shikanja-options"
                    data-testid="input-purchaseparty-shikanja"
                    placeholder="Select or type new..."
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm
                      focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <datalist id="shikanja-options">
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
                <Input {...field} data-testid="input-purchaseparty-phone" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="mobile" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Mobile #:</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-purchaseparty-mobile" className="flex-1" />
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
                <Input type="number" step="0.01" min="0" {...field} data-testid="input-purchaseparty-openingcredit" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="openingDebit" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Opening Debit:</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" {...field} data-testid="input-purchaseparty-openingdebit" className="flex-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 7: Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem className={rowClass}>
              <FormLabel className={labelClass}>Type:</FormLabel>
              <FormControl>
                <select
                  {...field}
                  data-testid="input-purchaseparty-type"
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
        </div>

      </form>
    </Form>
  );
}
