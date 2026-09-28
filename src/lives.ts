// Subpath entry for the English-language `<LIFE>` prose corpus.
//
// This module is exposed at the `ponomar-ts/lives` subpath so that consumers
// who only need commemoration metadata (`ResolvedSaint.name`, `.church`,
// `.info`) do not pay the ~2 MB payload cost of the life stories.
//
// Usage:
//   import { LIVES, getLife } from "ponomar-ts/lives";
//   const story = getLife("3174")?.body;

import type { Life } from "./data/types.ts";
import { LIVES } from "./data/lives.ts";

export type { Life } from "./data/types.ts";
export { LIVES } from "./data/lives.ts";

/** Look up the `<LIFE>` prose record for a commemoration id. */
export function getLife(cId: string): Life | undefined {
	return LIVES[cId];
}
