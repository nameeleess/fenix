import { registerSW } from 'virtual:pwa-register'
import { setPwaUpdateHandler, signalPwaUpdateAvailable } from './app/pwaUpdates'

export function registerFenixPwa() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      signalPwaUpdateAvailable()
    },
    onRegisterError(error) {
      console.warn('FÉNIX PWA registration warning:', error)
    },
  })
  setPwaUpdateHandler(updateSW)
}
