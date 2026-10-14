import { isValidIPv4 } from "./ip";

/** Returns an error message, or null when the value is acceptable. Never receives an empty value. */
export type Rule = (value: string) => string | null;

/**
 * Declarative description of one text input.
 * `K` is the field key union, `C` is whatever context decides visibility (toggles, model, ...).
 */
export interface FieldDef<K extends string, C = unknown> {
    key: K;
    label: string;
    placeholder?: string;
    /** "full" spans both columns of the form grid. Defaults to "half". */
    span?: "full" | "half";
    required?: boolean;
    /** Hidden fields are neither rendered nor validated. */
    visible?: (context: C) => boolean;
    rules?: Rule[];
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export const rules = {
    ipv4:
        (): Rule =>
        (value) =>
            isValidIPv4(value) ? null : "Enter a valid IPv4 address, for example 10.0.0.1.",

    maxLength:
        (max: number): Rule =>
        (value) =>
            value.length <= max ? null : `Use ${max} characters or fewer.`,

    /** `regex` must not use the g or y flag, or test() becomes stateful. */
    pattern:
        (regex: RegExp, message: string): Rule =>
        (value) =>
            regex.test(value) ? null : message,
};

export function getVisibleFields<K extends string, C>(
    fields: readonly FieldDef<K, C>[],
    context: C,
): FieldDef<K, C>[] {
    return fields.filter((field) => !field.visible || field.visible(context));
}

export function validateFields<K extends string, C>(
    fields: readonly FieldDef<K, C>[],
    values: Record<K, string>,
    context: C,
): FieldErrors<K> {
    const errors: Record<string, string> = {};

    for (const field of getVisibleFields(fields, context)) {
        const value = (values[field.key] ?? "").trim();

        if (value === "") {
            if (field.required) errors[field.key] = `${field.label} is required.`;
            continue;
        }

        for (const rule of field.rules ?? []) {
            const message = rule(value);
            if (message) {
                errors[field.key] = message;
                break;
            }
        }
    }

    return errors as FieldErrors<K>;
}
