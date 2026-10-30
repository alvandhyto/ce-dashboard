const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

/** Strict dotted-quad check. Rejects leading zeros ("01.2.3.4") and out-of-range octets. */
export function isValidIPv4(value: string): boolean {
    return IPV4_PATTERN.test(value);
}

/** An IPv4 address together with its prefix length, e.g. 192.168.1.99/24. */
export interface Cidr {
    ip: string;
    prefix: number;
}

/**
 * Everything the configurators need to know about a subnet, so no other code does address
 * arithmetic. Addresses are counted from the network address: index 0 is the network,
 * index size - 1 the broadcast.
 */
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
    /** Addresses in the block, network and broadcast included: 4 for a /30. */
    size: number;
    /** Where `ip` sits in the block: 0 for the network address, 2 for 10.0.0.2/24. */
    index: number;
    /** The address `index` places after the network address, or null outside the block: at(20) of 192.168.88.0/24 is 192.168.88.20. */
    at(index: number): string | null;
}

/** Dotted quad to unsigned 32-bit integer. Expects a valid IPv4 address. */
function ipToInt(ip: string): number {
    const [a, b, c, d] = ip.split(".").map(Number);
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function intToIp(value: number): string {
    return [
        value >>> 24,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
    ].join(".");
}

/** No leading zeros, so "/030" and "/08" are rejected instead of guessed at. */
const PREFIX_PATTERN = /^(0|[1-9]\d?)$/;

/** /24 becomes 0xFFFFFF00. The /0 case is special because JS shifts wrap around at 32. */
function prefixToMask(prefix: number): number {
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

    const pointToPoint = cidr.prefix >= 31;
    const size = broadcast - network + 1;

    return {
        ip: cidr.ip,
        prefix: cidr.prefix,
        netmask: intToIp(mask),
        network: intToIp(network),
        broadcast: intToIp(broadcast),
        firstUsable: intToIp(pointToPoint ? network : network + 1),
        lastUsable: intToIp(pointToPoint ? broadcast : broadcast - 1),
        size,
        index: ipToInt(cidr.ip) - network,
        at: (index) => (Number.isInteger(index) && index >= 0 && index < size ? intToIp(network + index) : null),
    };
}

/** True when the entered address can be assigned to an interface (not the network or broadcast address). */
export function isUsableHost(subnet: Subnet): boolean {
    const ip = ipToInt(subnet.ip);
    return (
        ip >= ipToInt(subnet.firstUsable) && ip <= ipToInt(subnet.lastUsable)
    );
}
