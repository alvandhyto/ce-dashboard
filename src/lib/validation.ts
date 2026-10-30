import { getSubnet, isUsableHost, isValidIPv4, parseCidr } from "./cidr";

/** Returns an error message, or null when the value is acceptable. Never receives an empty value. */
export type Rule = (value: string) => string | null;

/**
 * Declarative description of one text input.
 * `K` is the field key union, `C` is whatever context decides visibility (toggles, model, ...).
 */
export interface FieldDef<K extends string, C = unknown> {
    key: K;
    /** A function lets the label follow the form, e.g. "Hostname CPE" once a switch is included. */
    label: string | ((context: C) => string);
    placeholder?: string;
    /** "full" spans both columns of the form grid. Defaults to "half". */
    span?: "full" | "half";
    /** Free-form tag for splitting a form into sections, e.g. "primary". */
    group?: string;
    required?: boolean;
    /** Hidden fields are neither rendered nor validated. */
    visible?: (context: C) => boolean;
    rules?: Rule[];
}

/** A field with its label worked out for the current form state. */
export type ResolvedField<K extends string, C = unknown> = Omit<FieldDef<K, C>, "label"> & {
    label: string;
};

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export const rules = {
    ipv4:
        (): Rule =>
        (value) =>
            isValidIPv4(value) ? null : "Enter a valid IPv4 address, for example 10.0.0.1.",

    /**
     * IPv4 address with a prefix length, e.g. 10.0.0.1/30.
     * - `prefix`: require exactly this prefix length (e.g. 30).
     * - `requireHost`: reject the subnet's network and broadcast addresses.
     * - `example`: shown in the error message, so it can match the field.
     */
    cidr:
        (options: { prefix?: number; requireHost?: boolean; example?: string } = {}): Rule =>
        (value) => {
            const example = options.example ?? "10.0.0.1/30";

            if (!value.includes("/")) {
                return isValidIPv4(value)
                    ? `Add the prefix length after a slash, for example ${example}.`
                    : `Enter a valid IPv4 address and prefix length, for example ${example}.`;
            }

            const cidr = parseCidr(value);
            if (!cidr) {
                return `Enter a valid IPv4 address and prefix length, for example ${example}.`;
            }

            if (options.prefix !== undefined && cidr.prefix !== options.prefix) {
                return `Use a /${options.prefix} prefix.`;
            }

            const subnet = getSubnet(cidr);
            if (options.requireHost && subnet && !isUsableHost(subnet)) {
                return `${cidr.ip} is the network or broadcast address of this /${cidr.prefix} subnet. Use an address from ${subnet.firstUsable} to ${subnet.lastUsable}.`;
            }

            return null;
        },

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
): ResolvedField<K, C>[] {
    return fields
        .filter((field) => !field.visible || field.visible(context))
        .map((field) => ({
            ...field,
            label: typeof field.label === "function" ? field.label(context) : field.label,
        }));
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
