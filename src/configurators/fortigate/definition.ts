/**
 * Everything that is specific to FortiGate lives here: models, firmware, form fields,
 * validation and the placeholder mapping. The UI and hooks know nothing about it.
 *
 * To support another vendor, copy this file and change the data, not the components.
 */
import { rules, type FieldDef } from "../../lib/validation";
import type { Replacements } from "../../lib/template";
// Existing helpers from the project. Behaviour is unchanged.
import { subtractOneFromIP, getLanPrefix } from "../../utils";

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

/** Toggles that change which fields exist and how the template is filled. */
export interface FortigateOptions {
    dualLink: boolean;
    /** Forced on when dualLink is on. Not consumed by buildReplacements yet. */
    sdWan: boolean;
}

export const DEFAULT_LAN_IP = "192.168.1.99";
const UNUSED_IP = "0.0.0.0";

export const INITIAL_VALUES: FortigateValues = {
    hostname: "",
    sid_primary: "",
    ip_primary: "",
    sid_secondary: "",
    ip_secondary: "",
    ip_lan: DEFAULT_LAN_IP,
    loopback205: "",
};

const isDualLink = (options: FortigateOptions) => options.dualLink;

/** Order here is the order on screen. */
export const FIELDS: readonly FieldDef<FortigateFieldKey, FortigateOptions>[] =
    [
        {
            key: "hostname",
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
            label: "Primary Link SID",
            placeholder: "e.g. 2020233809",
            required: true,
        },
        {
            key: "ip_primary",
            label: "Primary Link IP",
            placeholder: "e.g. 123.231.211.162",
            required: true,
            rules: [rules.ipv4()],
        },
        {
            key: "sid_secondary",
            label: "Secondary Link SID",
            placeholder: "e.g. 2020233810",
            required: true,
            visible: isDualLink,
        },
        {
            key: "ip_secondary",
            label: "Secondary Link IP",
            placeholder: "e.g. 1.5.12.166",
            required: true,
            visible: isDualLink,
            rules: [rules.ipv4()],
        },
        {
            key: "ip_lan",
            label: "LAN IP",
            placeholder: `e.g. ${DEFAULT_LAN_IP}`,
            span: "full",
            // Optional: an empty value falls back to DEFAULT_LAN_IP.
            rules: [rules.ipv4()],
        },
        {
            key: "loopback205",
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

/** Maps template placeholders to values. Expects already-trimmed and validated input. */
export function buildReplacements(
    values: FortigateValues,
    { dualLink }: FortigateOptions,
): Replacements {
    const hasSecondaryIp = dualLink && values.ip_secondary !== "";
    const lanIp = values.ip_lan || DEFAULT_LAN_IP;

    return {
        "[HOSTNAME]": values.hostname,
        "[sid_primary]": values.sid_primary,
        // Not in the original mapping. Harmless if the template has no such placeholder.
        "[sid_secondary]": dualLink ? values.sid_secondary : "",
        "[ip_primary]": values.ip_primary,
        "[IP_GATEWAY_INTERNET]": values.ip_primary
            ? subtractOneFromIP(values.ip_primary)
            : "",
        "[IP_secondary]": dualLink ? values.ip_secondary : UNUSED_IP,
        "[IP_GATEWAY_secondary]": hasSecondaryIp
            ? subtractOneFromIP(values.ip_secondary)
            : UNUSED_IP,
        "[IP_LAN]": getLanPrefix(lanIp),
        "[IP_LOOPBACK205]": values.loopback205,
    };
}
