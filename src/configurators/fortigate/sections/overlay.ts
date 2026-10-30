/**
 * Management overlay: one IPsec tunnel per uplink (SPOKE-MGMT-OV-1 on the main
 * link, SPOKE-MGMT-OV-2 on the secondary) plus the policy that lets them reach
 * the loopback. The template doesn't carry any of this. It is built here, so the
 * number of tunnels follows the number of uplinks and each one sits on whichever
 * port its uplink was given.
 *
 * Five sections get an entry per tunnel:
 *   config system interface           the tunnel interface
 *   config vpn ipsec phase1-interface the IKE side
 *   config vpn ipsec phase2-interface the IPsec side
 *   config firewall policy            one policy, MGMT-LOOPBACK, listing every tunnel
 *   config router bgp                 a neighbor per tunnel: the hub's end of it
 *
 * Everything except the port is fixed and comes from the sample configs.
 */
import {
    editName,
    findConfig,
    findEdit,
    isConfig,
    isEdit,
    isSet,
    newConfig,
    newEdit,
    removeNode,
    unquote,
    valueOf,
    type ConfigNode,
    type Document,
} from "../fortios";
import type { SitePlan } from "../plan";

/**
 * The hub every site builds its overlay to, and the key it uses.
 *
 * NOTE: this file is part of the JavaScript bundle, so anyone who can open the
 * app can read the key, whatever the access gate says. Treat it like the
 * templates under /public. Move it server-side if that matters.
 */
const HUB = {
    remoteGateway: "202.152.32.206",
    presharedKey: "e8AENJB8p1be8y2ynEg8",
};

/** `hubAddress` is the hub's end of the tunnel, where its BGP session goes. */
const LINKS = {
    primary: { name: "SPOKE-MGMT-OV-1", networkId: 11, hubAddress: "100.108.255.254", description: "MGMT-OV-1-JKTTBSFTGW1" },
    secondary: { name: "SPOKE-MGMT-OV-2", networkId: 22, hubAddress: "100.109.255.254", description: "MGMT-OV-2-JKTTBSFTGW1" },
} as const;

type Link = (typeof LINKS)[keyof typeof LINKS];

/** The BGP session each tunnel carries to the hub, as the templates and samples write it. */
const BGP = {
    remoteAs: "4200000000",
    localAs: "4200000001",
    routeMapIn: "IN-FROM-JKTTBSFTGW1",
    routeMapOut: "OUT-TO-JKTTBSFTGW1",
};

const POLICY = {
    id: "100",
    name: "MGMT-LOOPBACK",
    uuid: "e6e1e3fe-6bdc-51f1-874d-d9ce2e8ef65e",
    destination: "Loopback205",
};

const INTERFACES = "system interface";
const PHASE1 = "vpn ipsec phase1-interface";
const PHASE2 = "vpn ipsec phase2-interface";
const POLICIES = "firewall policy";
const BGP_SECTION = "router bgp";

/** The order FortiOS needs them in: tunnels are defined before the policy that uses them. */
const SECTION_ORDER = [INTERFACES, PHASE1, PHASE2, POLICIES];

const quote = (value: string) => `"${value}"`;

/* ------------------------------------------------------------------ */
/* What gets written                                                    */
/* ------------------------------------------------------------------ */

const tunnelInterface = (link: Link, port: string, snmpIndex: number) =>
    newEdit(quote(link.name), [
        ["vdom", quote("root")],
        ["allowaccess", "ping ssh"],
        ["type", "tunnel"],
        ["snmp-index", String(snmpIndex)],
        ["interface", quote(port)],
    ]);

const phase1 = (link: Link, port: string) =>
    newEdit(quote(link.name), [
        ["interface", quote(port)],
        ["ike-version", "2"],
        ["peertype", "any"],
        ["net-device", "enable"],
        ["mode-cfg", "enable"],
        ["proposal", "aes128-sha384"],
        ["add-route", "disable"],
        ["dpd", "on-idle"],
        ["dhgrp", "5"],
        ["idle-timeout", "enable"],
        ["auto-discovery-receiver", "enable"],
        ["auto-discovery-shortcuts", "dependent"],
        ["network-overlay", "enable"],
        ["network-id", String(link.networkId)],
        ["remote-gw", HUB.remoteGateway],
        ["psksecret", HUB.presharedKey],
        ["dpd-retryinterval", "21"],
    ]);

const phase2 = (link: Link) =>
    newEdit(quote(link.name), [
        ["phase1name", quote(link.name)],
        ["proposal", "aes192-sha256"],
        ["dhgrp", "5"],
        ["keepalive", "enable"],
    ]);

const policy = (tunnels: readonly string[]) =>
    newEdit(POLICY.id, [
        ["name", quote(POLICY.name)],
        ["uuid", POLICY.uuid],
        ["srcintf", tunnels.map(quote).join(" ")],
        ["dstintf", quote(POLICY.destination)],
        ["action", "accept"],
        ["srcaddr", quote("all")],
        ["dstaddr", quote("all")],
        ["schedule", quote("always")],
        ["service", quote("ALL")],
        ["logtraffic", "all"],
    ]);

const bgpNeighbor = (link: Link) =>
    newEdit(quote(link.hubAddress), [
        ["description", quote(link.description)],
        ["remote-as", BGP.remoteAs],
        ["local-as", BGP.localAs],
        ["route-map-in", quote(BGP.routeMapIn)],
        ["route-map-out", quote(BGP.routeMapOut)],
        ["connect-timer", "1"],
    ]);

/* ------------------------------------------------------------------ */
/* Placing it in the document                                           */
/* ------------------------------------------------------------------ */

/**
 * Adds the overlay for the given uplinks and returns warnings.
 *
 * Whatever the template already has for these tunnels or for the MGMT-LOOPBACK
 * policy is replaced, so the result is the same whether or not the template
 * carries an older copy. Throws when a port doesn't exist in the template or
 * policy 100 is taken by something else.
 */
export function applyOverlay(doc: Document, plan: SitePlan): string[] {
    const tunnels = plan.uplinks.map((uplink) => ({ link: LINKS[uplink.role], port: uplink.port }));

    const removed = removeExisting(doc);

    const interfaces = ensureSection(doc, INTERFACES);
    for (const { port } of tunnels) {
        if (!findEdit(interfaces, port)) {
            throw new Error(`Interface "${port}" for the management overlay doesn't exist in this template.`);
        }
    }

    let snmpIndex = highestSnmpIndex(interfaces);
    for (const { link, port } of tunnels) {
        interfaces.children.push(tunnelInterface(link, port, ++snmpIndex));
    }

    ensureSection(doc, PHASE1).children.push(...tunnels.map(({ link, port }) => phase1(link, port)));
    ensureSection(doc, PHASE2).children.push(...tunnels.map(({ link }) => phase2(link)));

    const policies = ensureSection(doc, POLICIES);
    if (findEdit(policies, POLICY.id)) {
        throw new Error(
            `Firewall policy ${POLICY.id} already exists in this template. The management overlay needs that ID.`,
        );
    }
    policies.children.push(policy(tunnels.map(({ link }) => link.name)));

    addBgpNeighbors(doc, tunnels.map(({ link }) => link));

    return removed > 0
        ? [`The template already had ${removed} management overlay entries (SPOKE-MGMT-OV tunnels, the MGMT-LOOPBACK policy or hub BGP neighbors); they were replaced by the generated ones.`]
        : [];
}

/** Adds a hub neighbor per tunnel to the template's `config neighbor`; the rest of its BGP stays as it is. */
function addBgpNeighbors(doc: Document, links: readonly Link[]): void {
    const bgp = findConfig(doc, BGP_SECTION);
    if (!bgp) throw new Error("The template has no `config router bgp` section for the management overlay.");

    let neighbors = findConfig(bgp, "neighbor");
    if (!neighbors) {
        neighbors = newConfig("neighbor");
        bgp.children.push(neighbors);
    }
    neighbors.children.push(...links.map(bgpNeighbor));
}

/** Removes the tunnels, the policy and the hub neighbors from a previous copy. Returns how many entries went. */
function removeExisting(doc: Document): number {
    const tunnelNames: string[] = Object.values(LINKS).map((link) => link.name);
    let removed = 0;

    for (const sectionName of [INTERFACES, PHASE1, PHASE2]) {
        const section = findConfig(doc, sectionName);
        if (!section) continue;
        for (const edit of section.children.filter(isEdit)) {
            if (tunnelNames.includes(editName(edit))) {
                removeNode(section, edit);
                removed++;
            }
        }
    }

    const policies = findConfig(doc, POLICIES);
    for (const edit of policies?.children.filter(isEdit) ?? []) {
        const name = edit.children.find((node) => isSet(node, "name"));
        if (name && isSet(name) && unquote(valueOf(name)) === POLICY.name) {
            removeNode(policies!, edit);
            removed++;
        }
    }

    const bgp = findConfig(doc, BGP_SECTION);
    const neighbors = bgp && findConfig(bgp, "neighbor");
    const hubAddresses: string[] = Object.values(LINKS).map((link) => link.hubAddress);
    for (const edit of neighbors?.children.filter(isEdit) ?? []) {
        if (hubAddresses.includes(editName(edit))) {
            removeNode(neighbors!, edit);
            removed++;
        }
    }

    return removed;
}

/** The next free snmp-index is the highest one in use plus one. */
function highestSnmpIndex(interfaces: ConfigNode): number {
    const used = interfaces.children
        .filter(isEdit)
        .flatMap((edit) => edit.children.filter((node) => isSet(node, "snmp-index")))
        .map((node) => (isSet(node) ? Number(valueOf(node)) : NaN))
        .filter(Number.isFinite);
    return Math.max(0, ...used);
}

/**
 * Finds a top-level section or creates it where FortiOS wants it: before the
 * first of the later sections that exists, else after the last earlier one,
 * else at the end of the file.
 */
function ensureSection(doc: Document, name: string): ConfigNode {
    const existing = findConfig(doc, name);
    if (existing) return existing;

    const indexOf = (section: string) =>
        doc.children.findIndex((node) => isConfig(node) && node.name === section);
    const present = (sections: string[]) => sections.map(indexOf).filter((index) => index !== -1);

    const position = SECTION_ORDER.indexOf(name);
    const later = present(SECTION_ORDER.slice(position + 1));
    const earlier = present(SECTION_ORDER.slice(0, position));

    let at: number;
    if (later.length > 0) {
        at = Math.min(...later);
    } else if (earlier.length > 0) {
        at = Math.max(...earlier) + 1;
    } else {
        // Keep the file's final newline (an empty last line) at the very end.
        const last = doc.children[doc.children.length - 1];
        at = last?.kind === "raw" && last.raw === "" ? doc.children.length - 1 : doc.children.length;
    }

    const section = newConfig(name);
    doc.children.splice(at, 0, section);
    return section;
}
