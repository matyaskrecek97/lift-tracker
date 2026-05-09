import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const entry = process.env.MCP_UI_ENTRY ?? "mcp-app.html";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: __dirname,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: entry,
    },
  },
});
