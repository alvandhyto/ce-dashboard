/**
 * SD-WAN members: one per uplink, added to the template's `config members` in its internet
 * zone, with the provider's gateway on a static link and none on DHCP (the lease brings it).
 * The zone, health check, rules and the default route through the zone are the template's.
 * Members the template has of its own stay, and ours are numbered after them.
 */
import { editName, findConfig, isEdit, newEdit, readSet, type ConfigNode, type Document } from "../fortios";
import type { SitePlan } from "../plan";

/** FortiOS's built-in zone, there in every config; never the one the templates route through. */
const BUILT_IN_ZONE = "virtual-wan-link";

export function applySdwan(doc: Document, plan: SitePlan): void {
    const sdwan = findConfig(doc, "system sdwan");
    const members = sdwan && findConfig(sdwan, "members");
    if (!sdwan || !members) throw new Error("The template has no SD-WAN members section (`config system sdwan` > `config members`).");

    const zone = internetZone(sdwan);
    if (!zone) throw new Error("The template's SD-WAN has no zone for the uplinks.");

    const existing = members.children.filter(isEdit);
    for (const uplink of plan.uplinks) {
        if (existing.some((member) => readSet(member, "interface") === uplink.port)) {
            throw new Error(`The template already has an SD-WAN member on ${uplink.port}, the ${uplink.role} link's port.`);
        }
    }

    let id = Math.max(0, ...existing.map((member) => Number(editName(member))).filter(Number.isFinite));
    for (const uplink of plan.uplinks) {
        members.children.push(
            newEdit(String(++id), [
                ["interface", `"${uplink.port}"`],
                ["zone", `"${zone}"`],
                ...(uplink.addressing.kind === "static" ? [["gateway", uplink.addressing.gateway] as const] : []),
            ]),
        );
    }
}

/** The template's first zone that isn't FortiOS's built-in one. */
function internetZone(sdwan: ConfigNode): string | undefined {
    const zones = findConfig(sdwan, "zone");
    return zones?.children.filter(isEdit).map(editName).find((name) => name !== BUILT_IN_ZONE);
}
