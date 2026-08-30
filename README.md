# Incident Commander

A WebMCP-native production incident response console, built for the WebMCP Challenge.

An AI agent investigates a live incident through structured WebMCP tools — service health,
deployments, logs, traces, metrics — while a human responder watches the same evidence in the
same console. Production-changing actions (rollback, restart, scale, feature flags) require
human approval, enforced server-side.

**Status:** early build (Phase 0 of 12 — see `phase-summary.md`). This README will be filled in
properly in Phase 11; for now, see `implementation-plan.md` for the full design.

## Local development

```bash
pnpm install
netlify dev
```

## License

MIT — see [LICENSE](LICENSE).
