/**
 * Everything specific to the KFC project lives here: models, template files,
 * form fields, validation and how the form maps to template placeholders.
 * The UI and hooks know nothing about KFC.
 *
 * Unlike the FortiGate generator, this one is plain placeholder replacement:
 * the interfaces are the same on every site, only addresses change.
 */
import { getSubnet, isUsableHost } from "../../lib/cidr";
import type { Replacements } from "../../lib/placeholders";
import { rules, type FieldDef, type Rule } from "../../lib/validation";

/* ------------------------------------------------------------------ */
/* Models and templates                                                 */
/* ------------------------------------------------------------------ */

export type Series = "40F" | "30G" | "30G w/ Switch";

export const SERIES_OPTIONS: ReadonlyArray<{ value: Series; label: string }> = [
    { value: "40F", label: "40F" },
    { value: "30G", label: "30G" },
    { value: "30G w/ Switch", label: "30G w/ Switch" },
];

export const DEFAULT_SERIES: Series = "40F";

/** Served from /public. Spaces in the file names are percent-encoded. */
const TEMPLATE_DIR = "/templates/kfc/";

/** The device config, and for the model with a switch, the switch config too. */
interface TemplateFiles {
    device: string;
    switch?: string;
}

const TEMPLATES: Record<Series, TemplateFiles> = {
    "40F": { device: "Template Branch 40F 7.2.12.conf" },
    "30G": { device: "Template Branch 30G 7.2.11.conf" },
    "30G w/ Switch": {
        device: "Template Branch 30G AP 7.2.11.conf",
        switch: "Template Branch 50E Switch 6.2.15.conf",
    },
};

/** Model with a separate switch config, and so a second hostname. */
export const hasSwitch = (series: Series) => series === "30G w/ Switch";

/** The 30G template has no broadband link. */
export const hasBroadband = (series: Series) => series !== "30G";

/** Template file names for a model, device config first. */
export function templateFileNames(series: Series): string[] {
    const files = TEMPLATES[series];
    return files.switch ? [files.device, files.switch] : [files.device];
}

export const templateUrls = (series: Series) =>
    templateFileNames(series).map((name) => encodeURI(TEMPLATE_DIR + name));

export const outputFileName = (hostname: string, fallback: string) =>
    `${hostname || fallback}.conf`;

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export type KfcFieldKey =
    | "hostname"
    | "hostname_switch"
    | "sid_internet"
    | "ip_internet"
    | "ip_broadband"
    | "ip_lan"
    | "loopback0"
    | "loopback205";

export type KfcValues = Record<KfcFieldKey, string>;

/** Choices that change which fields exist. */
export interface KfcOptions {
    series: Series;
}

export const INITIAL_VALUES: KfcValues = {
    hostname: "",
    hostname_switch: "",
    sid_internet: "",
    ip_internet: "",
    ip_broadband: "",
    ip_lan: "",
    loopback0: "",
    loopback205: "",
};

// FortiOS: up to 35 characters; letters, digits, hyphen and underscore only.
const hostnameRules = [
    rules.maxLength(35),
    rules.pattern(
        /^[A-Za-z0-9_-]+$/,
        "Use letters, numbers, hyphens and underscores only.",
    ),
];

/** Goes into `set alias "<SID>_DEDICATED"`, so no quotes, and no spaces either. */
const sidRules = [
    rules.pattern(/^[^\s"]+$/, "The SID can't contain spaces or quotes."),
];

/**
 * Prefix lengths the templates are written for: `set ip [IP_INTERNET] 255.255.255.248`,
 * `set ip [IP_BROADBAND] 255.255.255.252`, and a /24 LAN throughout.
 */
const INTERNET_PREFIX = 29;
const BROADBAND_PREFIX = 30;
const LAN_PREFIX = 24;

/**
 * A link address is the FortiGate's own: a usable host of its subnet, and not the first one,
 * which is the provider's gateway.
 */
const linkHost =
    (prefix: number): Rule =>
    (value) => {
        const subnet = getSubnet({ ip: value, prefix });
        if (!subnet) return null; // rules.ipv4 reports it
        if (!isUsableHost(subnet)) {
            return `${value} is the network or broadcast address of its /${prefix}. Use an address from ${subnet.firstUsable} to ${subnet.lastUsable}.`;
        }
        if (value === subnet.firstUsable) {
            return `${value} is the provider's gateway (the first address of its /${prefix}). Enter the FortiGate's address.`;
        }
        return null;
    };

/** Order here is the order on screen within each group. */
export const FIELDS: readonly FieldDef<KfcFieldKey, KfcOptions>[] = [
    {
        key: "hostname",
        group: "device",
        label: ({ series }) =>
            hasSwitch(series) ? "Hostname CPE" : "Hostname",
        placeholder: "e.g. 2026504937_KFC_KGD-BOULEVARD",
        span: "full",
        required: true,
        rules: hostnameRules,
    },
    {
        key: "hostname_switch",
        group: "device",
        label: "Hostname switch",
        placeholder: "e.g. 2026504938_KFC_KGD-BOULEVARD",
        span: "full",
        required: true,
        visible: ({ series }) => hasSwitch(series),
        rules: hostnameRules,
    },
    {
        key: "sid_internet",
        group: "link",
        label: "SID Internet",
        placeholder: "e.g. 2020233809",
        span: "full",
        required: true,
        rules: sidRules,
    },
    {
        key: "ip_internet",
        group: "link",
        label: "Internet IP",
        placeholder: "e.g. 123.231.211.162",
        span: "full",
        required: true,
        rules: [rules.ipv4(), linkHost(INTERNET_PREFIX)],
    },
    {
        key: "ip_broadband",
        group: "link",
        label: "Broadband IP",
        placeholder: "e.g. 1.5.12.166",
        span: "full",
        required: true,
        visible: ({ series }) => hasBroadband(series),
        rules: [rules.ipv4(), linkHost(BROADBAND_PREFIX)],
    },
    {
        key: "ip_lan",
        group: "network",
        label: "LAN IP",
        placeholder: "e.g. 192.168.88.1",
        span: "full",
        required: true,
        rules: [rules.ipv4()],
    },
    {
        key: "loopback0",
        group: "network",
        label: "Loopback0 IP",
        placeholder: "e.g. 172.21.0.109",
        span: "full",
        required: true,
        rules: [rules.ipv4()],
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

/* ------------------------------------------------------------------ */
/* Template placeholders                                                */
/* ------------------------------------------------------------------ */

/**
 * Placeholders of the device template. Expects trimmed, validated input.
 *
 * Every derived address comes from getSubnet, with the prefix the templates are written
 * for: a link's gateway is the first usable address of its subnet, and the LAN gives its
 * network, its usable range and the NAT pool address (.20 of the /24).
 */
export function buildDeviceReplacements(
    values: KfcValues,
    series: Series,
): Replacements {
    const internet = getSubnet({
        ip: values.ip_internet,
        prefix: INTERNET_PREFIX,
    });
    const broadband = hasBroadband(series)
        ? getSubnet({ ip: values.ip_broadband, prefix: BROADBAND_PREFIX })
        : null;
    const lan = getSubnet({ ip: values.ip_lan, prefix: LAN_PREFIX });

    return {
        "[HOSTNAME]": values.hostname,
        "[SID_INTERNET]": values.sid_internet,
        "[IP_INTERNET]": values.ip_internet,
        "[IP_GATEWAY_INTERNET]": internet?.firstUsable ?? "",
        "[IP_BROADBAND]": broadband?.ip ?? "",
        "[IP_GATEWAY_BROADBAND]": broadband?.firstUsable ?? "",
        "[NETWORK_LAN]": lan?.network ?? "",
        "[FIRST_USABLE_LAN]": lan?.firstUsable ?? "",
        "[LAST_USABLE_LAN]": lan?.lastUsable ?? "",
        "[IP_NAT_POOL]": lan?.at(20) ?? "",
        "[IP_LOOPBACK0]": values.loopback0,
        "[IP_LOOPBACK205]": values.loopback205,
    };
}

/** The switch template only carries its own hostname. */
export function buildSwitchReplacements(values: KfcValues): Replacements {
    return { "[HOSTNAME]": values.hostname_switch };
}
