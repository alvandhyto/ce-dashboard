/**
 * Everything specific to the KFC project lives here: models, template files,
 * form fields, validation and how the form maps to template placeholders.
 * The UI and hooks know nothing about KFC.
 *
 * Unlike the FortiGate generator, this one is plain placeholder replacement:
 * the interfaces are the same on every site, only addresses change.
 */
import type { Replacements } from "../../lib/placeholders";
import { rules, type FieldDef } from "../../lib/validation";
// Existing helpers from the project.
import { getFirstThreeOctets, subtractOneFromIP } from "../../lib/ip";

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
        rules: [rules.ipv4()],
    },
    {
        key: "ip_broadband",
        group: "link",
        label: "Broadband IP",
        placeholder: "e.g. 1.5.12.166",
        span: "full",
        required: true,
        visible: ({ series }) => hasBroadband(series),
        rules: [rules.ipv4()],
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
 * [IP_LAN] is the first three octets (192.168.88), because the templates
 * write it as "[IP_LAN].0 255.255.255.0" or "[IP_LAN].1-[IP_LAN].254". That
 * makes the LAN a /24, which is what the templates assume everywhere.
 * [IP_GATEWAY_*] is the link address minus one.
 */
export function buildDeviceReplacements(
    values: KfcValues,
    series: Series,
): Replacements {
    const broadband = hasBroadband(series) ? values.ip_broadband : "";

    return {
        "[HOSTNAME]": values.hostname,
        "[SID_INTERNET]": values.sid_internet,
        "[IP_INTERNET]": values.ip_internet,
        "[IP_GATEWAY_INTERNET]": subtractOneFromIP(values.ip_internet),
        "[IP_BROADBAND]": broadband,
        "[IP_GATEWAY_BROADBAND]": broadband ? subtractOneFromIP(broadband) : "",
        "[IP_LAN]": getFirstThreeOctets(values.ip_lan),
        "[IP_LOOPBACK0]": values.loopback0,
        "[IP_LOOPBACK205]": values.loopback205,
    };
}

/** The switch template only carries its own hostname. */
export function buildSwitchReplacements(values: KfcValues): Replacements {
    return { "[HOSTNAME]": values.hostname_switch };
}
