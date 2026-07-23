import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShikanjaInput } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(1, "Required").max(255),
});

interface ShikanjaFormProps {
  initialData?: Partial<ShikanjaInput>;
  onSubmit: (data: ShikanjaInput) => void;
}

export function ShikanjaForm({ initialData, onSubmit }: ShikanjaFormProps) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
    }
  });

  useEffect(() => {
    if (initialData) {
      form.reset({ name: initialData.name || "" });
    } else {
      form.reset({ name: "" });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form id="entity-form" onSubmit={form.handleSubmit(onSubmit as any)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name (شکنجہ نام)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-shikanja-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}