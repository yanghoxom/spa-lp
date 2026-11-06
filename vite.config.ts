import { existsSync, readdirSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { defineConfig } from "vite";

const root = process.cwd();
const htmlFiles = ["index.html"];

function walk(dir: string): void {
  if (!existsSync(resolve(root, dir))) return;
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (entry.isFile() && rel.endsWith(".html")) htmlFiles.push(rel);
  }
}
["kien-thuc", "my-pham", "tu-van-da", "ve-phung-ha", "chinh-sach"].forEach(walk);

export default defineConfig({
  base: "./",
  server: { allowedHosts: ["terminal.local"] },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        htmlFiles.map((name) => [
          relative(root, resolve(root, name)).split(sep).join("_").replace(/\.html$/, ""),
          resolve(root, name),
        ]),
      ),
    },
  },
});
