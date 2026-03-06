import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined

                    if (id.includes('react-pdf') || id.includes('pdfjs-dist')) return 'vendor-pdf'
                    if (id.includes('xterm')) return 'vendor-terminal'
                    if (id.includes('framer-motion')) return 'vendor-motion'
                    if (id.includes('react-router')) return 'vendor-router'
                    if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'

                    return 'vendor-misc'
                },
            },
        },
    },
    optimizeDeps: {
        exclude: ["html2canvas-pro"],
    },
    server: {
        hmr: {
            overlay: true,
        },
        watch: {
            ignored: ["**/node_modules/**"],
        },
    },
});
