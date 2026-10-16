import { getSubnet } from "../../lib/cidr";
import {
    findUnresolvedPlaceholders,
    renderTemplate,
} from "../../lib/template";
import {
    buildReplacements,
    gatewayOf,
    type FortigateOptions,
    type FortigateValues,
} from "./definition";
import {
    parseFortiOS,
    serializeFortiOS,
    type Document,
} from "./fortios";
import { applyUplinks, type UplinkPlans } from "./uplinks";

export interface GenerateResult {
    content: string;
    /** Things worth a second look. The config is still produced. */
    warnings: string[];
}

function toPlans({ dualLink, uplinks }: FortigateOptions): UplinkPlans {
    return {
        primary: uplinks.primary,
        secondary: dualLink ? uplinks.secondary : null,
    };
}

/** A gateway equal to the interface's own address can't work. */
function gatewayWarnings(
    values: FortigateValues,
    { dualLink, uplinks }: FortigateOptions,
): string[] {
    const links = [
        { label: "Main link", cidr: values.ip_primary, active: !uplinks.primary.dhcp },
        {
            label: "Secondary link",
            cidr: values.ip_secondary,
            active: dualLink && !uplinks.secondary.dhcp,
        },
    ];

    return links.flatMap(({ label, cidr, active }) => {
        const subnet = active ? getSubnet(cidr) : null;
        if (!subnet || subnet.ip !== gatewayOf(subnet)) return [];
        return [
            `${label}: the gateway (${subnet.ip}, the first usable address of ${subnet.network}/${subnet.prefix}) is the same as the interface address. Check the IP.`,
        ];
    });
}

/**
 * Template in, config out: arrange the uplinks (interface, static or DHCP),
 * then fill in the placeholders.
 *
 * Throws when the choices can't be honoured, e.g. an interface the template
 * doesn't have. Templates that can't be parsed fall back to plain placeholder
 * replacement, with a warning.
 */
export function generateConfig(
    template: string,
    values: FortigateValues,
    options: FortigateOptions,
): GenerateResult {
    const warnings: string[] = [];
    let text = template;

    let doc: Document | null = null;
    try {
        doc = parseFortiOS(template);
    } catch {
        warnings.push(
            "The template structure could not be read, so the interface and DHCP options were not applied.",
        );
    }
    if (doc) {
        warnings.push(...applyUplinks(doc, toPlans(options)));
        text = serializeFortiOS(doc);
    }

    const content = renderTemplate(text, buildReplacements(values, options));

    warnings.push(...gatewayWarnings(values, options));

    const unresolved = findUnresolvedPlaceholders(content);
    if (unresolved.length > 0) {
        warnings.push(
            `The template still contains unfilled placeholders: ${unresolved.join(", ")}`,
        );
    }

    return { content, warnings };
}
