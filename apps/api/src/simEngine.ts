/**
 * Relative-path re-export of @incident-commander/sim, imported by every other
 * file in this package instead of the bare package specifier.
 *
 * Why: Netlify's function bundler (esbuild) leaves bare-specifier imports
 * into node_modules as external/runtime imports rather than inlining them.
 * At runtime it resolves them by walking up from wherever the bundled
 * function actually gets served — and because of the same `--filter`
 * monorepo-detection quirk documented in phase-summary.md's Phase 0 entries,
 * that ends up being `apps/web`'s dependency tree, not `apps/api`'s. pnpm
 * only symlinks a workspace package into the node_modules of whichever
 * package's package.json actually declares it as a dependency — apps/web
 * never declares @incident-commander/sim (it has no legitimate reason to;
 * only this API layer talks to the simulation engine), so that bare import
 * fails with "Cannot find package" in exactly the environment this was
 * caught in (`netlify dev`, verified before deploying).
 *
 * A RELATIVE import bypasses this entirely: esbuild reads and inlines local
 * source files unconditionally, with no node_modules resolution involved at
 * all, so it can't be affected by whichever directory the CLI's monorepo
 * detection happens to be confused about. Confining the relative path to
 * this one file, rather than scattering `../../../packages/sim/src/index.js`
 * across every route/store/authz file, keeps the workaround contained and
 * the rest of the codebase readable.
 */
export * from "../../../packages/sim/src/index.js";
