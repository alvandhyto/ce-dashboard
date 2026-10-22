import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // Speedtest Endpoints
    app.get("/api/speedtest/getIP", (req, res) => {
        const clientIp =
            req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const ip = Array.isArray(clientIp)
            ? clientIp[0]
            : clientIp?.split(",")[0] || clientIp;
        res.json({ ip });
    });

    app.get("/api/speedtest/empty", (req, res) => {
        res.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        );
        res.set("Access-Control-Allow-Origin", "*");
        res.send();
    });

    // Handle large uploads by NOT parsing the body
    app.post("/api/speedtest/empty", (req, res) => {
        // Consume the stream without parsing it to body
        req.on("data", () => {});
        req.on("end", () => {
            res.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, max-age=0",
            );
            res.set("Access-Control-Allow-Origin", "*");
            res.send();
        });
    });

    app.get("/api/speedtest/garbage", (req, res) => {
        res.set("Content-Description", "File Transfer");
        res.set("Content-Type", "application/octet-stream");
        res.set("Content-Disposition", "attachment; filename=random.dat");
        res.set("Content-Transfer-Encoding", "binary");
        res.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        );
        res.set("Access-Control-Allow-Origin", "*");

        const chunkSize = 1024 * 1024; // 1MB
        const chunk = Buffer.alloc(chunkSize, "0");
        const ckSize = parseInt(req.query.ckSize as string) || 100;
        const totalSize = ckSize * 1024 * 1024;

        let bytesSent = 0;
        function send() {
            while (bytesSent < totalSize) {
                bytesSent += chunkSize;
                const isDrained = res.write(chunk);
                if (!isDrained) {
                    res.once("drain", send);
                    return;
                }
            }
            res.end();
        }
        send();
    });

    // Catch-all for API to prevent HTML responses
    app.all("/api/*", (req, res) => {
        res.status(404).json({ error: "API Route Not Found", path: req.path });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
