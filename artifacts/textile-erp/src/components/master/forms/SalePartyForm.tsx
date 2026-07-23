import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SalePartyInput } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(1, "Required").max(255),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.string().optional(),
  openingBalance: z.string().optional(),
});

interface SalePartyFormProps {
  initialData?: Partial<SalePartyInput>;
  onSubmit: (data: SalePartyInput) => void;
}

export function SalePartyForm({ initialData, onSubmit }: SalePartyFormProps) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
      phone: initialData?.phone || "",
      city: initialData?.city || "",
      address: initialData?.address || "",
      creditLimit: initialData?.creditLimit || "",
      openingBalance: initialData?.openingBalance || "",
    }
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || "",
        phone: initialData.phone || "",
        city: initialData.city || "",
        address: initialData.address || "",
        creditLimit: initialData.creditLimit || "",
        openingBalance: initialData.openingBalance || "",
      });
    } else {
      form.reset({ name: "", phone: "", city: "", address: "", creditLimit: "", openingBalance: "" });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form id="entity-form" onSubmit={form.handleSubmit(onSubmit as any)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name / بنام</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone / فون</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-phone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City / شہر</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-saleparty-city" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="creditLimit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credit Limit / کریڈٹ حد</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} data-testid="input-saleparty-creditlimit" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="openingBalance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opening Balance / ابتدائی بیلنس</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} data-testid="input-saleparty-openingbalance" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="md:col-span-2 lg:col-span-3">
              <FormLabel>Address / پتہ</FormLabel>
              <FormControl>
                <textarea 
                  {...field}
                  data-testid="input-saleparty-address"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}