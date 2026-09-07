export interface LatestWinsToken {
  revision: number
}

export interface LatestWinsGate {
  begin: () => LatestWinsToken
  isCurrent: (token: LatestWinsToken) => boolean
  getRevision: () => number
}

export function createLatestWinsGate(): LatestWinsGate {
  let revision = 0

  return {
    begin() {
      revision += 1
      return { revision }
    },

    isCurrent(token) {
      return token.revision === revision
    },

    getRevision() {
      return revision
    },
  }
}
