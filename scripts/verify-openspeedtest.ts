/**
 * Checks the Speedtest tool's engine: that the page (public/openspeedtest/index.html) and
 * OpenSpeedTest's script (app-2.5.4.js) still fit together, and that the app reads the right
 * numbers from them (src/tools/speedtest/readSnapshot.ts and model.ts). Run it after editing
 * either, or after updating the script:
 *
 *     npx tsx scripts/verify-openspeedtest.ts
 *
 * It runs the real script, unmodified, in Node against a fake document that only contains the
 * elements the page has, with a simulated network. An element the script needs but the page lacks
 * makes it throw, and the check fails. A full simulated test takes about a minute, because the
 * script's own timings (15 s each for download and upload) are used as they are.
 *
 * Needs Node 18 or newer. Nothing is installed or fetched.
 */
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { performance as nodePerf } from "node:perf_hooks";
import { readSnapshot } from "../src/tools/speedtest/readSnapshot";
import { parseReport, stageFromSnapshot, viewFromSnapshot, type EngineSnapshot, type Stage } from "../src/tools/speedtest/model";

const DIR = "public/openspeedtest";
const html = readFileSync(`${DIR}/index.html`, "utf8");
const engine = readFileSync(`${DIR}/app-2.5.4.js`, "utf8");
const block = (id: string) => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))![1];
const PAGE_IDS = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
/** What an element holds before the script touches it, e.g. the dash in <span id="downResult">-</span>. */
const initialText = (id: string) => html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1] ?? "";

let n = 0; const t = async (name: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log("ok -", name); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, ms: number, what: string) { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return; await sleep(100); } throw new Error(`timed out waiting for ${what}`); }

/* ---------- fake browser ---------- */
interface Net { rttMs: number; mbps: number; failPing?: boolean }

class FakeEl {
    attrs: Record<string, string> = {}; style: Record<string, any> = {}; listeners: Record<string, Function[]> = {};
    children: FakeEl[] = []; parentNode: FakeEl | null = null; hidden = false; search = ""; statusLog: string[] = [];
    private text = ""; private anchor: FakeEl | null = null; private anchorOpen = ""; private hrefValue = "";
    constructor(public id = "", public tag = "div") {}
    get textContent() { return this.text; }
    set textContent(v: string) { this.text = String(v); this.anchor = null; if (this.id === "oDoLiveStatus") this.statusLog.push(this.text); }
    get innerHTML() { return this.anchor ? `${this.anchorOpen}${this.anchor.text}</a>` : this.text; }
    set innerHTML(v: string) {
        const m = /^(<a[^>]*>)([\s\S]*)<\/a>$/.exec(v);
        if (m) { this.anchorOpen = m[1]; this.anchor = new FakeEl("", "a"); this.anchor.text = m[2]; } else { this.text = v; this.anchor = null; }
    }
    set href(v: string) { this.hrefValue = v; try { this.search = new URL(v).search; } catch { this.search = ""; } }
    get href() { return this.hrefValue; }
    querySelector(sel: string) { return sel === "a" ? this.anchor : null; }
    addEventListener(type: string, fn: Function) { (this.listeners[type] ??= []).push(fn); }
    removeEventListener(type: string, fn: Function) { this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn); }
    setAttribute(k: string, v: unknown) { this.attrs[k] = String(v); }
    setAttributeNS(_ns: string, k: string, v: unknown) { this.attrs[k] = String(v); }
    getAttribute(k: string) { return this.attrs[k] ?? null; }
    appendChild(c: FakeEl) { c.parentNode = this; this.children.push(c); return c; }
    removeChild(c: FakeEl) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
    remove() { this.parentNode?.removeChild(this); }
}

function createWorld(net: Net, opts: { withEngine?: boolean; url?: string } = {}) {
    const { withEngine = true, url = "https://tools.example/openspeedtest/index.html?theme=dark" } = opts;
    const els = new Map<string, FakeEl>(); const created: FakeEl[] = []; const docListeners: Record<string, Function[]> = {};
    const el = (id: string) => { if (!PAGE_IDS.has(id)) return null; if (!els.has(id)) { const e = new FakeEl(id); e.textContent = initialText(id); e.statusLog.length = 0; els.set(id, e); } return els.get(id)!; };
    const live = (cls: string) => new Proxy({}, { get(_, p) { const a = created.filter((e) => e.attrs.class === cls && e.parentNode); return p === "length" ? a.length : a[Number(p)]; } });
    const root = new FakeEl("documentElement", "html");
    const document = {
        documentElement: root,
        getElementById: el,
        createElement: (tag: string) => { const e = new FakeEl("", tag); created.push(e); return e; },
        createElementNS: (_ns: string, tag: string) => { const e = new FakeEl("", tag); created.push(e); return e; },
        getElementsByClassName: live,
        addEventListener: (type: string, fn: Function) => { (docListeners[type] ??= []).push(fn); },
        removeEventListener: (type: string, fn: Function) => { docListeners[type] = (docListeners[type] ?? []).filter((f) => f !== fn); },
    };

    let lastRtt = 0;
    const requests: string[] = [];
    const pingDurations: number[] = [];
    const fakePerformance = { now: () => nodePerf.now(), clearResourceTimings() {}, getEntries: () => [{ initiatorType: "xmlhttprequest", duration: lastRtt }] };

    const BYTES_PER_MS_PER_THREAD = (net.mbps * 1e6) / 8 / 1000 / 6;   // six parallel requests share the link
    class FakeXHR {
        upload: { onprogress: null | ((e: any) => void) } = { onprogress: null };
        onload: null | ((e: any) => void) = null; onprogress: null | ((e: any) => void) = null; onerror: any = null; ontimeout: any = null;
        responseType = ""; timeout = 0; status = 0; readyState = 0; method = ""; url = ""; timers: any[] = [];
        open(m: string, u: string) { this.method = m; this.url = u; requests.push(`${m} ${u}`); }
        setRequestHeader() {}
        abort() { this.timers.forEach((x) => clearInterval(x)); this.timers = []; }
        send(body?: { size: number }) {
            if (this.url.includes("upload") && this.method === "GET") {                       // a ping
                if (net.failPing) { this.timers.push(setTimeout(() => this.onerror?.({}), 5)); return; }
                const rtt = net.rttMs + (Math.random() * 2 - 1);                               // a little natural scatter
                pingDurations.push(rtt);
                this.timers.push(setTimeout(() => { lastRtt = rtt; this.status = 200; this.readyState = 4; this.onload?.call(this, {}); }, rtt));
            } else if (this.url.includes("downloading")) {
                const total = 30e6; let loaded = 0;
                const tick = setInterval(() => { loaded = Math.min(total, loaded + BYTES_PER_MS_PER_THREAD * 50); this.onprogress?.({ loaded, total });
                    if (loaded >= total) { clearInterval(tick); this.status = 200; this.readyState = 4; this.onload?.call(this, { total }); } }, 50);
                this.timers.push(tick);
            } else if (this.method === "POST") {
                const total = body?.size ?? 30e6; let loaded = 0;
                const tick = setInterval(() => { loaded = Math.min(total, loaded + BYTES_PER_MS_PER_THREAD * 50); this.upload.onprogress?.({ loaded, total });
                    if (loaded >= total) { clearInterval(tick); this.status = 200; this.readyState = 4; this.onload?.call(this, {}); } }, 50);
                this.timers.push(tick);
            }
        }
    }

    const sandbox: any = {
        console, setTimeout, clearTimeout, setInterval, clearInterval, Blob, Uint32Array, XMLHttpRequest: FakeXHR,
        navigator: { userAgent: "node-contract-test" }, location: { hostname: "tools.example", href: url, search: new URL(url).search },
        document, performance: fakePerformance, Element: class { },
    };
    sandbox.window = sandbox; sandbox.Element.prototype.remove = function () {};
    vm.createContext(sandbox);
    const run = (code: string, filename: string) => vm.runInContext(code, sandbox, { filename });
    run(block("ost-config"), "ost-config");
    return { sandbox, el, created, docListeners, pingDurations, requests, run, root, boot: () => { if (withEngine) run(engine, "app-2.5.4.js"); run(block("ost-start"), "ost-start"); } };
}

const uncaught: unknown[] = [];
process.on("uncaughtException", (e) => { uncaught.push(e); });

const snap = (o: Partial<EngineSnapshot> = {}): EngineSnapshot =>
    ({ status: "", live: "0", ping: "-", jitter: "-", download: "-", upload: "-", failed: false, report: "", ...o });

(async () => {
/* ---------- the page itself ---------- */
await t("every element ID the script looks up exists in the page (OpenSpeedTest-UI, the <object> its own page uses, is the one exception)", () => {
    const used = new Set([...engine.matchAll(/_\("([^"]+)"\)|getElementById\("([^"]+)"\)/g)].map((m) => m[1] ?? m[2]));
    const missing = [...used].filter((id) => !PAGE_IDS.has(id));
    assert.deepEqual(missing, ["OpenSpeedTest-UI"]);
    assert.ok(used.size >= 40, `found ${used.size} lookups`);
});
await t("no ID appears twice in the page", () => {
    const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]); assert.equal(new Set(all).size, all.length);
});
await t("the engine file is the one OpenSpeedTest ships: our page doesn't touch it, it is loaded as a plain script", () => {
    assert.ok(html.includes('<script src="app-2.5.4.js"></script>')); assert.ok(!html.includes('id="OpenSpeedTest-UI"') && !/<object\s/.test(html), "no <object> element: OpenSpeedTest's own SVG page isn't used");
});
await t("the page is a headless engine: no stylesheet, no visible text of its own", () => {
    assert.ok(!/<link[^>]+stylesheet/.test(html), "no stylesheet");
    assert.ok(html.includes('id="startButtonDesk"'), "the Start button the app presses");
});
await t("every element the app reads is in the page", () => {
    for (const id of ["oDoLiveStatus", "oDoLiveSpeed", "pingResult", "jitterDesk", "downResult", "upRestxt", "ConnectErrorDesk", "startButtonDesk"]) assert.ok(PAGE_IDS.has(id), id);
});
await t("measurement settings are OpenSpeedTest's own defaults (from its index.html), except the durations, set for 15 s each", () => {
    const g = createWorld({ rttMs: 5, mbps: 50 }).sandbox;
    // Official values, read from https://github.com/openspeedtest/Speed-Test/blob/main/index.html
    const official: Record<string, unknown> = {
        pingSamples: 10, jitterFinalSample: 0.5, pingTimeOut: 5000, pingMethod: "GET", pingFile: "Upload", ulDataSize: 30,
        ulDelay: 300, dlDelay: 300, upAdjust: 1.04, dlAdjust: 1.04, dlDuration: 12.5, ulDuration: 15, dlThreads: 6, ulThreads: 6,
        enableRun: true, saveData: false, openChannel: "dev",
    };
    for (const [k, v] of Object.entries(official)) assert.equal(g[k], v, `${k} differs from the expected setting`);
    assert.deepEqual(JSON.parse(JSON.stringify(g.openSpeedTestServerList)).map((x: any) => [x.Download, x.Upload]), [["downloading", "upload"]]);
    // The seven that are true in OpenSpeedTest's own page and are switched off here, on purpose.
    for (const k of ["setPingSamples", "setPingTimeout", "setHTTPReq", "stressTest", "selectTest", "selectServer", "enableClean"]) assert.equal(g[k], false, k);
});

/* ---------- how the app maps the page to a stage (model.ts) ---------- */
await t("stage from the status line, in the order the script writes it", () => {
    const cases: Array<[Stage, Partial<EngineSnapshot>, Stage]> = [
        ["PING", { status: "" }, "PING"],                                                   // pings running: no status yet
        ["PING", { status: "Milliseconds", ping: "20" }, "PING"],                           // pings done
        ["PING", { status: "Initializing..", ping: "20" }, "DOWNLOAD"],                     // before the download
        ["DOWNLOAD", { status: "Testing download speed.." }, "DOWNLOAD"],
        ["DOWNLOAD", { status: "Mbps download" }, "DOWNLOAD"],
        ["DOWNLOAD", { status: "Initializing..", download: "81.3" }, "UPLOAD"],             // before the upload: the download figure exists
        ["UPLOAD", { status: "Testing upload speed.." }, "UPLOAD"],
        ["UPLOAD", { status: "Mbps upload" }, "UPLOAD"],
        ["UPLOAD", { status: "All done" }, "COMPLETE"],
    ];
    for (const [from, s, want] of cases) assert.equal(stageFromSnapshot(from, snap(s)), want, `${from} + "${s.status}"`);
});
await t("what the screen shows: ping from its element, a speed only while one is being measured", () => {
    // Right after the pings the big number still holds the ping. It must not show as a download speed.
    let v = viewFromSnapshot("DOWNLOAD", snap({ status: "Initializing..", live: "21", ping: "21", jitter: "1" }));
    assert.equal(v.value, 0); assert.equal(v.results.download, 0); assert.equal(v.results.ping, 21);
    v = viewFromSnapshot("DOWNLOAD", snap({ status: "Mbps download", live: "55.4", ping: "21" }));
    assert.equal(v.value, 55.4); assert.equal(v.results.download, 55.4, "the tile follows the live speed");
    v = viewFromSnapshot("UPLOAD", snap({ status: "Mbps upload", live: "40.2", download: "81.3" }));
    assert.equal(v.value, 40.2); assert.equal(v.results.download, 81.3, "the finished figure replaces the live one"); assert.equal(v.results.upload, 40.2);
    v = viewFromSnapshot("COMPLETE", snap({ status: "All done", live: "0", download: "81.3", upload: "79.9", ping: "20", jitter: "0" }));
    assert.deepEqual(v.results, { ping: 20, jitter: 0, download: 81.3, upload: 79.9 }); assert.equal(v.value, 79.9);
    v = viewFromSnapshot("PING", snap({ status: "", live: "17", ping: "17", jitter: "2" }));
    assert.equal(v.value, 17); assert.equal(v.results.jitter, 2);
    assert.equal(viewFromSnapshot("PING", snap()).value, 0, "dashes read as zero");
});

/* ---------- a full test, with the real engine, read the way the app reads it ---------- */
let done: ReturnType<typeof createWorld>;
const seen: Stage[] = []; const liveSeen = { DOWNLOAD: [] as number[], UPLOAD: [] as number[] };
let last: { value: number; results: ReturnType<typeof viewFromSnapshot>["results"] } | null = null;
await t("a full test runs start to finish, no exceptions (about 40 s, real durations)", async () => {
    done = createWorld({ rttMs: 20, mbps: 80 }); done.boot();
    assert.equal(typeof done.sandbox.onload, "function", "our glue installed window.onload");
    done.sandbox.onload();                                                             // what the browser does on load
    const doc = { getElementById: (id: string) => done.el(id) as any };
    assert.deepEqual(readSnapshot(doc), snap(), "before the test: nothing but placeholders");

    // The app's loop (useSpeedtest.ts): press Start, then read ten times a second.
    let stage: Stage = "PING"; seen.push(stage);
    done.el("startButtonDesk")!.listeners.click[0]({ preventDefault() {} });         // what startButton.click() does
    const end = Date.now() + 120000;
    while (stage !== "COMPLETE") {
        if (Date.now() > end) throw new Error("timed out; last status: " + done.el("oDoLiveStatus")!.textContent);
        await sleep(100);
        const s = readSnapshot(doc); assert.equal(s.failed, false);
        const next = stageFromSnapshot(stage, s); const view = viewFromSnapshot(next, s);
        if (next !== stage) { stage = next; seen.push(stage); }
        if (stage === "DOWNLOAD" || stage === "UPLOAD") liveSeen[stage].push(view.value);
        last = view;
    }
    // The exact figures follow "All done" once the script's own gauge has wound down (runTest.ts waits for them).
    await waitFor(() => readSnapshot(doc).report !== "", 6000, "the results link");
    last = viewFromSnapshot("COMPLETE", readSnapshot(doc));
    await sleep(500);
    assert.deepEqual(uncaught, [], "no exception anywhere: " + uncaught.map(String).join("; "));
});
await t("the exact figures come from the results link, not the rounded on-page numbers", () => {
    const r = parseReport(readSnapshot({ getElementById: (id: string) => done.el(id) as any }).report)!;
    assert.ok(r, "the link parses");
    assert.ok(!Number.isInteger(r.download) || !Number.isInteger(r.upload), `speeds have decimals: ${r.download}, ${r.upload}`);
    assert.deepEqual(last!.results, r);
    assert.equal(parseReport(""), null); assert.equal(parseReport("not a url"), null);
});
await t("the app saw PING, DOWNLOAD, UPLOAD, COMPLETE, once each and in that order", () => {
    assert.deepEqual(seen, ["PING", "DOWNLOAD", "UPLOAD", "COMPLETE"]);
});
await t("the gauge had real speeds during download and upload, never the ping leftover", () => {
    for (const k of ["DOWNLOAD", "UPLOAD"] as const) {
        const v = liveSeen[k]; const moving = v.filter((x) => x > 0);
        console.log(`    ${k.toLowerCase()}: ${v.length} readings, ${moving.length} above zero, peak ${Math.max(...v).toFixed(1)} Mbps`);
        assert.ok(moving.length > 50, `${k}: ${moving.length} readings above zero`);
        assert.ok(Math.max(...v) < 120, `${k} peak ${Math.max(...v)} on an 80 Mbps link`);
    }
});
await t("the four results the app ends with", () => {
    const r = last!.results;
    console.log(`    simulated link 80 Mbps / 20 ms  ->  download ${r.download}, upload ${r.upload}, ping ${r.ping}, jitter ${r.jitter}`);
    assert.ok(r.download > 55 && r.download < 110, `download ${r.download}`); assert.ok(r.upload > 55 && r.upload < 110, `upload ${r.upload}`);
    assert.ok(r.ping > 15 && r.ping < 30, `ping ${r.ping}`); assert.ok(r.jitter >= 0 && r.jitter < 5, `jitter ${r.jitter}`);
    assert.equal(last!.value, r.upload, "the gauge ends on the upload figure");
});
await t("the status line walked through the stages, in order", () => {
    const log = done.el("oDoLiveStatus")!.statusLog.join(" | ");
    const order = ["Milliseconds", "Testing download speed", "Testing upload speed", "All done"].map((s) => log.indexOf(s));
    console.log("    status line:", [...new Set(done.el("oDoLiveStatus")!.statusLog)].join("  >  "));
    assert.ok(order.every((i) => i >= 0), log); assert.deepEqual([...order].sort((a, b) => a - b), order);
});
await t("nothing left the page: every request went to the downloading or upload file next to the page", () => {
    const all = done.requests; assert.ok(all.length > 20, `${all.length} requests`);
    for (const r of all) assert.match(r, /^(GET|POST) (downloading|upload)(\?[^ ]*)?$/, r);          // relative URLs only: same server, nothing external
    assert.ok(all.filter((r) => r.startsWith("GET upload")).length >= 10, "the ten ping samples");
    assert.ok(all.some((r) => r.startsWith("GET downloading")) && all.some((r) => r.startsWith("POST upload")));
    assert.ok(!all.some((r) => /openspeedtest\.com|https?:/.test(r)));
});

/* ---------- the server not answering ---------- */
await t("server unreachable: the app can tell (failed), and the script stops", async () => {
    const before = uncaught.length; const w = createWorld({ rttMs: 5, mbps: 50, failPing: true }); w.boot(); w.sandbox.onload();
    const doc = { getElementById: (id: string) => w.el(id) as any };
    w.el("startButtonDesk")!.listeners.click[0]({ preventDefault() {} });
    await waitFor(() => readSnapshot(doc).failed, 30000, "the error");
    assert.equal(w.el("oDoLiveStatus")!.textContent, "Check your network connection status.");
    await sleep(800); assert.equal(uncaught.length, before, "no exception");
});

console.log(`\n${n} tests passed`);
process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
