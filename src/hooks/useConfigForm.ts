import { useCallback, useMemo, useState } from "react";
import {
    getVisibleFields,
    validateFields,
    type FieldDef,
    type FieldErrors,
} from "../lib/validation";

/** DOM id for a field's input. Used by the form grid and to focus the first invalid field. */
export const fieldId = (key: string) => `field-${key}`;

interface UseConfigFormOptions<K extends string, C> {
    /** Keep this reference stable (module-level constant) so reset() stays cheap. */
    initialValues: Record<K, string>;
    fields: readonly FieldDef<K, C>[];
    /** Whatever the fields' `visible` callbacks need, e.g. toggle states. */
    context: C;
}

/**
 * Form state for a configurator: values, validation and reset.
 *
 * Errors stay hidden until the first validate() call, then follow the values live,
 * so people aren't scolded for fields they haven't reached yet.
 */
export function useConfigForm<K extends string, C>({
    initialValues,
    fields,
    context,
}: UseConfigFormOptions<K, C>) {
    const [values, setValues] = useState<Record<K, string>>(initialValues);
    const [showErrors, setShowErrors] = useState(false);

    const visibleFields = getVisibleFields(fields, context);
    const errors: FieldErrors<K> = showErrors ? validateFields(fields, values, context) : {};
    const trimmedValues = useMemo(() => trimValues(values), [values]);

    const setValue = useCallback((key: K, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }) as Record<K, string>);
    }, []);

    /** Returns true when the form is valid. On failure, reveals errors and focuses the first bad field. */
    const validate = useCallback((): boolean => {
        const result = validateFields(fields, values, context);
        setShowErrors(true);

        const firstInvalid = getVisibleFields(fields, context).find((field) => result[field.key]);
        if (firstInvalid) {
            requestAnimationFrame(() =>
                document.getElementById(fieldId(firstInvalid.key))?.focus(),
            );
        }
        return !firstInvalid;
    }, [fields, values, context]);

    const reset = useCallback(() => {
        setValues(initialValues);
        setShowErrors(false);
    }, [initialValues]);

    /** The visible fields of one form section, e.g. "primary". */
    const fieldsIn = (group: string) => visibleFields.filter((field) => field.group === group);

    /** What every FieldGrid needs besides its fields. */
    const fieldProps = { values, errors, onChange: setValue };

    return { values, trimmedValues, errors, visibleFields, fieldsIn, fieldProps, setValue, validate, reset };
}

function trimValues<K extends string>(values: Record<K, string>): Record<K, string> {
    const trimmed = {} as Record<K, string>;
    for (const key of Object.keys(values) as K[]) {
        trimmed[key] = values[key].trim();
    }
    return trimmed;
}
