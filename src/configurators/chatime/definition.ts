/**
 * Everything specific to the Chatime project lives here: models, template
 * files, form fields, validation and how the form maps to template
 * placeholders. The UI and hooks know nothing about Chatime.
 *
 * A plain fill-in generator: the templates are complete and only values change.
 */
import { getSubnet } from "../../lib/cidr";
import type { Replacements } from "../../lib/placeholders";
import { rules, type FieldDef } from "../../lib/validation";

/* ------------------------------------------------------------------ */
/* Models and templates                                                 */
/* ------------------------------------------------------------------ */

export type Series = "40F" | "30G";

export const SERIES_OPTIONS: ReadonlyArray<{ value: Series; label: string }> = [
    { value: "40F", label: "40F" },
    { value: "30G", label: "30G" },
];

export const DEFAULT_SERIES: Series = "40F";

/** Served from /public. Spaces in the file names are percent-encoded. */
const TEMPLATE_DIR = "/templates/chatime/";

const TEMPLATES: Record<Series, string> = {
    "40F": "Template Branch 40F 7.4.12.conf",
    "30G": "Template Branch 30G 7.4.12.conf",
};

export const templateFileName = (series: Series) => TEMPLATES[series];

export const templateUrl = (series: Series) =>
    encodeURI(TEMPLATE_DIR + TEMPLATES[series]);

export const outputFileName = (hostname: string, fallback: string) =>
    `${hostname || fallback}.conf`;

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export type ChatimeFieldKey =
    | "hostname"
    | "sid_airfiber"
    | "ip_tun_airfiber"
    | "sid_m2m"
    | "ip_tun_m2m"
    | "ip_ptp"
    | "ip_lan"
    | "loopback205";

export type ChatimeValues = Record<ChatimeFieldKey, string>;

/** Choices that can change which fields exist. None do yet; both models use every field. */
export interface ChatimeOptions {
    series: Series;
}

export const INITIAL_VALUES: ChatimeValues = {
    hostname: "",
    sid_airfiber: "",
    ip_tun_airfiber: "",
    sid_m2m: "",
    ip_tun_m2m: "",
    ip_ptp: "",
    ip_lan: "",
    loopback205: "",
};

/** SIDs go into the config unquoted, so no spaces or quotes. */
const sidRules = [
    rules.pattern(/^[^\s"]+$/, "The SID can't contain spaces or quotes."),
];

/** Order here is the order on screen within each group. */
export const FIELDS: readonly FieldDef<ChatimeFieldKey, ChatimeOptions>[] = [
    {
        key: "hostname",
        group: "device",
        label: "Hostname",
        placeholder: "e.g. 2023370452-CHATIME-RAMAI",
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
        key: "sid_airfiber",
        group: "airfiber",
        label: "SID AirFiber",
        placeholder: "e.g. 2023370452",
        required: true,
        rules: sidRules,
    },
    {
        key: "ip_tun_airfiber",
        group: "airfiber",
        label: "AirFiber Tunnel IP",
        placeholder: "e.g. 192.168.217.127",
        required: true,
        rules: [rules.ipv4()],
    },
    {
        key: "sid_m2m",
        group: "m2m",
        label: "SID M2M",
        placeholder: "e.g. 2023370453",
        required: true,
        rules: sidRules,
    },
    {
        key: "ip_tun_m2m",
        group: "m2m",
        label: "M2M Tunnel IP",
        placeholder: "e.g. 192.168.218.127",
        required: true,
        rules: [rules.ipv4()],
    },
    {
        key: "ip_ptp",
        group: "network",
        label: "PTP IP",
        placeholder: "e.g. 192.168.205.137/30",
        required: true,
        // The template writes the PTP mask as 255.255.255.252, and the address goes on an interface.
        rules: [rules.cidr({ prefix: 30, requireHost: true, example: "192.168.205.137/30" })],
    },
    {
        key: "ip_lan",
        group: "network",
        label: "LAN IP",
        placeholder: "e.g. 172.19.31.208/28",
        required: true,
        // The template writes the LAN mask as 255.255.255.240.
        rules: [rules.cidr({ prefix: 28, example: "172.19.31.208/28" })],
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
 * Maps template placeholders to values. Expects trimmed, validated input.
 *
 * The PTP and LAN fields carry a prefix length; the template wants the address
 * alone (the masks are written in it). [IP_PTP] is the PTP address as typed,
 * [IP_NETWORK_PTP] its network, and [IP_LAN] the LAN's network, used for the
 * BGP prefixes.
 */
export function buildReplacements(values: ChatimeValues): Replacements {
    const ptp = getSubnet(values.ip_ptp);
    const lan = getSubnet(values.ip_lan);
    return {
        "[HOSTNAME]": values.hostname,
        "[SID_M2M]": values.sid_m2m,
        "[SID_AIRFIBER]": values.sid_airfiber,
        "[IP_TUN_M2M]": values.ip_tun_m2m,
        "[IP_TUN_AIRFIBER]": values.ip_tun_airfiber,
        "[IP_NETWORK_PTP]": ptp?.network ?? "",
        "[IP_PTP]": ptp?.ip ?? "",
        "[IP_LAN]": lan?.network ?? "",
        "[IP_LOOPBACK205]": values.loopback205,
    };
}
