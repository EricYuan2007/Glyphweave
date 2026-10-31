import { exportGlyphweaveAssets, openGlyphweaveSnapshot } from 'glyphweave/artifacts'
await exportGlyphweaveAssets(await openGlyphweaveSnapshot(process.cwd()), 'public/glyphweave/posts')
