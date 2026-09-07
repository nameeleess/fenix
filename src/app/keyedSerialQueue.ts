export interface KeyedSerialQueue {
  run: <T>(key: string, task: () => Promise<T>) => Promise<T>
  pendingKeys: () => number
}

export function createKeyedSerialQueue(): KeyedSerialQueue {
  const tails = new Map<string, Promise<void>>()

  return {
    async run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve()

      let release: () => void = () => undefined
      const current = new Promise<void>((resolve) => {
        release = resolve
      })
      const tail = previous
        .catch(() => undefined)
        .then(() => current)

      tails.set(key, tail)

      await previous.catch(() => undefined)

      try {
        return await task()
      } finally {
        release()

        if (tails.get(key) === tail) {
          tails.delete(key)
        }
      }
    },

    pendingKeys() {
      return tails.size
    },
  }
}
