# Glyphweave Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Phase 1 Typst-to-web pipeline that emits sanitized HTML, TOC, manifests, content index, optional PDFs, and an Astro example.

**Architecture:** The MVP uses a pnpm monorepo with focused packages for schema, core build orchestration, Typst CLI calls, HTML adaptation, CLI commands, and Astro helpers. The CLI runs TypeScript through `tsx` during local development so the requested `pnpm glyphweave build` path works before package publishing.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Zod, Commander, execa, rehype/unified, Astro, Pagefind, Typst CLI.

---

### Task 1: Workspace Skeleton

**Files:**
- Create: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`
- Create: package manifests under `packages/*`
- Create: README and docs stubs

- [x] Add workspace and tool configuration.
- [ ] Run `pnpm install`.

### Task 2: Schema, Discovery, And Build Tests

**Files:**
- Create: `tests/schema.test.ts`
- Create: `tests/discovery.test.ts`
- Create: `tests/html-adapter.test.ts`
- Create: `tests/build.test.ts`

- [ ] Write tests for metadata defaults, duplicate slugs, TOC generation, sanitization, asset rewriting, and content-index writing.
- [ ] Run `pnpm test` and confirm failures come from missing implementation.

### Task 3: Core Implementation

**Files:**
- Create: `packages/schema/src/index.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/html-adapter/src/index.ts`
- Create: `packages/typst/src/index.ts`

- [ ] Implement schemas and config defaults.
- [ ] Implement post discovery, hash calculation, output path resolution, manifest/index writing, and build orchestration.
- [ ] Implement Typst detection and compile wrappers.
- [ ] Implement HTML adapter with body extraction, heading IDs, TOC, path rewriting, external link normalization, and sanitizer.
- [ ] Run `pnpm test` until green.

### Task 4: CLI And Example Astro Site

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/astro/src/index.ts`
- Create: `examples/astro-blog/*`
- Create: demo Typst posts and templates

- [ ] Implement `build`, `clean`, `inspect`, and `doctor`.
- [ ] Add an Astro content collection that reads `.glyphweave/content-index.json`.
- [ ] Add index, archive, tags, and post detail pages with `data-pagefind-body`.
- [ ] Add Pagefind script.

### Task 5: Verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: docs under `docs/`

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm glyphweave build`.
- [ ] Run `pnpm --filter example-astro-blog build`.
- [ ] Run `pnpm --filter example-astro-blog pagefind`.
