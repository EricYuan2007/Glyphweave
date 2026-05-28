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
