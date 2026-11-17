import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Version affichée dans « À propos » et jointe aux signalements de bug : numéro (package.json racine),
// commit (fichier BUILD_COMMIT écrit par deploy/deploy.sh, sinon git) et date de compilation.
const root = new URL("../../", import.meta.url);
const version = JSON.parse(readFileSync(new URL("package.json", root), "utf8")).version as string;
const commit = (() => {
  try { return readFileSync(new URL("BUILD_COMMIT", root), "utf8").trim(); } catch { /* compilation locale */ }
  try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; }
})();

export default defineConfig({
  base: "./",
  plugins: [svelte()],
  define: {
    __HEXA_VERSION__: JSON.stringify(version),
    __HEXA_COMMIT__: JSON.stringify(commit),
    __HEXA_BUILT__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8787", ws: true } },
  },
});
