import {
    findUnresolvedPlaceholders,
    renderTemplate,
} from "../../lib/placeholders";
import {
    buildReplacements,
    outputFileName,
    type ChatimeValues,
} from "./definition";

export interface GenerateResult {
    content: string;
    filename: string;
    /** Things worth a second look. The config is still produced. */
    warnings: string[];
}

/** Template in, config out. */
export function generateChatimeConfig(
    template: string,
    values: ChatimeValues,
): GenerateResult {
    const content = renderTemplate(template, buildReplacements(values));
    const unresolved = findUnresolvedPlaceholders(content);

    return {
        content,
        filename: outputFileName(values.hostname, "chatime"),
        warnings:
            unresolved.length > 0
                ? [
                      `The template still contains unfilled placeholders: ${unresolved.join(", ")}`,
                  ]
                : [],
    };
}
