/**
 * Template in, config out.
 *
 * The template is the fixed part of every site. The generator only adds to it:
 *
 * - Placeholders take values that appear as-is in many places: [HOSTNAME] and
 *   [IP_LOOPBACK205].
 * - Code adds what depends on the form (sections/): the uplinks on their ports, an SD-WAN
 *   member per uplink, and the management tunnels with their BGP neighbors, each into a list
 *   the template leaves empty. The LAN's values are written into the places that name its
 *   subnet. A port taken out of the LAN switch for an uplink is the one thing removed.
 */
import { buildPlan } from "./plan";
import { DEFAULT_UPLINKS, PORT_NAME_PATTERN, type FortigateOptions, type FortigateValues } from "./definition";
import { parseFortiOS, serializeFortiOS, type Document } from "./fortios";
import { findUnresolvedPlaceholders, renderTemplate } from "../../lib/placeholders";
import { applyLan } from "./sections/lan";
import { applyOverlay } from "./sections/overlay";
import { applySdwan } from "./sections/sdwan";
import { applyUplinks, listPorts } from "./sections/uplinks";

export interface GenerateResult {
    content: string;
    /** Things worth a second look. The config is still produced. */
    warnings: string[];
}

export interface TemplateLayout {
    /** Ports an uplink can use, in template order. Empty when none could be read. */
    ports: string[];
    /** Where each uplink goes unless the user picks a port. */
    defaults: { primary?: string; secondary?: string };
}

function readTemplate(template: string): Document {
    try {
        return parseFortiOS(template);
    } catch (error) {
        throw new Error(`The template can't be read as a FortiOS config: ${error instanceof Error ? error.message : error}`);
    }
}

/** The ports a template offers an uplink, and the usual ones (wan, a) where it has them. Never throws. */
export function inspectTemplate(template: string): TemplateLayout {
    try {
        const ports = listPorts(parseFortiOS(template), PORT_NAME_PATTERN);
        const has = (port: string) => (ports.includes(port) ? port : undefined);
        return {
            ports,
            defaults: {
                primary: has(DEFAULT_UPLINKS.primary.interface),
                secondary: has(DEFAULT_UPLINKS.secondary.interface),
            },
        };
    } catch {
        return { ports: [], defaults: {} };
    }
}

/** Throws with a message for the user when the choices can't be honoured or the template is unusable. */
export function generateConfig(template: string, values: FortigateValues, options: FortigateOptions): GenerateResult {
    const plan = buildPlan(values, options);
    const doc = readTemplate(
        renderTemplate(template, {
            "[HOSTNAME]": plan.hostname,
            "[IP_LOOPBACK205]": plan.loopback,
        }),
    );

    applyUplinks(doc, plan);
    applyLan(doc, plan);
    applySdwan(doc, plan);
    const warnings = applyOverlay(doc, plan);

    const content = serializeFortiOS(doc);
    const unresolved = findUnresolvedPlaceholders(content);
    if (unresolved.length > 0) {
        throw new Error(`The template has placeholders the generator doesn't fill: ${unresolved.join(", ")}.`);
    }
    return { content, warnings };
}
