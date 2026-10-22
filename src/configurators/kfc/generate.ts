import type { GeneratedFile } from "../../components/configurator/MultiConfigPreview";
import {
    findUnresolvedPlaceholders,
    renderTemplate,
} from "../../lib/placeholders";
import {
    buildDeviceReplacements,
    buildSwitchReplacements,
    hasSwitch,
    outputFileName,
    templateFileNames,
    type KfcValues,
    type Series,
} from "./definition";

export interface GenerateResult {
    files: GeneratedFile[];
    /** Things worth a second look. The configs are still produced. */
    warnings: string[];
}

/**
 * Templates in, configs out. `templates` follows templateFileNames(series):
 * the device template, then the switch template for the model that has one.
 */
export function generateKfcConfigs(
    templates: readonly string[],
    values: KfcValues,
    series: Series,
): GenerateResult {
    const expected = templateFileNames(series).length;
    if (templates.length !== expected) {
        throw new Error(
            `${series} needs ${expected} template(s) but got ${templates.length}.`,
        );
    }

    const files: GeneratedFile[] = [
        {
            id: "cpe",
            label: "CPE",
            filename: outputFileName(values.hostname, "kfc"),
            content: renderTemplate(
                templates[0],
                buildDeviceReplacements(values, series),
            ),
        },
    ];

    if (hasSwitch(series)) {
        files.push({
            id: "switch",
            label: "Switch",
            filename: outputFileName(values.hostname_switch, "kfc-switch"),
            content: renderTemplate(
                templates[1],
                buildSwitchReplacements(values),
            ),
        });
    }

    const warnings = files.flatMap((file) => {
        const unresolved = findUnresolvedPlaceholders(file.content);
        return unresolved.length > 0
            ? [`${file.label}: unfilled placeholders ${unresolved.join(", ")}`]
            : [];
    });

    return { files, warnings };
}
