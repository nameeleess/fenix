import { useEffect, useState } from 'react'
import { initializeDatabase } from './db/database'

type DatabaseState = 'checking' | 'ready' | 'error'

function App() {
  const [databaseState, setDatabaseState] =
    useState<DatabaseState>('checking')

  useEffect(() => {
    let active = true

    initializeDatabase()
      .then(() => {
        if (active) {
          setDatabaseState('ready')
        }
      })
      .catch((error: unknown) => {
        console.error('Error inicializando FÉNIX DB:', error)

        if (active) {
          setDatabaseState('error')
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main>
      <h1>FÉNIX</h1>
      <p>Aplicación iniciada correctamente.</p>

      {databaseState === 'checking' && <p>Comprobando base local...</p>}

      {databaseState === 'ready' && <p>Base local: operativa.</p>}

      {databaseState === 'error' && (
        <p>No se ha podido iniciar la base local.</p>
      )}
    </main>
  )
}

export default App