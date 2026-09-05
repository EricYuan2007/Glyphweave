import { preview } from 'astro'

// Playwright owns this foreground process; the CLI may daemonize in agent environments.
const server = await preview({ server: { host: '127.0.0.1', port: 4321 } })
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await server.stop()
    process.exit(0)
  })
}
