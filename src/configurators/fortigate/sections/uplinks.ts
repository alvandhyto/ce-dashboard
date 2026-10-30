/**
 * Uplink ports. Each uplink's port is written the way FortiOS exports one (compare the
 * sample configs):
 *
 *     edit "wan"
 *         set vdom "root"
 *         set ip 36.37.73.98 255.255.255.252     or: set mode dhcp
 *         set allowaccess ping snmp
 *         set type physical
 *         set alias "2026544298-JKTKDNGA01"
 *         set role wan
 *         set snmp-index 1
 *     next
 *
 * The templates leave every port bare, so these lines are added, never swapped for others. A
 * port the template already gave one of them is refused rather than overwritten. A LAN port
 * that becomes an uplink leaves the hardware switch it was in: FortiOS refuses an address on
 * a switch member.
 */
import {
    editName,
    findConfig,
    findEdit,
    isEdit,
    isSet,
    newSet,
    readSet,
    removeNode,
    type Document,
    type EditNode,
} from "../fortios";
import type { SitePlan, UplinkPlan } from "../plan";

/** Management access on an uplink, as in the samples. */
const UPLINK_ALLOWACCESS = "ping snmp";

/** Lines an uplink adds to its port. */
const UPLINK_KEYS = ["ip", "mode", "allowaccess", "alias", "role"];

/**
 * Ports an uplink can use: interfaces with `set type physical` whose name matches `namePattern`
 * (definition.ts PORT_NAME_PATTERN), in template order. Hard-switches, tunnels, loopbacks and
 * aggregates aren't `type physical`, so they never show up.
 */
export function listPorts(doc: Document, namePattern: RegExp): string[] {
    const interfaces = findConfig(doc, "system interface");
    if (!interfaces) return [];
    return interfaces.children
        .filter(isEdit)
        .filter((edit) => namePattern.test(editName(edit)) && readSet(edit, "type") === "physical")
        .map(editName);
}

/** Adds the uplinks to their ports. Throws when a port is missing or taken, or a switch would be left empty. */
export function applyUplinks(doc: Document, plan: SitePlan): void {
    const interfaces = findConfig(doc, "system interface");
    if (!interfaces) throw new Error("The template has no `config system interface` section.");

    for (const uplink of plan.uplinks) {
        const edit = findEdit(interfaces, uplink.port);
        if (!edit) throw new Error(`Port "${uplink.port}" for the ${uplink.role} link doesn't exist in this template.`);
        const taken = UPLINK_KEYS.find((key) => readSet(edit, key) !== undefined);
        if (taken) {
            throw new Error(`The template already sets "${taken}" on ${uplink.port}, so the ${uplink.role} link can't use that port.`);
        }
        writeUplink(edit, uplink);
        leaveSwitches(doc, uplink.port);
    }
}

/** Address and access go before `type`, alias and role after it, as FortiOS orders them. */
function writeUplink(edit: EditNode, uplink: UplinkPlan): void {
    const { addressing } = uplink;
    const before = [
        addressing.kind === "dhcp"
            ? newSet("mode", "dhcp")
            : newSet("ip", `${addressing.ip} ${addressing.netmask}`),
        newSet("allowaccess", UPLINK_ALLOWACCESS),
    ];
    const after = [newSet("alias", `"${uplink.sid}"`), newSet("role", "wan")];

    const type = edit.children.findIndex((node) => isSet(node, "type"));
    if (type === -1) {
        edit.children.push(...before, ...after);
    } else {
        edit.children.splice(type + 1, 0, ...after);
        edit.children.splice(type, 0, ...before);
    }
}

/** Takes the port out of every hardware switch that lists it. */
function leaveSwitches(doc: Document, port: string): void {
    const switches = findConfig(doc, "system virtual-switch");
    for (const hardwareSwitch of switches?.children.filter(isEdit) ?? []) {
        const members = findConfig(hardwareSwitch, "port");
        const member = members && findEdit(members, port);
        if (!members || !member) continue;

        removeNode(members, member);
        if (!members.children.some(isEdit)) {
            throw new Error(
                `Putting an uplink on ${port} would leave the "${editName(hardwareSwitch)}" switch without ports. Keep at least one LAN port free.`,
            );
        }
    }
}
