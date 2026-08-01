import { useEffect, useRef, useState } from "react";
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
  /** The numeric DB id of the currently loaded record (edit mode). */
  currentId?: number;
  /** Next available serial to show when no record is loaded (new mode). */
  nextSerial?: number;
  /** Called when user commits a value in the ID field (Enter or blur). */
  onSerialCommit?: (val: string) => void;
  onSubmit: (data: ShikanjaFormData) => void;
}

export function ShikanjaForm({
  initialData,
  currentId,
  nextSerial,
  onSerialCommit,
  onSubmit,
}: ShikanjaFormProps) {
  const form = useForm<ShikanjaFormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: initialData?.name ?? "" },
  });

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

  useEffect(() => {
    form.reset({ name: initialData?.name ?? "" });
  }, [initialData]);

  function commitSerial() {
    if (serialVal !== prevSerialRef.current) {
      prevSerialRef.current = serialVal;
      onSerialCommit?.(serialVal);
    }
  }

  return (
    <form id="entity-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">

      {/* ID — editable lookup field */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">ID:</label>
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
          className="h-8 w-24 rounded-md border border-input bg-background px-3 text-sm shadow-sm
            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
            [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
