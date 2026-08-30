# Incident Commander

A WebMCP-native production incident response console, built for the WebMCP Challenge.

An AI agent investigates a live incident through structured WebMCP tools — service health,
deployments, logs, traces, metrics — while a human responder watches the same evidence in the
same console. Production-changing actions (rollback, restart, scale, feature flags) require
human approval, enforced server-side.

**Status:** early build, in progress for the WebMCP Challenge. This README will be filled in
properly closer to submission with the full design, architecture, and setup instructions.

## Local development

```bash
pnpm install
netlify dev
```

## License

MIT — see [LICENSE](LICENSE).
