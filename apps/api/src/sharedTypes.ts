/**
 * Relative-path re-export of @incident-commander/shared — same reasoning as
 * simEngine.ts in this same directory. Kept as a separate file (rather than
 * merged into simEngine.ts) because there's no export-name overlap to worry
 * about, and it's clearer for a reader to see which shim a given import came
 * through.
 */
export * from "../../../packages/shared/src/index.js";
