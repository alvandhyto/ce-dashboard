/**
 * The site plan: what the form asks for, worked out into the addresses and ports the
 * config needs. All the network maths lives here, once, so the code that writes the
 * config (sections/) only copies values and never derives them.
 */
import { getSubnet, type Subnet } from "../../lib/cidr";
import { intToIp, ipToInt } from "../../lib/ip";
import { DEFAULT_LAN_CIDR, type FortigateOptions, type FortigateValues, type UplinkRole } from "./definition";

export type Addressing =
    | { kind: "static"; ip: string; netmask: string; gateway: string }
    | { kind: "dhcp" };

export interface UplinkPlan {
    role: UplinkRole;
    /** Physical port, e.g. "wan" or "lan1". */
    port: string;
    /** Circuit ID; becomes the port's alias. */
    sid: string;
    addressing: Addressing;
}

export interface LanPlan {
    ip: string;
    netmask: string;
    network: string;
    dhcpStart: string;
    dhcpEnd: string;
}

export interface SitePlan {
    hostname: string;
    /** Primary first. One entry on a single-link site, two on dual link. */
    uplinks: UplinkPlan[];
    lan: LanPlan;
    loopback: string;
}

/**
 * A provider link, from any address of its subnet: the provider's router takes the first
 * usable address and the CPE the next one (36.37.73.96/30 gives .97 and .98, as in every
 * sample config). A /31 has just the two: the first is the provider's, the second ours.
 */
export function linkAddressing(cidr: string): Addressing & { kind: "static" } {
    const subnet = requireSubnet(cidr, "link");
    if (subnet.prefix > 31) throw new Error(`${cidr} is a single address; a link needs a /31 or larger subnet.`);
    const network = ipToInt(subnet.network);
    return {
        kind: "static",
        ip: intToIp(network + (subnet.prefix === 31 ? 1 : 2)),
        netmask: subnet.netmask,
        gateway: intToIp(network + (subnet.prefix === 31 ? 0 : 1)),
    };
}

/** Where the DHCP range sits in a /24 or larger LAN, counted from the network address (the samples hand out .110 to .210). */
const DHCP_RANGE = { first: 110, last: 210 };

/**
 * The LAN: the address as typed is the FortiGate's own (a network address typed instead
 * becomes the first usable one). DHCP hands out .110 to .210 when that fits and leaves the
 * FortiGate's address out; a smaller LAN gets every usable address on the larger side of it.
 */
export function lanPlan(cidr: string): LanPlan {
    const subnet = requireSubnet(cidr, "LAN");
    if (subnet.prefix > 30) throw new Error(`${cidr} leaves no room for DHCP clients; the LAN needs a /30 or larger subnet.`);

    const network = ipToInt(subnet.network);
    const first = ipToInt(subnet.firstUsable);
    const last = ipToInt(subnet.lastUsable);
    const typed = ipToInt(subnet.ip);
    const ip = typed >= first && typed <= last ? typed : first;

    let start: number;
    let end: number;
    const conventional = { start: network + DHCP_RANGE.first, end: network + DHCP_RANGE.last };
    if (conventional.end <= last && (ip < conventional.start || ip > conventional.end)) {
        ({ start, end } = conventional);
    } else if (last - ip >= ip - first) {
        [start, end] = [ip + 1, last];
    } else {
        [start, end] = [first, ip - 1];
    }

    return {
        ip: intToIp(ip),
        netmask: subnet.netmask,
        network: subnet.network,
        dhcpStart: intToIp(start),
        dhcpEnd: intToIp(end),
    };
}

/** Turns validated form input into the plan. Throws on input the form should have refused. */
export function buildPlan(values: FortigateValues, { dualLink, uplinks }: FortigateOptions): SitePlan {
    const uplink = (role: UplinkRole, sid: string, cidr: string): UplinkPlan => ({
        role,
        port: uplinks[role].interface,
        sid,
        addressing: uplinks[role].dhcp ? { kind: "dhcp" } : linkAddressing(cidr),
    });

    return {
        hostname: values.hostname,
        uplinks: [
            uplink("primary", values.sid_primary, values.ip_primary),
            ...(dualLink ? [uplink("secondary", values.sid_secondary, values.ip_secondary)] : []),
        ],
        lan: lanPlan(values.ip_lan || DEFAULT_LAN_CIDR),
        loopback: values.loopback205,
    };
}

function requireSubnet(cidr: string, what: string): Subnet {
    const subnet = getSubnet(cidr);
    if (!subnet) throw new Error(`"${cidr}" isn't a valid ${what} address with prefix length.`);
    return subnet;
}
