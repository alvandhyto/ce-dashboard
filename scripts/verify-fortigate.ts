/**
 * Checks the FortiGate generator against every template in public/templates/fortigate/: each
 * model and firmware, single and dual link, static and DHCP, uplinks on their usual ports and
 * on LAN ports. Run it after changing the generator or a template:
 *
 *     npx tsx scripts/verify-fortigate.ts
 *
 * Every generated config is read back and checked for what FortiOS needs (an uplink is never a
 * switch member, SD-WAN names exactly the uplinks, DHCP serves the LAN's own subnet...), and
 * everything outside the sections the generator owns must match the template line for line.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { INITIAL_CHOICES, resolveUplinks, validateNeighbors, type FortigateOptions, type FortigateValues } from "../src/configurators/fortigate/definition";
import {
    editName,
    findConfig,
    findEdit,
    isEdit,
    parseFortiOS,
    readSet,
    serializeFortiOS,
    type Document,
} from "../src/configurators/fortigate/fortios";
import { generateConfig, inspectTemplate } from "../src/configurators/fortigate/generate";
import { lanPlan, linkAddressing } from "../src/configurators/fortigate/plan";
import { renderTemplate } from "../src/lib/placeholders";

const DIR = "public/templates/fortigate";
const TEMPLATES = readdirSync(DIR).filter((name) => name.endsWith(".conf"));

let n = 0;
const t = (name: string, fn: () => void) => {
    fn();
    n++;
    console.log("ok -", name);
};

const VALUES: FortigateValues = {
    hostname: "2026504937_KFC_KGD-BOULEVARD",
    sid_primary: "2020233809",
    ip_primary: "123.231.211.162/30",
    sid_secondary: "2020233810",
    ip_secondary: "1.5.12.166/30",
    ip_lan: "192.168.10.1/24",
    loopback205: "100.104.9.71",
    bgp_as: "",
    bgp_router_id: "",
    bgp_prefixes: "",
};

/** Custom BGP off: what every check before the BGP ones generates with. */
const NO_BGP = { customBgp: false, neighbors: [] } as const;

/* ---------- the numbers ---------- */
t("link addresses: provider on the first usable address, FortiGate on the next, whatever address of the subnet is typed", () => {
    for (const typed of ["36.37.73.96/30", "36.37.73.97/30", "36.37.73.98/30", "36.37.73.99/30"]) {
        assert.deepEqual(linkAddressing(typed), { kind: "static", ip: "36.37.73.98", netmask: "255.255.255.252", gateway: "36.37.73.97" });
    }
    assert.deepEqual(linkAddressing("10.0.0.0/31"), { kind: "static", ip: "10.0.0.1", netmask: "255.255.255.254", gateway: "10.0.0.0" });
    assert.deepEqual(linkAddressing("10.0.0.13/29"), { kind: "static", ip: "10.0.0.10", netmask: "255.255.255.248", gateway: "10.0.0.9" });
    assert.throws(() => linkAddressing("10.0.0.1/32"), /31 or larger/);
});
t("LAN: the typed address is the FortiGate's; DHCP uses .110-.210 when it fits and never hands out the FortiGate's address", () => {
    assert.deepEqual(lanPlan("192.168.1.99/24"), { ip: "192.168.1.99", netmask: "255.255.255.0", network: "192.168.1.0", dhcpStart: "192.168.1.110", dhcpEnd: "192.168.1.210" });
    assert.equal(lanPlan("192.168.10.0/24").ip, "192.168.10.1", "a network address becomes the first usable one");
    const inside = lanPlan("192.168.1.150/24");
    assert.deepEqual([inside.dhcpStart, inside.dhcpEnd], ["192.168.1.1", "192.168.1.149"], "the FortiGate inside .110-.210: the larger side of it");
    const small = lanPlan("10.1.1.1/28");
    assert.deepEqual([small.dhcpStart, small.dhcpEnd], ["10.1.1.2", "10.1.1.14"]);
    assert.throws(() => lanPlan("10.1.1.1/31"), /30 or larger/);
});

/* ---------- every template, every combination ---------- */
const sections = (doc: Document) => doc.children.filter((node) => node.kind === "config").map((node) => node.kind === "config" && node.name);
/** The sections the generator writes; everything else must come out exactly as the template has it. */
const OWNED = new Set(["system interface", "system virtual-switch", "system dhcp server", "firewall address", "system sdwan", "vpn ipsec phase1-interface", "vpn ipsec phase2-interface", "firewall policy", "router bgp"]);

interface Case { template: string; dualLink: boolean; primary: string | null; secondary: string | null; dhcp: [boolean, boolean] }

for (const file of TEMPLATES) {
    const template = readFileSync(`${DIR}/${file}`, "utf8");
    const layout = inspectTemplate(template);
    const lanPorts = layout.ports.filter((port) => port.startsWith("lan"));

    t(`${file}: ports read from the template, wan and a by default`, () => {
        assert.ok(layout.ports.includes("wan") && layout.ports.includes("a"), layout.ports.join(","));
        assert.deepEqual(layout.defaults, { primary: "wan", secondary: "a" });
    });

    const cases: Case[] = [];
    for (const dualLink of [false, true])
        for (const [primary, secondary] of [[null, null], [lanPorts[0], null], [null, lanPorts.at(-1)!], ["a", "wan"]] as const)
            for (const dhcp of [[false, false], [true, false], [false, true], [true, true]] as [boolean, boolean][]) {
                if (!dualLink && (dhcp[1] || secondary)) continue;
                cases.push({ template: file, dualLink, primary, secondary, dhcp });
            }

    t(`${file}: ${cases.length} combinations generate a config FortiOS can take`, () => {
        // The template with its two value placeholders filled: what every section the generator doesn't own must equal.
        const reference = parseFortiOS(
            renderTemplate(template, { "[HOSTNAME]": VALUES.hostname, "[IP_LOOPBACK205]": VALUES.loopback205 }),
        );
        for (const c of cases) {
            const name = `${c.dualLink ? "dual" : "single"} P=${c.primary ?? "default"} S=${c.secondary ?? "default"} dhcp=${c.dhcp}`;
            const choices = {
                primary: { interface: c.primary, dhcp: c.dhcp[0] },
                secondary: { interface: c.secondary, dhcp: c.dhcp[1] },
            };
            const uplinks = resolveUplinks(choices, layout.ports, layout.defaults);
            const options: FortigateOptions = { dualLink: c.dualLink, uplinks, ...NO_BGP };
            const { content } = generateConfig(template, VALUES, options);
            const doc = parseFortiOS(content);
            const active = c.dualLink ? [uplinks.primary, uplinks.secondary] : [uplinks.primary];
            const interfaces = findConfig(doc, "system interface")!;

            // Uplink ports carry exactly one uplink's lines, other ports none.
            for (const port of layout.ports) {
                const edit = findEdit(interfaces, port)!;
                const uplink = active.find((u) => u.interface === port);
                if (!uplink) {
                    for (const key of ["ip", "alias", "role"]) assert.equal(readSet(edit, key), undefined, `${name}: ${port} keeps "${key}"`);
                    continue;
                }
                assert.equal(readSet(edit, "role"), "wan", `${name}: ${port} role`);
                assert.equal(readSet(edit, "allowaccess"), "ping snmp", `${name}: ${port} allowaccess`);
                assert.equal(readSet(edit, "mode") === "dhcp", uplink.dhcp, `${name}: ${port} mode`);
                assert.equal(readSet(edit, "ip") !== undefined, !uplink.dhcp, `${name}: ${port} ip`);
            }
            const addresses = ["123.231.211.162 255.255.255.252", "1.5.12.166 255.255.255.252"];
            active.forEach((uplink, i) =>
                assert.equal(readSet(findEdit(interfaces, uplink.interface)!, "ip"), uplink.dhcp ? undefined : addresses[i], `${name}: uplink ${i + 1} address`),
            );

            // No uplink is a hardware-switch member.
            const switchPorts = (findConfig(doc, "system virtual-switch")?.children.filter(isEdit) ?? []).flatMap((sw) => findConfig(sw, "port")!.children.filter(isEdit).map(editName));
            for (const uplink of active) assert.ok(!switchPorts.includes(uplink.interface), `${name}: ${uplink.interface} still in the switch`);
            assert.ok(switchPorts.length > 0, `${name}: the switch kept a port`);

            // SD-WAN names exactly the uplinks, with gateways on static links only.
            const members = findConfig(findConfig(doc, "system sdwan")!, "members")!.children.filter(isEdit);
            assert.deepEqual(members.map((m) => readSet(m, "interface")), active.map((u) => u.interface), `${name}: SD-WAN members`);
            assert.deepEqual(members.map((m) => readSet(m, "gateway")), active.map((u, i) => (u.dhcp ? undefined : ["123.231.211.161", "1.5.12.165"][i])), `${name}: gateways`);

            // One management tunnel per uplink, on its port.
            const tunnels = interfaces.children.filter(isEdit).filter((e) => editName(e).startsWith("SPOKE-MGMT-OV"));
            assert.deepEqual(tunnels.map((e) => readSet(e, "interface")), active.map((u) => u.interface), `${name}: tunnels`);
            const indexes = interfaces.children.filter(isEdit).map((e) => readSet(e, "snmp-index"));
            assert.equal(new Set(indexes).size, indexes.length, `${name}: snmp-index used twice`);

            // A BGP neighbor per tunnel, added to the template's empty list; the AS settings are the template's.
            const bgp = findConfig(doc, "router bgp")!;
            const neighbors = findConfig(bgp, "neighbor")!.children.filter(isEdit);
            assert.deepEqual(neighbors.map(editName), ["100.108.255.254", "100.109.255.254"].slice(0, active.length), `${name}: BGP neighbors`);
            assert.equal(readSet(bgp, "as"), "4200000002", `${name}: BGP AS`);
            assert.ok(neighbors.every((nb) => readSet(nb, "local-as") === "4200000001"), `${name}: local-as`);
            assert.equal(readSet(bgp, "router-id"), VALUES.loopback205, `${name}: router-id`);

            // The LAN and everything that names its subnet.
            assert.equal(readSet(findEdit(interfaces, "lan")!, "ip"), "192.168.10.1 255.255.255.0", `${name}: LAN address`);
            const dhcp = findConfig(doc, "system dhcp server")!.children.filter(isEdit).find((s) => readSet(s, "interface") === "lan")!;
            assert.equal(readSet(dhcp, "default-gateway"), "192.168.10.1");
            const range = findConfig(dhcp, "ip-range")!.children.filter(isEdit);
            assert.deepEqual(range.map((r) => [readSet(r, "start-ip"), readSet(r, "end-ip")]), [["192.168.10.110", "192.168.10.210"]]);
            const lanAddress = findEdit(findConfig(doc, "firewall address")!, "lan")!;
            assert.equal(readSet(lanAddress, "subnet"), "192.168.10.0 255.255.255.0");

            // Values everywhere, nothing left to fill.
            assert.ok(!/\[[A-Z][A-Z0-9_]*\]/.test(content), `${name}: placeholders left`);
            assert.ok(content.includes('set hostname "2026504937_KFC_KGD-BOULEVARD"'));
            assert.equal(content.split("100.104.9.71").length - 1, template.split("[IP_LOOPBACK205]").length - 1, `${name}: loopback`);

            // Everything the generator doesn't own is the template, byte for byte.
            assert.deepEqual(sections(doc), sections(reference), `${name}: section order`);
            for (const [i, node] of doc.children.entries()) {
                if (node.kind === "config" && OWNED.has(node.name)) continue;
                assert.equal(serializeFortiOS({ ...doc, children: [node] }), serializeFortiOS({ ...reference, children: [reference.children[i]] }), `${name}: ${node.kind === "config" ? node.name : "line"} changed`);
            }
        }
    });
}

t("a hardware switch is never left without ports", () => {
    const file = TEMPLATES.find((name) => name.includes("30G"))!;
    const template = readFileSync(`${DIR}/${file}`, "utf8");
    const options: FortigateOptions = {
        dualLink: true,
        uplinks: { primary: { interface: "lan1", dhcp: false }, secondary: { interface: "lan2", dhcp: false } },
        ...NO_BGP,
    };
    assert.throws(() => generateConfig(template, VALUES, options), /without ports/);
});

t("a template that still lists the hub neighbors gets them replaced, not doubled, and says so", () => {
    const file = TEMPLATES[0];
    const neighbor = (address: string, n: number) =>
        `        edit "${address}"\n            set description "MGMT-OV-${n}-JKTTBSFTGW1"\n            set remote-as 4200000000\n        next\n`;
    const template = readFileSync(`${DIR}/${file}`, "utf8").replace(
        /(config router bgp[\s\S]*?    config neighbor\n)/,
        `$1${neighbor("100.108.255.254", 1)}${neighbor("100.109.255.254", 2)}`,
    );
    const uplinks = resolveUplinks(INITIAL_CHOICES, ["wan", "a"], { primary: "wan", secondary: "a" });
    const { content, warnings } = generateConfig(template, VALUES, { dualLink: false, uplinks, ...NO_BGP });
    const neighbors = findConfig(findConfig(parseFortiOS(content), "router bgp")!, "neighbor")!.children.filter(isEdit);
    assert.deepEqual(neighbors.map(editName), ["100.108.255.254"]);
    assert.match(warnings.join(" "), /replaced/);
});

t("the generator only adds: a port the template already configured, or one with an SD-WAN member, is refused", () => {
    const base = readFileSync(`${DIR}/${TEMPLATES[0]}`, "utf8");
    const uplinks = resolveUplinks(INITIAL_CHOICES, ["wan", "a"], { primary: "wan", secondary: "a" });
    const configured = base.replace(/(    edit "wan"\n        set vdom "root"\n)/, '$1        set ip 10.0.0.2 255.255.255.0\n');
    assert.throws(() => generateConfig(configured, VALUES, { dualLink: false, uplinks, ...NO_BGP }), /already sets "ip" on wan/);
    const withMember = (port: string) =>
        base.replace(/(config system sdwan[\s\S]*?    config members\n)/, `$1        edit 7\n            set interface "${port}"\n            set zone "TO-INTERNET"\n        next\n`);
    assert.throws(() => generateConfig(withMember("wan"), VALUES, { dualLink: false, uplinks, ...NO_BGP }), /SD-WAN member on wan/);
});

t("SD-WAN members the template brings stay, and the uplinks are numbered after them", () => {
    const base = readFileSync(`${DIR}/${TEMPLATES[0]}`, "utf8").replace(
        /(config system sdwan[\s\S]*?    config members\n)/,
        `$1        edit 7\n            set interface "lan2"\n            set zone "TO-INTERNET"\n        next\n`,
    );
    const uplinks = resolveUplinks(INITIAL_CHOICES, ["wan", "a"], { primary: "wan", secondary: "a" });
    const doc = parseFortiOS(generateConfig(base, VALUES, { dualLink: true, uplinks, ...NO_BGP }).content);
    const members = findConfig(findConfig(doc, "system sdwan")!, "members")!.children.filter(isEdit);
    assert.deepEqual(members.map((m) => [editName(m), readSet(m, "interface")]), [["7", "lan2"], ["8", "wan"], ["9", "a"]]);
});

t("a placeholder the generator doesn't know stops it, rather than shipping a config with it", () => {
    const template = readFileSync(`${DIR}/${TEMPLATES[0]}`, "utf8").replace(/set timezone .*/, "set timezone [TIMEZONE]");
    const uplinks = resolveUplinks(INITIAL_CHOICES, ["wan", "a"], { primary: "wan", secondary: "a" });
    assert.throws(() => generateConfig(template, VALUES, { dualLink: false, uplinks, ...NO_BGP }), /\[TIMEZONE\]/);
});

/* ---------- custom BGP ---------- */

/** The NEXT GOAL sample: two providers in AS 4800, the site in AS 64540, one public /29. */
const BGP_VALUES: FortigateValues = {
    ...VALUES,
    loopback205: "100.104.17.9",
    ip_primary: "182.23.102.210/30",
    ip_secondary: "182.23.102.98/30",
    bgp_as: "64540",
    bgp_router_id: "",
    bgp_prefixes: "182.23.55.152/29",
};
const BGP_NEIGHBORS = [
    { id: 1, ip: "182.23.102.209", remoteAs: "4800", role: "main" },
    { id: 2, ip: "182.23.102.97", remoteAs: "4800", role: "backup" },
] as const;
const bgpOptions = (dualLink: boolean, neighbors: FortigateOptions["neighbors"] = BGP_NEIGHBORS): FortigateOptions => ({
    dualLink,
    uplinks: resolveUplinks(INITIAL_CHOICES, ["wan", "a"], { primary: "wan", secondary: "a" }),
    customBgp: true,
    neighbors,
});
const block = (doc: Document, name: string) => serializeFortiOS({ ...doc, children: [findConfig(doc, name)!] });

/** The sample's routing blocks as a 7.4 export writes them (with the prefix-list's missing `end` restored). */
const EXPECTED_74 = {
    "router prefix-list": `config router prefix-list
    edit "Loopback205"
        config rule
            edit 1
                set prefix 100.104.17.9 255.255.255.255
                unset ge
                unset le
            next
        end
    next
    edit "PREFIX-LAN"
        config rule
            edit 1
                set prefix 182.23.55.152 255.255.255.248
                unset ge
                unset le
            next
        end
    next
end`,
    "router route-map": `config router route-map
    edit "OUT-TO-JKTTBSFTGW1"
        config rule
            edit 1
                set match-ip-address "Loopback205"
                unset set-ip-prefsrc
            next
        end
    next
    edit "IN-FROM-JKTTBSFTGW1"
        config rule
            edit 1
                set match-community "4800:1000"
                unset set-ip-prefsrc
            next
        end
    next
    edit "OUT-TO-MAIN"
        config rule
            edit 1
                set match-ip-address "PREFIX-LAN"
                unset set-ip-prefsrc
            next
            edit 2
                set action deny
                unset set-ip-prefsrc
            next
        end
    next
    edit "OUT-TO-BACKUP"
        config rule
            edit 1
                set match-ip-address "PREFIX-LAN"
                set set-aspath "64540 64540 64540 64540 64540"
                unset set-ip-prefsrc
            next
            edit 2
                set action deny
                unset set-ip-prefsrc
            next
        end
    next
end`,
};
const EXPECTED_BGP_HEAD = `config router bgp
    set as 64540
    set router-id 100.104.17.9
    set ebgp-multipath enable
    config neighbor
        edit "100.108.255.254"
            set description "MGMT-OV-1-JKTTBSFTGW1"
            set remote-as 4200000000
            set local-as 4200000001
            set route-map-in "IN-FROM-JKTTBSFTGW1"
            set route-map-out "OUT-TO-JKTTBSFTGW1"
            set connect-timer 1
        next
        edit "100.109.255.254"
            set description "MGMT-OV-2-JKTTBSFTGW1"
            set remote-as 4200000000
            set local-as 4200000001
            set route-map-in "IN-FROM-JKTTBSFTGW1"
            set route-map-out "OUT-TO-JKTTBSFTGW1"
            set connect-timer 1
        next
        edit "182.23.102.209"
            set soft-reconfiguration enable
            set remote-as 4800
            set route-map-out "OUT-TO-MAIN"
        next
        edit "182.23.102.97"
            set soft-reconfiguration enable
            set remote-as 4800
            set route-map-out "OUT-TO-BACKUP"
        next
    end
    config network
        edit 1
            set prefix 182.23.55.152 255.255.255.248
        next
        edit 100
            set prefix 100.104.17.9 255.255.255.255
        next
    end`;

for (const file of TEMPLATES) {
    t(`${file}: custom BGP writes the NEXT GOAL sample, in this firmware's export style`, () => {
        const template = readFileSync(`${DIR}/${file}`, "utf8");
        const doc = parseFortiOS(generateConfig(template, BGP_VALUES, bgpOptions(true)).content);
        const is74 = file.includes("7.4");
        const style = (text: string) => (is74 ? text : text.replace(/\n +unset set-ip-prefsrc/g, ""));
        assert.equal(block(doc, "router prefix-list"), EXPECTED_74["router prefix-list"]);
        assert.equal(block(doc, "router route-map"), style(EXPECTED_74["router route-map"]));
        assert.ok(block(doc, "router bgp").startsWith(EXPECTED_BGP_HEAD), block(doc, "router bgp"));
    });
}

t("custom BGP: only the route-maps in use, router-id when given, no warnings for a LAN prefix and connected peers", () => {
    const template = readFileSync(`${DIR}/${TEMPLATES[0]}`, "utf8");
    const values = { ...BGP_VALUES, bgp_router_id: "10.255.255.1", ip_lan: "182.23.55.153/29" };
    const { content, warnings } = generateConfig(template, values, bgpOptions(false, [BGP_NEIGHBORS[0]]));
    const doc = parseFortiOS(content);
    const maps = findConfig(doc, "router route-map")!.children.filter(isEdit).map(editName);
    assert.ok(maps.includes("OUT-TO-MAIN") && !maps.includes("OUT-TO-BACKUP"), maps.join(","));
    assert.equal(readSet(findConfig(doc, "router bgp")!, "router-id"), "10.255.255.1");
    assert.deepEqual(warnings, []);
});

t("custom BGP: warns about a prefix with no route and a peer off the uplink subnets", () => {
    const template = readFileSync(`${DIR}/${TEMPLATES[0]}`, "utf8");
    const far = [{ id: 1, ip: "8.8.4.4", remoteAs: "4800", role: "main" }] as const;
    const { warnings } = generateConfig(template, BGP_VALUES, bgpOptions(false, far));
    assert.match(warnings.join(" "), /182\.23\.55\.152\/29 isn't the LAN subnet/);
    assert.match(warnings.join(" "), /8\.8\.4\.4 isn't on an uplink subnet.*ebgp-enforce-multihop/);
});

t("custom BGP: a host address advertises its network, and a hub address can't be a peer", () => {
    const template = readFileSync(`${DIR}/${TEMPLATES[0]}`, "utf8");
    const doc = parseFortiOS(generateConfig(template, { ...BGP_VALUES, bgp_prefixes: "182.23.55.155/29" }, bgpOptions(true)).content);
    assert.match(block(doc, "router prefix-list"), /set prefix 182\.23\.55\.152 255\.255\.255\.248/);
    const hub = [{ id: 1, ip: "100.108.255.254", remoteAs: "4800", role: "main" }] as const;
    assert.throws(() => generateConfig(template, BGP_VALUES, bgpOptions(false, hub)), /already a BGP neighbor/);
});

t("custom BGP: neighbor validation catches bad and duplicate peers, bad AS numbers and iBGP", () => {
    const errors = validateNeighbors(
        [
            { id: 1, ip: "182.23.102.209", remoteAs: "4800", role: "main" },
            { id: 2, ip: "182.23.102.209", remoteAs: "04800", role: "backup" },
            { id: 3, ip: "300.1.1.1", remoteAs: "64540", role: "backup" },
            { id: 4, ip: "", remoteAs: "4294967296", role: "backup" },
        ],
        "64540",
    );
    assert.deepEqual(Object.keys(errors), ["2", "3", "4"]);
    assert.match(errors[2].ip!, /already/);
    assert.match(errors[2].remoteAs!, /AS number/);
    assert.match(errors[3].ip!, /valid IPv4/);
    assert.match(errors[3].remoteAs!, /iBGP/);
    assert.match(errors[4].ip!, /required/);
    assert.match(errors[4].remoteAs!, /AS number/);
});

console.log(`\n${n} checks passed`);
