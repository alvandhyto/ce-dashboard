/**
 * What the form offers: models, firmware, uplink ports, fields and validation. How the
 * answers become a config is in plan.ts (the numbers) and generate.ts (the writing).
 *
 * To support another vendor, copy this file and change the data, not the components.
 */
import { parseCidr } from "../../lib/cidr";
import { rules, type FieldDef, type Rule } from "../../lib/validation";

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

 * Which interfaces count as ports an uplink can use. The list itself is read
 * from the selected template (see inspectTemplate): `edit` blocks under
 * `config system interface` with `set type physical` whose name matches this.
 * Covers wan, wan1, lan1, port1, x1, a and b. Add keywords here if a model
 * names its ports differently.
 */
export const PORT_NAME_PATTERN = /^(wan|lan|port|x|a|b)\d*$/i;

/** Used only while a template is loading, or when its ports can't be read. */
export const FALLBACK_INTERFACES = [
    "wan",
    "lan1",
    "lan2",
    "lan3",
    "a",
] as const;

export type UplinkRole = "primary" | "secondary";

export interface Uplink {
    interface: string;
    /** true: address comes from DHCP and no IP is typed in. */
    dhcp: boolean;
}

export type Uplinks = Record<UplinkRole, Uplink>;

/** Where the uplinks go unless the user picks other ports: wan and a, as on every site so far. */
export const DEFAULT_UPLINKS: Uplinks = {
    primary: { interface: "wan", dhcp: false },
    secondary: { interface: "a", dhcp: false },
};

/**
 * What the user picked. `interface` stays null until they pick one, which
 * means "wherever the selected template puts this uplink".
 */
export type UplinkChoices = Record<
    UplinkRole,
    { interface: string | null; dhcp: boolean }
>;

export const INITIAL_CHOICES: UplinkChoices = {
    primary: { interface: null, dhcp: false },
    secondary: { interface: null, dhcp: false },
};

/**
 * Turns the user's choices into the ports to use, for the template at hand.
 * A choice that isn't a port of this template (after switching model, say)
 * falls back to the template's own position, then to the first free port, and
 * the two uplinks never share a port. The stored choice is left alone, so
 * switching back restores it.
 */
export function resolveUplinks(
    choices: UplinkChoices,
    ports: readonly string[],
    defaults: Partial<Record<UplinkRole, string>>,
): Uplinks {
    const usable = (name: string | null | undefined): name is string =>
        !!name && (ports.length === 0 || ports.includes(name));

    const pick = (role: UplinkRole, taken?: string): string => {
        const candidates = [
            choices[role].interface,
            defaults[role],
            ...ports,
            DEFAULT_UPLINKS[role].interface,
        ];
        return (
            candidates.find(
                (name): name is string => usable(name) && name !== taken,
            ) ?? DEFAULT_UPLINKS[role].interface
        );
    };

    const primary = pick("primary");
    return {
        primary: { interface: primary, dhcp: choices.primary.dhcp },
        secondary: {
            interface: pick("secondary", primary),
            dhcp: choices.secondary.dhcp,
        },
    };
}

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

export function assignDhcp<T extends { dhcp: boolean }>(
    uplinks: Record<UplinkRole, T>,
    role: UplinkRole,
    dhcp: boolean,
): Record<UplinkRole, T> {
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
    /** Both are always set; the secondary is ignored on a single-link site. */
    uplinks: Uplinks;
}

/** LAN address with prefix length. Used when the LAN field is left empty. */
export const DEFAULT_LAN_CIDR = "192.168.1.99/24";

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
 * Address with prefix length, e.g. 123.231.211.162/30. Any address of the subnet will do,
 * the network address included: plan.ts works out the FortiGate's and the gateway's.
 */
const ipWithPrefix = (example: string) => rules.cidr({ example });

/** Refuses subnets too small for their job. Runs after ipWithPrefix, so the value parses. */
const largestPrefix =
    (max: number, message: string): Rule =>
    (value) =>
        (parseCidr(value)?.prefix ?? 0) > max ? message : null;

const linkRules = (example: string) => [
    ipWithPrefix(example),
    largestPrefix(31, "A link needs a /31 or larger subnet: one address for the provider, one for the FortiGate."),
];

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
            rules: linkRules("123.231.211.162/30"),
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
            rules: linkRules("1.5.12.166/30"),
        },
        {
            key: "ip_lan",
            group: "network",
            label: "LAN IP",
            placeholder: `e.g. ${DEFAULT_LAN_CIDR}`,
            span: "full",
            // Optional: an empty value falls back to DEFAULT_LAN_CIDR.
            rules: [
                ipWithPrefix(DEFAULT_LAN_CIDR),
                largestPrefix(30, "The LAN needs a /30 or larger subnet, so DHCP has addresses to hand out."),
            ],
        },
        {
            key: "loopback205",
            group: "network",
            label: "Loopback205 IP",
            placeholder: "e.g. 100.104.9.71",
            span: "full",
            required: true,
            rules: [rules.ipv4()],
        },
    ];
