export type Replacements = Record<string, string>;

/** Matches placeholders shaped like [HOSTNAME] or [ip_primary]. */
export const BRACKET_PLACEHOLDER = /\[[A-Za-z][A-Za-z0-9_]*\]/g;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces every placeholder in `template` in a single pass.
 *
 * Single pass (instead of chained replaceAll) means a replacement value can never
 * be re-scanned for placeholders, and special patterns such as "$&" inside a value
 * are inserted literally.
 */
export function renderTemplate(template: string, replacements: Replacements): string {
    const keys = Object.keys(replacements);
    if (keys.length === 0) return template;

    // Longest first, so a placeholder that is a prefix of another can't shadow it.
    const pattern = new RegExp(
        keys
            .sort((a, b) => b.length - a.length)
            .map(escapeRegExp)
            .join("|"),
        "g",
    );

    return template.replace(pattern, (match) => replacements[match] ?? match);
}

/** Lists placeholders still present after rendering, which usually means the template and the mapping have drifted apart. */
export function findUnresolvedPlaceholders(
    rendered: string,
    pattern: RegExp = BRACKET_PLACEHOLDER,
): string[] {
    return [...new Set(rendered.match(pattern) ?? [])];
}
