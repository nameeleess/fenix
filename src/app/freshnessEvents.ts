export type FreshnessMutationSource =
  | 'today'
  | 'training'
  | 'nutrition'
  | 'progress'

export interface CommittedMutationEvent {
  source: FreshnessMutationSource
  revision: number
  committedAt: number
}

export interface FreshnessEventBus {
  publish: (source: FreshnessMutationSource) => CommittedMutationEvent
  subscribe: (listener: (event: CommittedMutationEvent) => void) => () => void
  getRevision: () => number
}

export function createFreshnessEventBus(): FreshnessEventBus {
  let revision = 0
  const listeners = new Set<(event: CommittedMutationEvent) => void>()

  return {
    publish(source) {
      revision += 1

      const event: CommittedMutationEvent = {
        source,
        revision,
        committedAt: Date.now(),
      }

      for (const listener of listeners) {
        try {
          listener(event)
        } catch (error) {
          console.error('Error publicando frescura post-commit:', error)
        }
      }

      return event
    },

    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },

    getRevision() {
      return revision
    },
  }
}

const committedMutationBus = createFreshnessEventBus()

export function publishCommittedMutation(source: FreshnessMutationSource) {
  return committedMutationBus.publish(source)
}

export function subscribeToCommittedMutations(
  listener: (event: CommittedMutationEvent) => void,
) {
  return committedMutationBus.subscribe(listener)
}

export function getCommittedMutationRevision() {
  return committedMutationBus.getRevision()
}
