const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

/** Strict dotted-quad check. Rejects leading zeros ("01.2.3.4") and out-of-range octets. */
export function isValidIPv4(value: string): boolean {
    return IPV4_PATTERN.test(value);
}

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

/** The address just below, e.g. 10.0.0.2 gives 10.0.0.1. 0.0.0.0 stays as it is; anything that isn't four octets gives "Invalid IP". */
export function subtractOneFromIP(ip: string): string {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
        return "Invalid IP";
    }
    const value = ipToInt(ip);
    return value === 0 ? "0.0.0.0" : intToIp(value - 1);
}

/** "192.168.1.99" gives "192.168.1". Input with fewer than three parts comes back unchanged. */
export function getFirstThreeOctets(ip: string): string {
    const parts = ip.split(".");
    return parts.length >= 3 ? parts.slice(0, 3).join(".") : ip;
}
