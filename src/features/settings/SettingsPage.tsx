import { useRef, useState } from 'react'
import { exportFenixBackup, readAndValidateBackupFile, restoreFenixBackup, type FenixBackup } from '../../services/backupService'
import './settings.css'

export default function SettingsPage({ onClose }: { onClose: () => void }) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [backup, setBackup] = useState<FenixBackup | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  async function run(action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    try { await action() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.') }
    finally { lock.current = false; setBusy(false) }
  }

  return <main className="fenix-settings">
    <header><h1>Settings</h1><button type="button" disabled={busy} onClick={onClose}>Volver a Home</button></header>
    <section>
      <h2>Datos y backup</h2>
      <p>Tus datos se guardan en este dispositivo. La copia incluye todas las tablas y el historial, también los módulos retirados de la navegación.</p>
      <button type="button" disabled={busy} onClick={() => void run(async () => {
        const result = await exportFenixBackup()
        setMessage('Copia exportada: ' + result.totalRecords + ' registros.')
      })}>Exportar backup</button>
      <label>Seleccionar backup JSON
        <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void run(async () => {
            setBackup(null); setConfirmed(false)
            const result = await readAndValidateBackupFile(file)
            if (!result.backup) throw new Error(result.validation.errors.join(' · '))
            setBackup(result.backup)
            setMessage('Backup validado: ' + result.backup.totalRecords + ' registros.')
          })
        }} />
      </label>
      {backup && <div>
        <p>Restaurar sustituye los datos locales por esta copia. Exporta primero una copia del estado actual.</p>
        <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Confirmo que quiero restaurar esta copia.</label>
        <button type="button" disabled={busy || !confirmed} onClick={() => void run(async () => {
          await restoreFenixBackup(backup)
          window.location.reload()
        })}>Restaurar backup validado</button>
      </div>}
      <p role="status">{message}</p>
    </section>
    <section><h2>Uso offline</h2><p>Home y Training utilizan el almacenamiento local. Abre la aplicación con conexión después de una actualización para preparar su caché offline.</p></section>
  </main>
}
