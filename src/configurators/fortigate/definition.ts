/**
 * Everything that is specific to FortiGate lives here: models, firmware, form fields,
 * validation and the placeholder mapping. The UI and hooks know nothing about it.
 *
 * To support another vendor, copy this file and change the data, not the components.
 */
import {
    getWanHostIp,
    getWanGatewayIp,
    getFirstUsableIp,
    getDhcpStartIp,
    getDhcpEndIp,
    getSubnet,
    parseCidr,
    type Subnet,
} from "../../lib/cidr";
import { rules, type FieldDef } from "../../lib/validation";
import type { Replacements } from "../../lib/template";

/* ------------------------------------------------------------------ */
/* Models and firmware                                                  */
/* ------------------------------------------------------------------ */

export type Series = "30G" | "40F";
export type FirmwareVersion = "7.2" | "7.4";

export const SERIES_OPTIONS: ReadonlyArray<{ value: Series; label: string }> = [
    { value: "30G", label: "FortiGate 30G" },
    { value: "40F", label: "FortiGate 40F" },
];

export const FIRMWARE_OPTIONS: ReadonlyArray<{
    value: FirmwareVersion;
    label: string;
}> = [
    { value: "7.2", label: "FortiOS 7.2" },
    { value: "7.4", label: "FortiOS 7.4" },
];

export const DEFAULT_SERIES: Series = "30G";
export const DEFAULT_FIRMWARE: FirmwareVersion = "7.2";

/* ------------------------------------------------------------------ */
/* Templates                                                            */
/* ------------------------------------------------------------------ */

export const templateFileName = (series: Series, firmware: FirmwareVersion) =>
    `Template ${series} ${firmware}.conf`;

/** Served from /public/fortigate. Spaces in the file name are percent-encoded. */
export const templateUrl = (series: Series, firmware: FirmwareVersion) =>
    encodeURI(`/templates/fortigate/${templateFileName(series, firmware)}`);

export const outputFileName = (hostname: string) =>
    `${hostname || "fortigate"}.conf`;

/* ------------------------------------------------------------------ */
/* Uplinks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Ports an uplink can be plugged into. Make this per model if the ports differ.
 * The names must exist as `edit "<name>"` blocks in the templates.
 */
export const UPLINK_INTERFACES = ["wan", "lan1", "lan2", "lan3", "a"] as const;

export type UplinkRole = "primary" | "secondary";

export interface Uplink {
    interface: string;
    /** true: address comes from DHCP and no IP is typed in. */
    dhcp: boolean;
}

export type Uplinks = Record<UplinkRole, Uplink>;

/** Where Base.conf puts them. */
export const DEFAULT_UPLINKS: Uplinks = {
    primary: { interface: "wan", dhcp: false },
    secondary: { interface: "a", dhcp: false },
};

/**
 * Moves an uplink to another port. When the port is taken by the other
 * uplink the two swap, so the same port can never be used twice.
 */
export function assignInterface(
    uplinks: Uplinks,
    role: UplinkRole,
    next: string,
): Uplinks {
    const other: UplinkRole = role === "primary" ? "secondary" : "primary";
    if (uplinks[role].interface === next) return uplinks;

    return {
        ...uplinks,
        [role]: { ...uplinks[role], interface: next },
        [other]:
            uplinks[other].interface === next
                ? { ...uplinks[other], interface: uplinks[role].interface }
                : uplinks[other],
    };
}

export function assignDhcp(
    uplinks: Uplinks,
    role: UplinkRole,
    dhcp: boolean,
): Uplinks {
    return { ...uplinks, [role]: { ...uplinks[role], dhcp } };
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export type FortigateFieldKey =
    | "hostname"
    | "sid_primary"
    | "ip_primary"
    | "sid_secondary"
    | "ip_secondary"
    | "ip_lan"
    | "loopback205";

export type FortigateValues = Record<FortigateFieldKey, string>;

/** Choices that change which fields exist and how the template is filled. */
export interface FortigateOptions {
    dualLink: boolean;
    /** Forced on when dualLink is on. Not consumed by buildReplacements yet. */
    sdWan: boolean;
    uplinks: Uplinks;
}

/** LAN address with prefix length. Used when the LAN field is left empty. */
export const DEFAULT_LAN_CIDR = "192.168.1.99/24";
const UNUSED_IP = "0.0.0.0";

export const INITIAL_VALUES: FortigateValues = {
    hostname: "",
    sid_primary: "",
    ip_primary: "",
    sid_secondary: "",
    ip_secondary: "",
    ip_lan: DEFAULT_LAN_CIDR,
    loopback205: "",
};

const isDualLink = (options: FortigateOptions) => options.dualLink;

/** A static uplink needs an IP; a DHCP one gets its address from the provider. */
const primaryLinkIsStatic = (options: FortigateOptions) =>
    !options.uplinks.primary.dhcp;
const secondaryLinkIsStatic = (options: FortigateOptions) =>
    options.dualLink && !options.uplinks.secondary.dhcp;

/**
 * Address with prefix length, e.g. 123.231.211.162/30. Any address inside the
 * subnet is accepted, including its network and broadcast address, because
 * the template decides which one to use. Pass `requireHost: true` to
 * rules.cidr to reject those two again.
 */
const ipWithPrefix = (example: string) => rules.cidr({ example });

/** The SID goes into `set alias` unquoted, so it can't hold spaces or quotes. */
const sidRules = [
    rules.pattern(/^[^\s"]+$/, "The SID can't contain spaces or quotes."),
];

/** Order here is the order on screen within each group. */
export const FIELDS: readonly FieldDef<FortigateFieldKey, FortigateOptions>[] =
    [
        {
            key: "hostname",
            group: "device",
            label: "Hostname",
            placeholder: "e.g. 2026504937_KFC_KGD-BOULEVARD",
            span: "full",
            required: true,
            // FortiOS: up to 35 characters; letters, digits, hyphen and underscore only.
            rules: [
                rules.maxLength(35),
                rules.pattern(
                    /^[A-Za-z0-9_-]+$/,
                    "Use letters, numbers, hyphens and underscores only.",
                ),
            ],
        },
        {
            key: "sid_primary",
            group: "primary",
            label: "Primary Link SID",
            placeholder: "e.g. 2020233809",
            span: "full",
            required: true,
            rules: sidRules,
        },
        {
            key: "ip_primary",
            group: "primary",
            label: "Primary Link IP",
            placeholder: "e.g. 123.231.211.162/30",
            span: "full",
            required: true,
            visible: primaryLinkIsStatic,
            rules: [ipWithPrefix("123.231.211.162/30")],
        },
        {
            key: "sid_secondary",
            group: "secondary",
            label: "Secondary Link SID",
            placeholder: "e.g. 2020233810",
            span: "full",
            required: true,
            visible: isDualLink,
            rules: sidRules,
        },
        {
            key: "ip_secondary",
            group: "secondary",
            label: "Secondary Link IP",
            placeholder: "e.g. 1.5.12.166/30",
            span: "full",
            required: true,
            visible: secondaryLinkIsStatic,
            rules: [ipWithPrefix("1.5.12.166/30")],
        },
        {
            key: "ip_lan",
            group: "network",
            label: "LAN IP",
            placeholder: `e.g. ${DEFAULT_LAN_CIDR}`,
            span: "full",
            // Optional: an empty value falls back to DEFAULT_LAN_CIDR.
            rules: [ipWithPrefix(DEFAULT_LAN_CIDR)],
        },
        {
            key: "loopback205",
            group: "network",
            label: "Loopback 205 IP",
            placeholder: "e.g. 100.104.9.71",
            span: "full",
            required: true,
            rules: [rules.ipv4()],
        },
    ];

/* ------------------------------------------------------------------ */
/* Template placeholders                                                */
/* ------------------------------------------------------------------ */

/** The address part of "a.b.c.d/nn". Falls back to the raw text for unvalidated input. */
const hostOf = (cidr: string) => parseCidr(cidr)?.ip ?? cidr;

/** FortiOS writes an interface address as "<ip> <netmask>". */
const withNetmask = (subnet: Subnet | null) =>
    subnet ? `${subnet.ip} ${subnet.netmask}` : "";

/**
 * The provider's router sits on the first usable address of the link subnet.
 * Both sample configs agree: 103.241.231.2/30 gets .1 and 123.55.15.25/30 gets .25.
 * Change this one function if the rule differs.
 */
export const gatewayOf = (subnet: Subnet | null) => subnet?.firstUsable ?? "";

/**
 * Network details of one subnet as placeholders, e.g. [NETWORK_primary].
 * Pass null for a link that doesn't exist; the addresses then get 0.0.0.0
 * and the prefix gets 0.
 */
function subnetReplacements(name: string, subnet: Subnet | null): Replacements {
    return {
        [`[NETWORK_${name}]`]: subnet?.network ?? UNUSED_IP,
        [`[BROADCAST_${name}]`]: subnet?.broadcast ?? UNUSED_IP,
        [`[NETMASK_${name}]`]: subnet?.netmask ?? UNUSED_IP,
        [`[PREFIX_${name}]`]: subnet ? String(subnet.prefix) : "0",
        [`[FIRST_USABLE_${name}]`]: subnet?.firstUsable ?? UNUSED_IP,
        [`[LAST_USABLE_${name}]`]: subnet?.lastUsable ?? UNUSED_IP,
    };
}

/**
 * Maps template placeholders to values. Expects already-trimmed and validated input.
 *
 * The IP fields carry a prefix length (123.231.211.162/30). A link on DHCP has
 * no IP at all, so everything derived from it is empty. The structural side of
 * DHCP and interface choice (moving lines, gateways) is done by uplinks.ts.
 */
export function buildReplacements(
    values: FortigateValues,
    { dualLink, uplinks }: FortigateOptions,
): Replacements {
    const primaryIsStatic = !uplinks.primary.dhcp;
    const secondaryIsStatic = dualLink && !uplinks.secondary.dhcp;

    const primaryCidr = primaryIsStatic ? values.ip_primary : "";
    const secondaryCidr =
        secondaryIsStatic && values.ip_secondary !== ""
            ? values.ip_secondary
            : "";
    const lanCidr = values.ip_lan || DEFAULT_LAN_CIDR;

    const primary = getSubnet(primaryCidr);
    const secondary = getSubnet(secondaryCidr);
    const lan = getSubnet(lanCidr);

    return {
        // Current placeholders (Base.conf). Addresses come as "<ip> <netmask>".
        "[HOSTNAME]": values.hostname,
        "[SID_PRIMARY_LINK]": values.sid_primary,
        "[IP_PRIMARY_LINK]": getWanHostIp(primaryCidr)
            ? `${getWanHostIp(primaryCidr)} ${primary?.netmask}`
            : "",
        "[IP_GATEWAY_PRIMARY_LINK]": getWanGatewayIp(primaryCidr)
            ? `${getWanGatewayIp(primaryCidr)}`
            : "",
        "[SID_SECONDARY_LINK]": dualLink ? values.sid_secondary : "",
        "[IP_SECONDARY_LINK]": getWanHostIp(secondaryCidr)
            ? `${getWanHostIp(secondaryCidr)} ${secondary?.netmask}`
            : "",
        "[IP_GATEWAY_SECONDARY_LINK]": getWanGatewayIp(secondaryCidr)
            ? `${getWanGatewayIp(secondaryCidr)}`
            : "",
        "[IP_LAN]": getFirstUsableIp(lanCidr)
            ? `${getFirstUsableIp(lanCidr)} ${lan?.netmask}`
            : "",
        "[IP_DHCP_START]": getDhcpStartIp(lanCidr) ?? "",
        "[IP_DHCP_END]": getDhcpEndIp(lanCidr) ?? "",
        "[IP_LOOPBACK205]": values.loopback205,

        // Port each uplink sits on, e.g. wan or lan1. The secondary is empty on single link.
        "[INTERFACE_PRIMARY_LINK]": uplinks.primary.interface,
        "[INTERFACE_SECONDARY_LINK]": dualLink
            ? uplinks.secondary.interface
            : "",

        ...subnetReplacements("primary", primary),
        ...subnetReplacements("secondary", secondary),
        ...subnetReplacements("lan", lan),
    };
}
