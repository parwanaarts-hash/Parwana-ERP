import { useEffect, useState } from "react";
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

const SEL =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm " +
  "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CategoryForm({ initialData, onSubmit }: CategoryFormProps) {
  const { data: mainCategories } = useListCategories({ limit: 500, offset: 0, topLevelOnly: true });

  // Derive category type from parentId
  const [categoryType, setCategoryType] = useState<'main' | 'sub'>(
    initialData?.parentId ? 'sub' : 'main'
  );

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
      setCategoryType(initialData.parentId ? 'sub' : 'main');
    } else {
      form.reset({ name: "", parentId: null });
      setCategoryType('main');
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form
        id="entity-form"
        onSubmit={form.handleSubmit(onSubmit as any)}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
      >
        {/* Category Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-category-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category Type — plain label/select, not a react-hook-form field */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Category Type</label>
          <select
            value={categoryType}
            data-testid="select-category-type"
            onChange={(e) => {
              const t = e.target.value as 'main' | 'sub';
              setCategoryType(t);
              if (t === 'main') {
                form.setValue('parentId', null);
              } else {
                const first = (mainCategories?.rows as any[])?.[0];
                form.setValue('parentId', first ? first.id : null);
              }
            }}
            className={SEL}
          >
            <option value="main">Main Category</option>
            <option value="sub">Sub Category</option>
          </select>
        </div>

        {/* Parent Category — only for sub */}
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
                  disabled={categoryType === 'main'}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  className={`${SEL} disabled:opacity-50`}
                >
                  <option value="">— None —</option>
                  {(mainCategories?.rows as any[])?.map((c: any) => (
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
