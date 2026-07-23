import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CategoryInput } from "@workspace/api-client-react";
import { useListCategories } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(1, "Required").max(255),
  parentId: z.number().nullable().optional(),
});

interface CategoryFormProps {
  initialData?: Partial<CategoryInput>;
  onSubmit: (data: CategoryInput) => void;
}

export function CategoryForm({ initialData, onSubmit }: CategoryFormProps) {
  const { data: mainCategories } = useListCategories({ limit: 1000, offset: 0, topLevelOnly: true });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
      parentId: initialData?.parentId ?? null,
    }
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || "",
        parentId: initialData.parentId ?? null,
      });
    } else {
      form.reset({ name: "", parentId: null });
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
              <FormLabel>Name (نام)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-category-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parent Category</FormLabel>
              <FormControl>
                <select 
                  {...field}
                  value={field.value ?? ""}
                  data-testid="select-category-parent"
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Main Category</option>
                  {mainCategories?.rows?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}