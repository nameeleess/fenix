import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'

// Own the server in the runner process so Windows teardown does not depend on
// shell taskkill permissions or leave an npm/Vite descendant running.
export default async function previewSetup() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const server = await preview({
    root,
    configLoader: 'runner',
    preview: { host: '127.0.0.1', port: 41731, strictPort: true },
  })
  return async () => {
    server.httpServer.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve())
    })
  }
}
