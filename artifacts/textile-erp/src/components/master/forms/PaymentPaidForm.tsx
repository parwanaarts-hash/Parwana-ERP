import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PaymentPaidInput,
  PaymentPaid,
  PaymentPaidInputPaymentMode,
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

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  date: z.string().min(1, "Payment date is required"),
  purchasePartyId: z.coerce.number().min(1, "Select a party"),
  paymentMode: z.enum(["Cash", "Bank"], {
    required_error: "Payment mode is required",
  }),
  amount: z.string().refine(
    (v) => v !== "" && Number(v) > 0,
    { message: "Amount must be greater than 0" }
  ),
  remarks: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

interface PaymentPaidFormProps {
  voucherNo?: string;
  initialData?: PaymentPaid;
  purchaseParties: PurchaseParty[];
  onSubmit: (data: PaymentPaidInput) => void;
}

const today = new Date().toISOString().split("T")[0];

const defaultValues = (d?: PaymentPaid): FormData => ({
  date: d?.date ?? today,
  purchasePartyId: d?.purchasePartyId ?? 0,
  paymentMode: (d?.paymentMode as "Cash" | "Bank") ?? "Cash",
  amount: d?.amount ?? "",
  remarks: d?.remarks ?? "",
});

export function PaymentPaidForm({
  voucherNo,
  initialData,
  purchaseParties,
  onSubmit,
}: PaymentPaidFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(initialData),
  });

  // Reset when switching records
  useEffect(() => {
    form.reset(defaultValues(initialData));
  }, [initialData?.id]);

  const handleSubmit = (data: FormData) => {
    const payload: PaymentPaidInput = {
      date: data.date,
      purchasePartyId: Number(data.purchasePartyId),
      paymentMode: data.paymentMode as PaymentPaidInputPaymentMode,
      amount: data.amount || undefined,
      remarks: data.remarks || undefined,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Voucher No – read-only */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Voucher No</label>
            <Input
              value={voucherNo ?? "Auto"}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              data-testid="input-pp-number"
            />
          </div>

          {/* Payment Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-pp-date" />
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
                    <SelectTrigger data-testid="select-pp-party">
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

          {/* Payment Mode */}
          <FormField
            control={form.control}
            name="paymentMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-pp-mode">
                      <SelectValue placeholder="Select mode..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    {...field}
                    data-testid="input-pp-amount"
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
                    data-testid="input-pp-remarks"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
