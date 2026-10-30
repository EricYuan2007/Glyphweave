/** Coalesce burst updates, never overlap tasks, and retain a final pending run. */
export function createTaskQueue(run: () => Promise<void>, onError: (error: unknown) => void) {
  let running: Promise<void> | undefined
  let pending = false
  let stopped = false
  const drain = async () => {
    try {
      while (pending && !stopped) {
        pending = false
        try {
          await run()
        } catch (error) {
          onError(error)
        }
      }
    } finally {
      running = undefined
    }
  }
  return {
    enqueue(): Promise<void> {
      if (stopped) return Promise.resolve()
      pending = true
      if (!running) running = Promise.resolve().then(drain)
      return running
    },
    async stop(): Promise<void> {
      stopped = true
      pending = false
      await running
    },
  }
}
