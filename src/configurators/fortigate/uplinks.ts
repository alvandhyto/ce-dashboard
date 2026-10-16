/**
 * Rewrites a FortiGate template so its uplinks sit on the interfaces the user
 * picked, with static or DHCP addressing.
 *
 * The template is the single source of truth. It describes each uplink once, on
 * a "prototype" interface that carries the uplink's placeholders (in Base.conf:
 * `wan` holds [IP_PRIMARY_LINK], `a` holds [IP_SECONDARY_LINK]). This module
 * moves those lines to the chosen interface and follows the references:
 *
 *   interface block   static  vdom, ip, alias, allowaccess, type, role, snmp-index
 *                     DHCP    same, with `set mode dhcp` instead of `set ip`
 *                     unused  vdom, type, snmp-index
 *   references        `set interface` / `set device` to the old interface name
 *   gateway           SD-WAN member: line removed on DHCP
 *                     static route:  `set gateway` becomes `set dynamic-gateway enable`
 */
import {
    editName,
    enclosingConfig,
    findConfig,
    findEdit,
    isEdit,
    isSet,
    newSet,
    removeNode,
    setValue,
    takeSet,
    tokens,
    unquote,
    valueOf,
    walk,
    type ConfigNode,
    type Document,
    type EditNode,
    type SetNode,
} from "./fortios";

export interface UplinkPlan {
    /** Interface the uplink should end up on, e.g. "lan1". */
    interface: string;
    dhcp: boolean;
}

/** `secondary` is null for a single-link site. */
export interface UplinkPlans {
    primary: UplinkPlan;
    secondary: UplinkPlan | null;
}

type Role = "primary" | "secondary";

const ROLES: readonly Role[] = ["primary", "secondary"];

const LABEL: Record<Role, string> = {
    primary: "main link",
    secondary: "secondary link",
};

/** Placeholders that mark an uplink inside the template. */
const ANCHOR: Record<Role, { ip: string; gateway: string }> = {
    primary: { ip: "[IP_PRIMARY_LINK]", gateway: "[IP_GATEWAY_PRIMARY_LINK]" },
    secondary: { ip: "[IP_SECONDARY_LINK]", gateway: "[IP_GATEWAY_SECONDARY_LINK]" },
};

/** Lines that travel with an uplink from one interface to another. */
const TRAVELLING_KEYS = ["ip", "alias", "allowaccess", "role"] as const;
type TravellingKey = (typeof TRAVELLING_KEYS)[number];

/** Everything an uplink can leave on an interface, cleared before attaching. */
const UPLINK_KEYS = [...TRAVELLING_KEYS, "mode"];

interface Prototype {
    edit: EditNode;
    /** Interface name used in the template, e.g. "wan". */
    name: string;
    lines: Partial<Record<TravellingKey, SetNode>>;
}

/**
 * Applies the plan to the document in place and returns warnings.
 * Throws when the plan can't be honoured, e.g. an interface the template lacks.
 */
export function applyUplinks(doc: Document, plan: UplinkPlans): string[] {
    const interfaces = findConfig(doc, "system interface");
    if (!interfaces) {
        return ["The template has no `config system interface` section, so the interface and DHCP options were not applied."];
    }

    const warnings: string[] = [];
    const plans: Record<Role, UplinkPlan | null> = {
        primary: plan.primary,
        secondary: plan.secondary,
    };

    // 1. Find the prototype of each uplink and lift its uplink lines out.
    const prototypes: Partial<Record<Role, Prototype>> = {};
    for (const role of ROLES) {
        const prototype = findPrototype(interfaces, role);
        if (prototype) {
            prototypes[role] = prototype;
        } else if (plans[role]) {
            warnings.push(
                `The template has no ${ANCHOR[role].ip}, so the ${LABEL[role]} options were not applied.`,
            );
        }
    }
    for (const prototype of Object.values(prototypes)) detachLines(prototype);

    // 2. Check every target exists before changing anything.
    const targets: Partial<Record<Role, EditNode>> = {};
    for (const role of ROLES) {
        const wanted = plans[role];
        if (!wanted || !prototypes[role]) continue;

        const target = findEdit(interfaces, wanted.interface);
        if (!target) {
            throw new Error(
                `Interface "${wanted.interface}" for the ${LABEL[role]} doesn't exist in this template.`,
            );
        }
        targets[role] = target;
    }

    // 3. Put each uplink's lines on its interface.
    for (const role of ROLES) {
        const wanted = plans[role];
        const prototype = prototypes[role];
        const target = targets[role];
        if (wanted && prototype && target) attachLines(target, prototype.lines, wanted.dhcp);
    }

    // 4. Point references at the new interfaces.
    const renames: Record<string, string> = {};
    for (const role of ROLES) {
        const wanted = plans[role];
        const prototype = prototypes[role];
        if (wanted && prototype) renames[prototype.name] = wanted.interface;
    }
    renameReferences(doc, renames);

    // 5. Gateways follow the addressing mode; an absent secondary link loses its entries.
    for (const role of ROLES) {
        if (prototypes[role]) applyGateways(doc, role, plans[role]);
    }

    return warnings;
}

/* ------------------------------------------------------------------ */

function findPrototype(interfaces: ConfigNode, role: Role): Prototype | null {
    const edit = interfaces.children
        .filter(isEdit)
        .find((candidate) =>
            candidate.children.some(
                (node) => isSet(node, "ip") && valueOf(node).includes(ANCHOR[role].ip),
            ),
        );

    return edit ? { edit, name: editName(edit), lines: {} } : null;
}

function detachLines(prototype: Prototype): void {
    for (const key of TRAVELLING_KEYS) {
        const line = takeSet(prototype.edit, key);
        if (line) prototype.lines[key] = line;
    }
}

/**
 * Inserts the uplink lines the way FortiOS exports them: address, alias and
 * allowaccess before `type`, `role` right after it.
 */
function attachLines(
    target: EditNode,
    lines: Partial<Record<TravellingKey, SetNode>>,
    dhcp: boolean,
): void {
    for (const key of UPLINK_KEYS) takeSet(target, key);

    const address = dhcp ? newSet("mode", "dhcp") : lines.ip;
    const before = [address, lines.alias, lines.allowaccess].filter(
        (line): line is SetNode => line !== undefined,
    );
    const typeIndex = target.children.findIndex((node) => isSet(node, "type"));

    if (typeIndex === -1) {
        target.children.push(...before);
        if (lines.role) target.children.push(lines.role);
        return;
    }

    target.children.splice(typeIndex, 0, ...before);
    if (lines.role) target.children.splice(typeIndex + before.length + 1, 0, lines.role);

    for (const line of [...before, lines.role]) if (line) delete line.raw;
}

/**
 * Rewrites `set interface "x"` and `set device "x"` everywhere. All renames
 * are applied in one pass, so swapping two interfaces works.
 */
function renameReferences(doc: Document, renames: Record<string, string>): void {
    walk(doc, (node) => {
        if (!isSet(node, "interface") && !isSet(node, "device")) return;

        const parts = tokens(valueOf(node));
        if (parts.length !== 1) return;

        const current = unquote(parts[0]);
        const next = renames[current];
        if (next === undefined || next === current) return;

        setValue(node, parts[0].startsWith('"') ? `"${next}"` : next);
    });
}

/**
 * - DHCP: SD-WAN members lose their `set gateway`; static routes get
 *   `set dynamic-gateway enable` in its place.
 * - No such link (single-link site): its SD-WAN member and static route go.
 */
function applyGateways(doc: Document, role: Role, plan: UplinkPlan | null): void {
    const placeholder = ANCHOR[role].gateway;

    walk(doc, (node, path) => {
        if (!isEdit(node)) return;

        const context = enclosingConfig(path);
        if (context !== "members" && context !== "router static") return;

        const gateway = node.children.find(
            (child) => isSet(child, "gateway") && valueOf(child).includes(placeholder),
        );
        if (!gateway) return;

        if (plan === null) {
            removeNode(path[path.length - 1], node);
        } else if (plan.dhcp) {
            if (context === "members") {
                removeNode(node, gateway);
            } else {
                node.children[node.children.indexOf(gateway)] = newSet("dynamic-gateway", "enable");
            }
        }
    });
}

