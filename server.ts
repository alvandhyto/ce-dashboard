import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { openSpeedTestMiddleware } from "./server/openSpeedTest";

async function startServer() {
    const app = express();
    const PORT = Number(process.env.PORT) || 3000;

    // The speedtest engine's download, upload and ping endpoints (before anything that reads bodies).
    app.use(openSpeedTestMiddleware);

    // Catch-all for API to prevent HTML responses
    app.all("/api/*splat", (req, res) => {
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
        // Next to this file, not the working directory, so it doesn't matter where pm2 is started from.
        const distPath = path.join(import.meta.dirname, "dist");
        // Hashed build files never change, so browsers may keep them. A missing one is a real 404:
        // answering with index.html would hand the browser HTML as a stylesheet, which it drops.
        app.use(
            "/assets",
            express.static(path.join(distPath, "assets"), {
                immutable: true,
                maxAge: "1y",
                fallthrough: false,
            }),
        );
        app.use(express.static(distPath, { index: false }));
        // index.html names the current build's files, so it is checked again on every load.
        app.get("/{*splat}", (req, res) => {
            res.set("Cache-Control", "no-cache");
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
