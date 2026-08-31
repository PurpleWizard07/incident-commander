Self-hosted webfonts — Incident Commander
=========================================

Two families, latin subsets only, served from this origin rather than from
fonts.gstatic.com. Self-hosting removes a third-party DNS + TLS handshake from
the critical path; a real Lighthouse run against production measured that
cross-origin fetch at 0.3s of Largest Contentful Paint (0.8s -> 1.1s), which is
the entire cost of having real typography instead of system-ui.

  instrument-sans-latin-var.woff2   Instrument Sans, variable weight 400-700
  ibm-plex-mono-latin-400.woff2     IBM Plex Mono 400
  ibm-plex-mono-latin-500.woff2     IBM Plex Mono 500
  ibm-plex-mono-latin-600.woff2     IBM Plex Mono 600

Licensing
---------
Instrument Sans  — Copyright (c) Rodrigo Fuenzalida and Jordan Egstad.
IBM Plex Mono    — Copyright (c) IBM Corp.

Both are licensed under the SIL Open Font License, Version 1.1, which permits
redistribution and embedding, including in a bundled web application:

  https://openfontlicense.org
  https://fonts.google.com/specimen/Instrument+Sans/license
  https://fonts.google.com/specimen/IBM+Plex+Mono/license

Regenerating
------------
Fetch this URL with a modern browser User-Agent, keep only the blocks commented
as the latin subset, and update both the @font-face rules in src/index.css and
the <link rel="preload"> tags in index.html:

  https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap
