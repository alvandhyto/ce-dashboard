/**
 * The LAN, in the three places that name its subnet:
 *
 *   config system interface      edit "lan"   its address
 *   config system dhcp server    the server on "lan": gateway, netmask and the range it hands out
 *   config firewall address      the "lan" interface-subnet address that policies use
 *
 * The templates carry 192.168.1.99/24 in the last two, so without this a different LAN would
 * get a DHCP server handing out addresses from the wrong subnet.
 */
import { findConfig, findEdit, findEditBy, newEdit, readSet, upsertSet, type Document } from "../fortios";
import type { SitePlan } from "../plan";

/** The LAN's interface in every template: the hardware switch over the LAN ports. */
const LAN_INTERFACE = "lan";

export function applyLan(doc: Document, { lan }: SitePlan): void {
    const interfaces = findConfig(doc, "system interface");
    const lanInterface = interfaces && findEdit(interfaces, LAN_INTERFACE);
    if (!lanInterface) throw new Error(`The template has no "${LAN_INTERFACE}" interface.`);
    upsertSet(lanInterface, "ip", `${lan.ip} ${lan.netmask}`);

    const dhcpServers = findConfig(doc, "system dhcp server");
    const server = dhcpServers && findEditBy(dhcpServers, "interface", LAN_INTERFACE);
    if (server) {
        upsertSet(server, "default-gateway", lan.ip);
        upsertSet(server, "netmask", lan.netmask);
        const ranges = findConfig(server, "ip-range");
        if (ranges) {
            ranges.children = [
                newEdit("1", [
                    ["start-ip", lan.dhcpStart],
                    ["end-ip", lan.dhcpEnd],
                ]),
            ];
        }
    }

    const addresses = findConfig(doc, "firewall address");
    for (const address of addresses?.children ?? []) {
        if (
            address.kind === "edit" &&
            readSet(address, "type") === "interface-subnet" &&
            readSet(address, "interface") === LAN_INTERFACE
        ) {
            upsertSet(address, "subnet", `${lan.network} ${lan.netmask}`);
        }
    }
}
