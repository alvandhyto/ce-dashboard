import { fieldId } from "../../hooks/useConfigForm";
import { cn } from "../../lib/cn";
import type { FieldErrors, ResolvedField } from "../../lib/validation";
import { TextField } from "../ui/TextField";

/** The part of a FieldDef the grid needs to render. Lets any FieldDef<K, C> through regardless of C. */
export type FieldDisplay<K extends string> = Pick<
    ResolvedField<K, never>,
    "key" | "label" | "placeholder" | "span"
>;

interface FieldGridProps<K extends string> {
    /** Already filtered to the visible fields (useConfigForm().visibleFields). */
    fields: readonly FieldDisplay<K>[];
    values: Record<K, string>;
    errors: FieldErrors<K>;
    onChange: (key: K, value: string) => void;
}

export function FieldGrid<K extends string>({ fields, values, errors, onChange }: FieldGridProps<K>) {
    return (
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {fields.map((field) => (
                <TextField
                    key={field.key}
                    id={fieldId(field.key)}
                    label={field.label}
                    value={values[field.key]}
                    placeholder={field.placeholder}
                    error={errors[field.key]}
                    onChange={(value) => onChange(field.key, value)}
                    className={cn(field.span === "full" && "sm:col-span-2")}
                />
            ))}
        </div>
    );
}
