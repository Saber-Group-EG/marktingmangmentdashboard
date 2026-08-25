import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(() => {
    return {
        plugins: [react()],
        // allow overriding base at build time (e.g. VITE_BASE=/my-repo/ vite build)
        base: process.env.VITE_BASE || "/",
        server: {
            port: 5173,
            strictPort: true,
            proxy: {
                '/r2-proxy': {
                    target: 'https://upload.ats.sabergroup-eg.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/r2-proxy/, ''),
                    secure: false,
                },
            },
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "src"),
            },
        },
    };
});
