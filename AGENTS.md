# Repository guidance

## Project

TypeScript reimplementation of the Ponomar Orthodox liturgics engine. The upstream Java project and its data are retained under `vendor/ponomar` as reference material. Preserve upstream attribution and GPL terms for derivative work.

## Conventions

- Node.js >= 20, ESM, strict TypeScript, zero runtime dependencies.
- Tests use `node:test` and `--experimental-strip-types`.
- Cite the corresponding upstream Ponomar file when porting behavior or data.
- Public entry point: `src/index.ts`.
- `npm run typecheck`, `npm test`, and `npm run build` validate the package.
- Keep public APIs focused on Ponomar behavior; document behavior differences from upstream.
