import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { discoverPosts } from '@glyphweave/core'
import { defaultConfig } from '@glyphweave/schema'

async function makeTempProject() {
  return mkdtemp(path.join(os.tmpdir(), 'glyphweave-discovery-'))
}

async function writePost(root: string, dir: string, slug: string) {
  const postDir = path.join(root, 'content/typst-posts', dir)
  await mkdir(postDir, { recursive: true })
  await writeFile(path.join(postDir, 'index.typ'), '= Hello\n')
  await writeFile(
    path.join(postDir, 'post.yaml'),
    [
      'title: "Hello"',
      `slug: "${slug}"`,
      'description: "A demo post."',
      'date: "2026-05-28"',
      'status: "published"',
      'visibility: "public"',
    ].join('\n'),
  )
}

describe('post discovery', () => {
  it('finds posts and computes stable hashes', async () => {
    const root = await makeTempProject()
    await writePost(root, 'hello', 'hello')

    const posts = await discoverPosts(root, defaultConfig())

    expect(posts).toHaveLength(1)
    expect(posts[0]?.metadata.slug).toBe('hello')
    expect(posts[0]?.sourceHash).toMatch(/^sha256:/)
    expect(posts[0]?.metadataHash).toMatch(/^sha256:/)
    expect(posts[0]?.sourcePath.endsWith('index.typ')).toBe(true)
  })

  it('rejects duplicate slugs', async () => {
    const root = await makeTempProject()
    await writePost(root, 'hello-a', 'hello')
    await writePost(root, 'hello-b', 'hello')

    await expect(discoverPosts(root, defaultConfig())).rejects.toThrow('Duplicate post slug')
  })
})
