import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { openSpeedTestMiddleware } from "./server/openSpeedTest";

/** The speedtest engine's endpoints for `vite` and `vite preview`. `npm run dev` (server.ts) adds them itself. */
const openSpeedTest = (): Plugin => ({
    name: "openspeedtest-endpoints",
    configureServer: (server) => void server.middlewares.use(openSpeedTestMiddleware),
    configurePreviewServer: (server) => void server.middlewares.use(openSpeedTestMiddleware),
});

export default defineConfig({
    plugins: [react(), tailwindcss(), openSpeedTest()],
    server: {
        // HMR is disabled in AI Studio via DISABLE_HMR env var.
        // Do not modify file watching is disabled to prevent flickering during agent edits.
        hmr: process.env.DISABLE_HMR !== "true",
    },
});
