import type { EngineSnapshot } from "./model";

const text = (doc: Pick<Document, "getElementById">, id: string) =>
    doc.getElementById(id)?.textContent?.trim() ?? "";

/** Reads the numbers OpenSpeedTest's script has written to the engine page (public/openspeedtest/index.html). */
export function readSnapshot(doc: Pick<Document, "getElementById">): EngineSnapshot {
    return {
        status: text(doc, "oDoLiveStatus"),
        live: text(doc, "oDoLiveSpeed"),
        ping: text(doc, "pingResult"),
        jitter: text(doc, "jitterDesk"),
        download: text(doc, "downResult"),
        upload: text(doc, "upRestxt"),
        failed: doc.getElementById("ConnectErrorDesk")?.style.display === "block",
        report: doc.getElementById("resultsData")?.getAttribute("xlink:href") ?? "",
    };
}
