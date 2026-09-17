import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	build: {
		outDir: "dist/client",
		emptyOutDir: false,
	},
	server: {
		port: 9844,
		strictPort: true,
		proxy: {
			"/api": "http://127.0.0.1:9843",
		},
	},
});
