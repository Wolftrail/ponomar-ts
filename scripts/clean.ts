// Remove the dist/ output directory. Used by `npm run clean`.
// Kept in TypeScript so it type-checks under the project's `tsconfig.json`.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "..", "dist");
rmSync(dist, { recursive: true, force: true });
process.stdout.write(`cleaned ${dist}\n`);
