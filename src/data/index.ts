// Barrel for generated data + shared type definitions. This file is
// hand-written; individual data modules alongside are auto-generated.
//
// NOTE: `LIVES` is intentionally NOT re-exported here to keep bundle size
// small for consumers who only need calendar / commemoration metadata.
// Import it explicitly from `ponomar-ts/lives` (the prose payload is ~2 MB).

export * from "./types.ts";
export { PENTECOSTARION } from "./pentecostarion.ts";
export { TRIODION } from "./triodion.ts";
export { MENAION } from "./menaion.ts";
export { DIVINE_LITURGY_COMMANDS } from "./divineLiturgy.ts";
export { FASTING_RULES } from "./fasting.ts";
export { COMMEMORATIONS } from "./commemorations.ts";
