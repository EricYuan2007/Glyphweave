import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const generatedPosts = path.join(root, '.glyphweave/generated/posts')
const publicPosts = path.join(root, 'public/glyphweave/posts')

await rm(publicPosts, { recursive: true, force: true })
await mkdir(publicPosts, { recursive: true })

for (const slug of await readdir(generatedPosts)) {
  const sourceDir = path.join(generatedPosts, slug)
  const targetDir = path.join(publicPosts, slug)
  await mkdir(targetDir, { recursive: true })
  await cp(path.join(sourceDir, 'assets'), path.join(targetDir, 'assets'), {
    recursive: true,
    force: true,
  }).catch(() => {})
  await cp(path.join(sourceDir, 'article.pdf'), path.join(targetDir, 'article.pdf'), {
    force: true,
  }).catch(() => {})
}
