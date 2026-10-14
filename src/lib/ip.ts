const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

/** Strict dotted-quad check. Rejects leading zeros ("01.2.3.4") and out-of-range octets. */
export function isValidIPv4(value: string): boolean {
    return IPV4_PATTERN.test(value);
}
