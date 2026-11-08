/**
 * Custom BGP: peering with the customer's providers, on top of the management BGP to the hub.
 *
 *   config router prefix-list   PREFIX-LAN, a rule per advertised prefix
 *   config router route-map     OUT-TO-MAIN, and OUT-TO-BACKUP, which prepends the router AS
 *   config router bgp           the router AS and router-id, a neighbor per peer, a network per prefix
 *
 * Only the route-maps some neighbor uses are written. Both advertise PREFIX-LAN and deny the
 * rest, so a peer never learns the loopback or the hub's routes. The hub neighbors keep
 * `local-as 4200000001`, so changing the router AS doesn't touch the management overlay.
 */
import { sameSubnet } from "../../../lib/cidr";
import {
    editName,
    findConfig,
    findEdit,
    hasUnset,
    isEdit,
    newConfig,
    newEdit,
    newUnset,
    quote,
    readSet,
    upsertSet,
    type ConfigNode,
    type Document,
    type EditNode,
} from "../fortios";
import type { CustomBgpPlan, SitePlan } from "../plan";

const PREFIX_LIST = "PREFIX-LAN";
const ROUTE_MAP = { main: "OUT-TO-MAIN", backup: "OUT-TO-BACKUP" } as const;
/** How many times OUT-TO-BACKUP prepends the router AS, as in the sample configs. */
const PREPEND_COUNT = 5;

/** Writes the custom BGP and returns warnings. Throws when the template already has one of its names. */
export function applyCustomBgp(doc: Document, plan: SitePlan): string[] {
    const bgp = plan.customBgp;
    if (!bgp) return [];

    addPrefixList(requireSection(doc, "router prefix-list"), bgp);
    addRouteMaps(requireSection(doc, "router route-map"), bgp);
    configureRouter(requireSection(doc, "router bgp"), bgp);

    return warnings(plan, bgp);
}

function addPrefixList(prefixLists: ConfigNode, bgp: CustomBgpPlan): void {
    refuseExisting(prefixLists, PREFIX_LIST, "prefix list");
    // The templates export `unset ge` / `unset le` on every prefix-list rule; match them.
    const exportUnsets = hasUnset(prefixLists, "ge");

    const rules = newConfig("rule");
    bgp.prefixes.forEach((prefix, index) => {
        const rule = newEdit(String(index + 1), [["prefix", `${prefix.network} ${prefix.netmask}`]]);
        if (exportUnsets) rule.children.push(newUnset("ge"), newUnset("le"));
        rules.children.push(rule);
    });

    const list = newEdit(quote(PREFIX_LIST), []);
    list.children.push(rules);
    prefixLists.children.push(list);
}

function addRouteMaps(routeMaps: ConfigNode, bgp: CustomBgpPlan): void {
    // FortiOS 7.4 exports `unset set-ip-prefsrc` on every route-map rule, 7.2 doesn't; match the template.
    const exportPrefsrc = hasUnset(routeMaps, "set-ip-prefsrc");
    const rule = (id: number, lines: [string, string][]) => {
        const edit = newEdit(String(id), lines);
        if (exportPrefsrc) edit.children.push(newUnset("set-ip-prefsrc"));
        return edit;
    };

    const prepend = quote(Array(PREPEND_COUNT).fill(bgp.as).join(" "));
    const advertise = ["match-ip-address", quote(PREFIX_LIST)] as [string, string];

    for (const role of ["main", "backup"] as const) {
        if (!bgp.neighbors.some((neighbor) => neighbor.role === role)) continue;
        refuseExisting(routeMaps, ROUTE_MAP[role], "route-map");

        const rules = newConfig("rule");
        rules.children.push(
            rule(1, role === "backup" ? [advertise, ["set-aspath", prepend]] : [advertise]),
            rule(2, [["action", "deny"]]),
        );
        const map = newEdit(quote(ROUTE_MAP[role]), []);
        map.children.push(rules);
        routeMaps.children.push(map);
    }
}

function configureRouter(router: ConfigNode, bgp: CustomBgpPlan): void {
    upsertSet(router, "as", bgp.as);
    if (bgp.routerId) upsertSet(router, "router-id", bgp.routerId);

    const neighbors = ensureSubsection(router, "neighbor");
    for (const neighbor of bgp.neighbors) {
        if (findEdit(neighbors, neighbor.ip)) {
            throw new Error(`${neighbor.ip} is already a BGP neighbor in this config (the hub's tunnel addresses are taken).`);
        }
        neighbors.children.push(
            newEdit(quote(neighbor.ip), [
                ["soft-reconfiguration", "enable"],
                ["remote-as", neighbor.remoteAs],
                ["route-map-out", quote(ROUTE_MAP[neighbor.role])],
            ]),
        );
    }

    const networks = ensureSubsection(router, "network");
    const existing = networks.children.filter(isEdit);
    const used = new Set(existing.map((edit) => Number(editName(edit))));
    const advertised = new Set(existing.map((edit) => readSet(edit, "prefix")));
    let id = 0;
    for (const prefix of bgp.prefixes) {
        const value = `${prefix.network} ${prefix.netmask}`;
        if (advertised.has(value)) continue; // e.g. the loopback, already network 100
        do id++;
        while (used.has(id));
        used.add(id);
        insertById(networks, newEdit(String(id), [["prefix", value]]));
    }
}

/** Things FortiOS won't complain about but that stop a prefix being advertised or a session coming up. */
function warnings(plan: SitePlan, bgp: CustomBgpPlan): string[] {
    const result: string[] = [];

    // network-import-check is on by default: a network is only advertised while a route to it exists.
    const notLan = bgp.prefixes.filter(
        (prefix) => prefix.network !== plan.lan.network || prefix.netmask !== plan.lan.netmask,
    );
    if (notLan.length > 0) {
        result.push(
            `${notLan.map((prefix) => prefix.cidr).join(", ")} isn't the LAN subnet. FortiOS only advertises a BGP network while a route to it exists, so put it on an interface or add a static route for it.`,
        );
    }

    // An eBGP peer that isn't on a connected subnet needs ebgp-enforce-multihop. Only checkable when every uplink is static.
    const links = plan.uplinks.map((uplink) => uplink.addressing);
    if (links.every((link) => link.kind === "static")) {
        const remote = bgp.neighbors.filter(
            (neighbor) => !links.some((link) => link.kind === "static" && sameSubnet(neighbor.ip, link.ip, link.netmask)),
        );
        if (remote.length > 0) {
            result.push(
                `${remote.map((neighbor) => neighbor.ip).join(", ")} isn't on an uplink subnet. An eBGP session to a peer that isn't directly connected needs "set ebgp-enforce-multihop enable" on that neighbor.`,
            );
        }
    }
    return result;
}

function requireSection(doc: Document, name: string): ConfigNode {
    const section = findConfig(doc, name);
    if (!section) throw new Error(`The template has no \`config ${name}\` section for the custom BGP.`);
    return section;
}

function ensureSubsection(parent: ConfigNode, name: string): ConfigNode {
    let section = findConfig(parent, name);
    if (!section) {
        section = newConfig(name);
        parent.children.push(section);
    }
    return section;
}

function refuseExisting(section: ConfigNode, name: string, what: string): void {
    if (findEdit(section, name)) {
        throw new Error(`The template already has a ${what} named "${name}". The custom BGP needs that name.`);
    }
}

/** Keeps numbered entries in order, as FortiOS exports them. */
function insertById(section: ConfigNode, edit: EditNode): void {
    const id = Number(editName(edit));
    const at = section.children.findIndex((node) => isEdit(node) && Number(editName(node)) > id);
    if (at === -1) section.children.push(edit);
    else section.children.splice(at, 0, edit);
}
