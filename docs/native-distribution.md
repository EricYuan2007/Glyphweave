# Native engine distribution

Glyphweave 0.4.1 can assemble one local tarball containing `darwin-arm64`,
`linux-arm64`, and `linux-x64` native engines. Normal users need Node 26.13.0,
Typst 0.15.1 and PDF fonts/tools; Cargo is a maintainer build dependency only.
Linux archives in this acceptance are built on Debian 12 (glibc 2.36). Alpine/musl
is not a supported target for this engine bundle. The separate official Typst CLI
may use musl; that does not change the bundled engine's ABI.

## Build and assemble

The repository pins Rust 1.99.1 in `rust-toolchain.toml` and Typst Rust libraries in
`Cargo.lock`. On each native host:

```sh
pnpm install --frozen-lockfile
pnpm build:native
```

For cross-compilation from Linux ARM64 to Linux x64, install the matching Rust
standard library and GNU cross linker, then run:

```sh
rustup target add x86_64-unknown-linux-gnu
CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-gnu-gcc \
CC_x86_64_unknown_linux_gnu=x86_64-linux-gnu-gcc \
CXX_x86_64_unknown_linux_gnu=x86_64-linux-gnu-g++ \
pnpm build:native linux-x64
```

Copy each prepared `packages/glyphweave/native/<platform>/` directory, including
its `build.json`, into the assembly checkout. Then:

```sh
GLYPHWEAVE_NATIVE_PLATFORMS=darwin-arm64,linux-arm64,linux-x64 pnpm pack:packages
GLYPHWEAVE_NATIVE_PLATFORMS=darwin-arm64,linux-arm64,linux-x64 pnpm test:package
```

Omitting the environment variable packs only the current host platform. A missing
engine, incorrect ELF/Mach-O architecture, stale source receipt, mismatched binary
digest, duplicate or unsupported target fails packaging. Assembly only includes
the explicitly selected targets; stale native directories are not swept in.
`native/manifest.json` records target triples, binary SHA-256/size, native source
digest and Rust compiler version. Source identity covers Cargo manifest, lockfile
and the complete Rust source tree. It is provenance, not a promise of bit-identical
builds across different linker/SDK versions.

## Runtime behavior

Default engine resolution selects the actual bundled executable for the current
OS/CPU. It does not resolve the package's JavaScript launcher from PATH; cache
identity therefore hashes native compiler bytes. An explicitly configured custom
path or differently named PATH command remains supported. Missing default bundles
fail with the OS/CPU in the error, without trying to build Rust or download code.

The public `glyphweave-typst-html` executable is a small Node launcher. On the
supported Unix platforms it uses `process.execve` to replace itself with the native
compiler, preserving PID and signal handling. See the [Node process API](https://nodejs.org/api/process.html#processexecvefile-args-env).

Package `os` and `cpu` arrays are only coarse install filters: exact availability is
the pair listed in the native manifest. For example, a three-target bundle does
not support macOS x64 simply because it includes both `darwin` and `x64` separately.

## Acceptance gates

`pnpm check` covers contracts and distribution validation. `pnpm test:package`
installs real tarballs outside the workspace, checks native digests, invokes the
installed native launcher, builds HTML/PDF through all three math strategies and
checks warm/forced caching. `pnpm test:integration` covers source changes, assets,
cross references and rollback; `pnpm test:native` verifies real geometry and
accessible math through Chromium, Firefox and WebKit.

When validating an already assembled target (including a cross-compiled engine),
run `pnpm test:native --prebuilt`. This skips Cargo compilation only: JavaScript
builds, real native rendering, geometry and all three browser checks still run.
See [the local Linux acceptance record](linux-validation.md) for measured scope
and the distinction between native ARM64 and emulated x64 execution.

Manual CI runs native Linux ARM64 and x64 workers separately. A local x64 test
under emulation is additional evidence and must be labeled as emulated; it does
not establish native x64 timing. Tarballs and local commits are not npm releases.
