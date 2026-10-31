# Astro Integration

Run Glyphweave before Astro:

```bash
pnpm glyphweave build
node scripts/sync-glyphweave-public.mjs
pnpm astro build
```

The example opens a validated artifact snapshot during static generation. The shared reader validates manifests, generation boundaries and index references before exposing HTML and TOCs. `@glyphweave/astro` uses the same reader and retains its previous store if a reload fails. The post page injects the sanitized fragment inside:

```astro
<article class="glyphweave-content" data-pagefind-body>
  <Fragment set:html={post.contentHtml} />
</article>
```

Generated image and PDF assets use `/glyphweave/posts/<slug>/...` public paths. The example copies those files into `public/glyphweave` before `astro build`.

## Example Site

The workspace example keeps `glyphweave` external in Astro's `prerender` environment. Its Node modules read package-relative version, prelude and native-engine files, so bundling the linked package into the site's output would relocate those paths. This setting only affects static generation; browser scripts and public assets are still bundled and exported normally.

The included `examples/astro-blog` site demonstrates:

- A homepage that lists generated Typst posts.
- An archive page.
- Tag pages.
- A static post detail page.
- A PDF download link.
- A sticky table of contents.
- Pagefind indexing through `data-pagefind-body`.

Run it with:

```bash
pnpm --filter example-astro-blog build
pnpm --filter example-astro-blog pagefind
pnpm --filter example-astro-blog exec astro preview --host 127.0.0.1 --port 4321
```

## Asset Publishing

Glyphweave emits public paths using `output.publicBasePath`, but static frameworks still need the files in their public directory. The example handles this with `scripts/sync-glyphweave-public.mjs`, which copies generated assets and PDFs into `public/glyphweave` before `astro build`.

The sync script opens a snapshot and exports its selected resources:

```ts
import { openGlyphweaveSnapshot, exportGlyphweaveAssets } from 'glyphweave/artifacts'
const snapshot = await openGlyphweaveSnapshot(process.cwd())
await exportGlyphweaveAssets(snapshot, 'public/glyphweave/posts')
```

Custom hosts should keep one snapshot for content and asset copying throughout a build. Use `snapshot.readPost(slug)` and `snapshot.copyAssets(selectedSlugs, stagingDirectory)`; the latter preserves the host's preview selection. See [the snapshot contract](architecture.md#reading-a-validated-snapshot).

See [configuration reference](configuration.md) for current output and configuration contracts.

## Host-selected snapshots (0.4)

Use `buildDocuments` with `documentInput` for host-owned publication policies. Each
index entry carries an `id` and opaque `data`. A host loader `transform` validates
that data and constructs its own Astro schema. Pass `indexPath: result.snapshot.indexPath`
for a static build, or a `snapshot` callback returning a validated snapshot when the
host coordinates preview updates. With the callback, the loader does not install its
own index watcher; the host publishes resources first and triggers reload afterward.
