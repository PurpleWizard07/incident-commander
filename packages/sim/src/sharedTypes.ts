/**
 * Relative-path re-export of @incident-commander/shared, imported by every
 * other file in this package instead of the bare package specifier. Same
 * reasoning as apps/api/src/simEngine.ts — a bare specifier gets left as an
 * external, runtime-resolved import by Netlify's function bundler, and even
 * when the symlink happens to resolve, Node's native loader doesn't
 * understand this project's `./foo.js` → `./foo.ts` convention on a file it
 * never bundled. A relative import sidesteps both problems by getting
 * inlined at bundle time instead of resolved at runtime.
 */
export * from "../../shared/src/index.js";
