import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProductInput, ProductInputType } from "@workspace/api-client-react";
import { useListCategories, useListShikanja } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  itemCode: z.string().min(1, "Required").max(100),
  productName: z.string().min(1, "Required").max(255),
  type: z.enum(['Set', 'Than', 'Suit']),
  subCategoryId: z.number().nullable().optional(),
  shikanjaId: z.number().nullable().optional(),
});

interface ProductFormProps {
  initialData?: Partial<ProductInput>;
  onSubmit: (data: ProductInput) => void;
}

export function ProductForm({ initialData, onSubmit }: ProductFormProps) {
  const { data: categoriesData } = useListCategories({ limit: 1000, offset: 0 });
  const { data: shikanjaData } = useListShikanja({ limit: 1000, offset: 0 });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemCode: initialData?.itemCode || "",
      productName: initialData?.productName || "",
      type: initialData?.type || ProductInputType.Set,
      subCategoryId: initialData?.subCategoryId ?? null,
      shikanjaId: initialData?.shikanjaId ?? null,
    }
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        itemCode: initialData.itemCode || "",
        productName: initialData.productName || "",
        type: initialData.type || ProductInputType.Set,
        subCategoryId: initialData.subCategoryId ?? null,
        shikanjaId: initialData.shikanjaId ?? null,
      });
    } else {
      form.reset({
        itemCode: "", productName: "", type: ProductInputType.Set, subCategoryId: null, shikanjaId: null
      });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form id="entity-form" onSubmit={form.handleSubmit(onSubmit as any)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <FormField
          control={form.control}
          name="itemCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Code (آئٹم کوڈ)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-product-itemcode" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="productName"
          render={({ field }) => (
            <FormItem className="xl:col-span-2">
              <FormLabel>Product Name (پروڈکٹ نام)</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-product-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type (قسم)</FormLabel>
              <FormControl>
                <select 
                  {...field}
                  data-testid="select-product-type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Set">Set</option>
                  <option value="Than">Than</option>
                  <option value="Suit">Suit</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subCategoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub Category</FormLabel>
              <FormControl>
                <select 
                  {...field}
                  value={field.value ?? ""}
                  data-testid="select-product-subcategory"
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None</option>
                  {categoriesData?.rows?.map(c => (
                    <option key={(c as any).id} value={(c as any).id}>{(c as any).id} - {(c as any).name}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="shikanjaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shikanja</FormLabel>
              <FormControl>
                <select 
                  {...field}
                  value={field.value ?? ""}
                  data-testid="select-product-shikanja"
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None</option>
                  {shikanjaData?.rows?.map(s => (
                    <option key={(s as any).id} value={(s as any).id}>{(s as any).id} - {(s as any).name}</option>
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
