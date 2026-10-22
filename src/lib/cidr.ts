import { isValidIPv4 } from "./ip";

/** An IPv4 address together with its prefix length, e.g. 192.168.1.99/24. */
export interface Cidr {
    ip: string;
    prefix: number;
}

export interface Subnet {
    /** The address as entered (a host inside the subnet, not necessarily the network address). */
    ip: string;
    prefix: number;
    netmask: string;
    /** First address of the block. Identifies the subnet. */
    network: string;
    /** Last address of the block. */
    broadcast: string;
    firstUsable: string;
    lastUsable: string;
    wanHost: string;
    wanGateway: string;
    dhcpStart: string;
    dhcpEnd: string;
    usableHosts: number;
}

/** No leading zeros, so "/030" and "/08" are rejected instead of guessed at. */
const PREFIX_PATTERN = /^(0|[1-9]\d?)$/;

/** Dotted quad to unsigned 32-bit integer. Expects a valid IPv4 address. */
export function ipToInt(ip: string): number {
    const [a, b, c, d] = ip.split(".").map(Number);
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

export function intToIp(value: number): string {
    return [
        value >>> 24,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
    ].join(".");
}

/** /24 becomes 0xFFFFFF00. The /0 case is special because JS shifts wrap around at 32. */
export function prefixToMask(prefix: number): number {
    return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Parses "a.b.c.d/nn". Strict: exactly one slash, a valid IPv4 address, and a
 * prefix of 0 to 32 without leading zeros. Does not trim, so pass trimmed text.
 */
export function parseCidr(value: string): Cidr | null {
    const parts = value.split("/");
    if (parts.length !== 2) return null;

    const [ip, prefixText] = parts;
    if (!isValidIPv4(ip) || !PREFIX_PATTERN.test(prefixText)) return null;

    const prefix = Number(prefixText);
    return prefix <= 32 ? { ip, prefix } : null;
}

/**
 * Everything about the subnet an address belongs to, or null when the input isn't valid CIDR.
 *
 * Usable range follows RFC 3021 for the small cases:
 * - /0 to /30: the network and broadcast addresses are excluded.
 * - /31: point-to-point link, both addresses are hosts.
 * - /32: a single host.
 */
export function getSubnet(input: string | Cidr): Subnet | null {
    const cidr = parseCidr(
        typeof input === "string" ? input : `${input.ip}/${input.prefix}`,
    );
    if (!cidr) return null;

    const mask = prefixToMask(cidr.prefix);
    const network = (ipToInt(cidr.ip) & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;

    const size = 2 ** (32 - cidr.prefix);
    const pointToPoint = cidr.prefix >= 31;

    return {
        ip: cidr.ip,
        prefix: cidr.prefix,
        netmask: intToIp(mask),
        network: intToIp(network),
        broadcast: intToIp(broadcast),
        firstUsable: intToIp(pointToPoint ? network : network + 1),
        lastUsable: intToIp(pointToPoint ? broadcast : broadcast - 1),
        wanHost: intToIp(pointToPoint ? network : network + 2),
        wanGateway: intToIp(pointToPoint ? network : network + 1),
        dhcpStart: intToIp(pointToPoint ? network + 1 : network + 2),
        dhcpEnd: intToIp(pointToPoint ? broadcast - 1 : broadcast - 1),
        usableHosts: pointToPoint ? size : size - 2,
    };
}

/** True when the entered address can be assigned to an interface (not the network or broadcast address). */
export function isUsableHost(subnet: Subnet): boolean {
    const ip = ipToInt(subnet.ip);
    return (
        ip >= ipToInt(subnet.firstUsable) && ip <= ipToInt(subnet.lastUsable)
    );
}

/* Single-value shortcuts. Each returns null when the input isn't valid CIDR. */

export const getNetmask = (cidr: string | Cidr) =>
    getSubnet(cidr)?.netmask ?? null;
export const getNetworkAddress = (cidr: string | Cidr) =>
    getSubnet(cidr)?.network ?? null;
export const getBroadcastAddress = (cidr: string | Cidr) =>
    getSubnet(cidr)?.broadcast ?? null;
export const getFirstUsableIp = (cidr: string | Cidr) =>
    getSubnet(cidr)?.firstUsable ?? null;
export const getLastUsableIp = (cidr: string | Cidr) =>
    getSubnet(cidr)?.lastUsable ?? null;
export const getWanHostIp = (cidr: string | Cidr) =>
    getSubnet(cidr)?.wanHost ?? null;
export const getWanGatewayIp = (cidr: string | Cidr) =>
    getSubnet(cidr)?.wanGateway ?? null;
export const getDhcpStartIp = (cidr: string | Cidr) =>
    getSubnet(cidr)?.dhcpStart ?? null;
export const getDhcpEndIp = (cidr: string | Cidr) =>
    getSubnet(cidr)?.dhcpEnd ?? null;
export const getUsableHostCount = (cidr: string | Cidr) =>
    getSubnet(cidr)?.usableHosts ?? null;
