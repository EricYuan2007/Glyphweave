# Security Policy

## Supported versions

Security fixes target the current development line. Until a stable release is
published, consumers should use the latest reviewed commit; older snapshots do
not receive separate maintenance. Tested compiler compatibility is Typst 0.15.0.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/EricYuan2007/Glyphweave/security/advisories/new).
Include affected revision, reproduction steps, impact and a minimal synthetic
fixture. Never include credentials or real private documents. If private reporting
is unavailable, open an issue requesting a private reporting channel **without**
exploit details. No response-time SLA is promised.

## Trust model

Authors and TypeScript configuration are trusted. This project is a local build
pipeline, not a sandbox for hostile documents. HTML/MathML/SVG are sanitized before
page injection. Resource real paths must stay within the article assets directory.
Public files are selected from the current index and manifests, never old folders.

Output deletion requires a project-owned marker and safe paths. Generations are
immutable; an atomic index replacement publishes a complete build. Old generations
remain locally until `clean` and must never be deployed wholesale. `unlisted` is a
listing policy, not authentication. See [security details](docs/security.md).
