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
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("/{*splat}", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
