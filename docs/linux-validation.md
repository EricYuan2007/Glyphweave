# Linux native distribution acceptance

Date: 2026-11-01. Local candidate version: 0.4.1. No npm publication, GitHub
Release, remote CI execution or deployment was performed.

## Environment and provenance

Both Linux targets run in Debian 12 / glibc 2.36 containers under OrbStack, using
Node 26.13.0, pnpm 12.16.1, Typst CLI 0.15.1, Noto CJK / DejaVu and poppler.
ARM64 execution is native; x64 execution is emulated. This is functional evidence,
not native x64 performance evidence. Ubuntu native runners for both architectures
are prepared in manual CI but were not run remotely.

Rust is pinned to 1.99.1; the verified compiler reports
`rustc 1.99.1 (58cf8f9c3 2026-10-13)`. Linux engines were compiled on ARM64, with
the GNU x64 cross linker for x64. Both native headers and receipts are checked
before packaging. The final source-stability guard was also rerun against both
Linux build targets; the resulting binary hashes stayed unchanged.

Native source SHA-256 (Cargo.toml, Cargo.lock and all Rust source files):
`c8f9cd6ef10c5626c0d3c8c26cd6af2140e8598e2a42cac42531f46242fc21c8`.

| Target | Executable SHA-256 |
| --- | --- |
| darwin-arm64 | `4ad64c21d145668b3216174eb3a1091a565ce89d127da1ce971187b7481fc507` |
| linux-arm64 | `ca5ecb94f4f8216e83ba9c216cf4f264d08c10ee6a58b7c22d5c770c579a9997` |
| linux-x64 | `d2a9ae4720a5c719e73eca58869d9766458e88ea70d9625f87d398f660c5ebe2` |

## Gates

| Gate | Linux ARM64 | Linux x64 (emulated) | macOS ARM64 |
| --- | --- | --- | --- |
| Build, lint, type checks, Astro checks | Pass | Pass | Pass |
| Unit / distribution checks | 99 + 3 pass | 99 + 3 pass | 99 + 3 pass |
| Real Typst: mathml / svg-frame / html-frame, HTML + PDF, cache and rollback | Pass | Pass | Pass |
| PDF typography | Portable profile passes | Portable profile passes | Editorial profile passes |
| Native geometry, regression fixtures, accessibility in Chromium / Firefox / WebKit | Pass | Pass | Pass |
| Isolated npm tarball install and actual native launcher | Pass | Pass, three-target archive | Pass |
| Demo build / Pagefind / Chromium acceptance | 5 tests pass | 5 tests pass | Not rerun in this round |

Linux `test:native --prebuilt` checks the same compiled engine bytes that were
assembled into the consumer archive; it does not substitute a mock compiler.
The standalone package checks exercise all three rendering strategies and
cross-process cached / forced builds. The default-resolution and cache-identity
changes are covered by the installed-package assertion on the actual native path.

The three-target candidate consumed by InkStack has these SHA-256 hashes:

- `glyphweave-0.4.1.tgz`: `d1dd387a17156fb4daea7eb5b5f89fa89c03fe8c71a27c3f05b7a4437f876505`
- `glyphweave-astro-0.4.1.tgz`: `e596fc7dae7b5a28005f8d4ad19cde8f85ac6f3f0f0e5d3c142be65fcadc46c1`

Full consumer acceptance, including theme switching, publication, plugin crashes,
PTY behavior and globally installed CLI builds, is recorded in the companion
InkStack repository at `docs/plugin-phase8-validation.md`. Local command logs and
native-math artifacts are retained under `dist/test-results/linux-release/`;
they are ignored test outputs, not release assets.

## Limits

Slow official-download links required isolated-container mirrors for npm, Debian
and test browsers, and segmented downloads from the same official Typst release
URLs with the pinned full-file SHA-256 checks. npm lock integrity and Debian
signature checks stayed enabled. Failed/bootstrap attempts are retained separately
from final passing logs. No host-wide registry or font configuration was changed.

The tested Linux baseline is glibc 2.36. No claim is made for Alpine/musl, older
glibc, Windows, arbitrary distributions or bit-identical builds across linkers.
macOS ARM64 remains covered by the existing renderer, native-browser and package
checks. Expected warnings from Typst's experimental HTML exporter and unavailable
alternative font families do not replace the dedicated portable PDF typography
checks.
