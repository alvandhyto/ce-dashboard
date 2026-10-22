/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function subtractOneFromIP(ip: string): string {
    try {
        const parts = ip.split(".").map(Number);
        if (
            parts.length !== 4 ||
            parts.some((p) => isNaN(p) || p < 0 || p > 255)
        ) {
            return "Invalid IP";
        }

        let numeric =
            (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        numeric >>>= 0; // Convert to unsigned

        if (numeric === 0) return "0.0.0.0";

        numeric -= 1;

        return [
            (numeric >>> 24) & 0xff,
            (numeric >>> 16) & 0xff,
            (numeric >>> 8) & 0xff,
            numeric & 0xff,
        ].join(".");
    } catch (e) {
        return "Invalid IP";
    }
}

export function getFirstThreeOctets(ip: string): string {
    const parts = ip.split(".");
    if (parts.length >= 3) {
        return parts.slice(0, 3).join(".");
    }
    return ip;
}

export function getLanPrefix(ip: string): string {
    return `${getFirstThreeOctets(ip)}.0`;
}
