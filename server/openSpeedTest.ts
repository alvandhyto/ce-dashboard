import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * The two files OpenSpeedTest's script talks to, next to its page (public/openspeedtest/):
 *
 * - GET  downloading  the download test: a large body of random bytes, read as fast as the link allows
 * - POST upload       the upload test: the body is read in full and thrown away
 * - GET  upload       the pings: an empty 200, as fast as possible
 *
 * OpenSpeedTest's own servers do this with nginx rules. Here it is a plain Node middleware, so the
 * same code runs under Express (server.ts, dev and production) and under Vite's own servers
 * (vite.config.ts, for `vite` and `vite preview`).
 *
 * Without it, an SPA server answers both paths with the app's index.html: the download test then
 * fetches a few hundred bytes at a time, and each 30 MB upload is turned away after the first
 * chunk, which the script still counts as sent. The results are meaningless either way.
 */

const DOWNLOAD_PATH = /\/openspeedtest\/downloading$/;
const UPLOAD_PATH = /\/openspeedtest\/upload$/;

/** Each download request sends this much. The script aborts it when its 12 s are up, so it only has to outlast a fast link. */
const DOWNLOAD_BYTES = 256 * 1024 * 1024;

/** Random, so nothing on the way (a proxy, the browser) can compress it and inflate the result. Made once, sent over and over. */
const CHUNK = randomBytes(1024 * 1024);

const NO_STORE = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Access-Control-Allow-Origin": "*",
};

function sendDownload(res: ServerResponse) {
    res.writeHead(200, {
        ...NO_STORE,
        "Content-Type": "application/octet-stream",
        "Content-Length": DOWNLOAD_BYTES,
        // Stops gzip in proxies and dev servers that would otherwise squeeze the stream.
        "Content-Encoding": "identity",
    });

    let sent = 0;
    const write = () => {
        while (sent < DOWNLOAD_BYTES && !res.destroyed) {
            sent += CHUNK.length;
            if (!res.write(CHUNK)) return void res.once("drain", write);
        }
        res.end();
    };
    write();
}

function receiveUpload(req: IncomingMessage, res: ServerResponse) {
    // resume() reads the body as fast as it arrives and keeps none of it.
    req.on("end", () => {
        res.writeHead(200, { ...NO_STORE, "Content-Length": 0 });
        res.end();
    });
    req.resume();
}

function sendEmpty(res: ServerResponse) {
    res.writeHead(200, { ...NO_STORE, "Content-Length": 0 });
    res.end();
}

/** Connect-style middleware: answers the engine's two paths and passes everything else on. */
export function openSpeedTestMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const path = (req.url ?? "").split("?", 1)[0];

    if (DOWNLOAD_PATH.test(path) && req.method === "GET") return sendDownload(res);
    if (UPLOAD_PATH.test(path)) {
        if (req.method === "POST") return receiveUpload(req, res);
        if (req.method === "GET" || req.method === "HEAD") return sendEmpty(res);
    }
    next();
}
