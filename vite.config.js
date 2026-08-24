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
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "src"),
            },
        },
    };
});
