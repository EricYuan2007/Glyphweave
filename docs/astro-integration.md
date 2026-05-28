# Astro Integration

Run Glyphweave before Astro:

```bash
pnpm glyphweave build
pnpm astro build
```

The example site reads `.glyphweave/content-index.json`, then loads each post's `content.html` and `toc.json` during static generation. The post page injects the sanitized fragment inside:

```astro
<article class="glyphweave-content" data-pagefind-body>
  <Fragment set:html={post.contentHtml} />
</article>
```

Generated image and PDF assets use `/glyphweave/posts/<slug>/...` public paths. The example copies those files into `public/glyphweave` before `astro build`.

## Example Site

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
