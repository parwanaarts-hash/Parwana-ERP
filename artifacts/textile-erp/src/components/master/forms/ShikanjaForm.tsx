import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShikanjaInput } from "@workspace/api-client-react";

const schema = z.object({
  name: z.string().min(1, "Required").max(255),
});

export type ShikanjaFormData = z.infer<typeof schema>;

interface ShikanjaFormProps {
  initialData?: Partial<ShikanjaInput>;
  currentId?: number;
  onSubmit: (data: ShikanjaFormData) => void;
}

export function ShikanjaForm({ initialData, currentId, onSubmit }: ShikanjaFormProps) {
  const form = useForm<ShikanjaFormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: initialData?.name ?? "" },
  });

  useEffect(() => {
    form.reset({ name: initialData?.name ?? "" });
  }, [initialData]);

  return (
    <form id="entity-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">

      {/* ID */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">ID:</label>
        <input
          readOnly
          value={currentId ?? ""}
          placeholder="Auto"
          className="h-8 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground cursor-default"
        />
      </div>

      {/* Shikanja Name */}
      <div className="flex flex-col gap-1 md:col-span-2">
        <label className="text-sm font-medium text-foreground">
          Shikanja Name: <span className="text-destructive">*</span>
        </label>
        <input
          {...form.register("name")}
          data-testid="input-shikanja-name"
          autoFocus
          className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm
            transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

    </form>
  );
}
