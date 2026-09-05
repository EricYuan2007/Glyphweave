# Incremental builds

Caching is enabled by default. Run `glyphweave build --no-cache` or set
`cache: { enabled: false }` to force compilation. Text output reports reused and
compiled article counts; `--json` exposes `cache: { enabled, reused, compiled }`.
`built` still contains all published articles, including reused ones.

## Invalidation

An article key includes every file in its directory (source, YAML, includes,
images, bibliography and other data), the effective configuration, resolved source
path, Typst version and executable bytes, generator/package implementation and
prelude bytes, project lockfile, Node/platform, discovered font paths and bytes,
Typst package data/cache trees, and relevant Typst/locale/time environment variables.
Adding/removing a file or changing bytes invalidates the key even if mtime is preserved.
A conservative whole-article inventory may recompile for unused files; keep unrelated
large data outside article directories. Lockfile/toolchain/font changes rebuild all posts.

Every build hashes actual input bytes. Compiler/font digest memoization lasts only
within one build and checks inode, size, mtime and ctime before reuse. This favors
correctness over very fast no-op runs on systems with large font collections.
Custom `BuildDependencies` bypass caching unless they supply a stable `cacheIdentity`
that includes all custom compiler dependencies.

## Commit and recovery

The committed content index references its generation's `cache.json`. A hit requires
matching input key and complete SHA-256 artifact inventory, followed by copying
and verifying artifacts into a new generation and rebasing manifest paths. No hard
links or old-generation routes are published. Missing, malformed or damaged cache
entries fall back to compilation. PDF warning failures are never cached, so a later
build retries them. Deleted/private/unpublished articles disappear from the new index.

Source/config discovery, article bytes and the compiler environment are checked again
before the atomic index replacement. Changes during the build abort it and preserve
the previous index. A first Typst package download can change the package inventory;
rerun once downloads have completed. Do not edit dependencies or fonts during a build.
The cache is local state for trusted authors, not an authenticated shared remote cache.

Old generations remain until `glyphweave clean` to preserve active readers. Run clean
between publishing jobs when no readers/builds are active, then rebuild. Do not publish
`.glyphweave` itself; export only the current manifest-selected static assets.

## Reproducibility and validation

Typst receives `--creation-timestamp` from `SOURCE_DATE_EPOCH`, or the article's
`updated`/`date` at midnight UTC. This also fixes `datetime.today()` and PDF creation
metadata. Use an explicit epoch/date change when time-dependent content should change.
Generation paths and manifest `createdAt` change on each build; HTML, TOC, resources
and PDF bytes are the reproducibility boundary on the same toolchain/environment.

`pnpm test:integration` checks real Typst cached/full HTML, TOC and PDF byte equality
for MathML and SVG, plus include invalidation. `pnpm test:package` checks actual
installed tarballs and reuse across CLI processes. `pnpm benchmark 100` measures cold,
warm, one-article change and forced builds, including environment hashing. Its simple
formula fixture is a reproducible comparison, not a general throughput guarantee.

Supported validation targets are Node 22.18+/24 and Typst 0.15.x on Linux/macOS.
Typst HTML export remains experimental; inspect representative content before releasing.
