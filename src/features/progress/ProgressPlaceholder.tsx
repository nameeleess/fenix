import {
  useState,
} from 'react'

import {
  exportFenixBackup,
} from '../../services/backupService'

import './progress-placeholder.css'

type BackupState =
  | 'idle'
  | 'exporting'
  | 'success'
  | 'error'

function ProgressPlaceholder() {
  const [
    backupState,
    setBackupState,
  ] =
    useState<BackupState>(
      'idle',
    )

  const [
    backupMessage,
    setBackupMessage,
  ] =
    useState(
      '',
    )

  async function handleBackup() {
    setBackupState(
      'exporting',
    )

    setBackupMessage(
      '',
    )

    try {
      const result =
        await exportFenixBackup()

      setBackupState(
        'success',
      )

      setBackupMessage(
        `${result.totalRecords} registros incluidos · ${result.fileName}`,
      )
    } catch (
      error: unknown
    ) {
      /*
       * Cancelar el panel de compartir
       * de iOS no implica que los datos
       * hayan sufrido ningún problema.
       */
      if (
        error instanceof
          DOMException &&
        error.name ===
          'AbortError'
      ) {
        setBackupState(
          'idle',
        )

        setBackupMessage(
          'Exportación cancelada.',
        )

        return
      }

      console.error(
        'Error exportando copia FÉNIX:',
        error,
      )

      setBackupState(
        'error',
      )

      setBackupMessage(
        'No se ha podido generar la copia. Tus datos existentes no han sido modificados.',
      )
    }
  }

  return (
    <main className="progress-placeholder-page">
      <div className="progress-placeholder-page__inner">
        <header className="progress-placeholder-header">
          <span className="progress-placeholder-header__icon">
            ♨
          </span>

          <div>
            <span className="progress-placeholder-header__brand">
              FÉNIX
            </span>

            <h1>
              Progreso
            </h1>
          </div>
        </header>

        <section className="progress-placeholder-card">
          <span className="progress-placeholder-card__eyebrow">
            PRÓXIMAMENTE
          </span>

          <h2>
            Progreso vNext
          </h2>

          <p>
            El módulo está preparado
            para su nueva
            implementación. No se
            mostrarán métricas
            inventadas mientras no
            existan datos suficientes.
          </p>
        </section>

        <section className="progress-backup-card">
          <div>
            <span className="progress-backup-card__eyebrow">
              SEGURIDAD DE DATOS
            </span>

            <h2>
              Copia local completa
            </h2>

            <p>
              Exporta todas las
              tablas actuales de
              FÉNIX antes de la
              próxima migración de
              datos.
            </p>
          </div>

          <button
            type="button"
            className="progress-backup-button"
            disabled={
              backupState ===
              'exporting'
            }
            onClick={() => {
              void handleBackup()
            }}
          >
            {backupState ===
            'exporting'
              ? 'Preparando copia…'
              : 'Exportar copia'}
          </button>

          {backupMessage ? (
            <p
              className={
                backupState ===
                'error'
                  ? 'progress-backup-message progress-backup-message--error'
                  : 'progress-backup-message'
              }
            >
              {backupMessage}
            </p>
          ) : null}
        </section>

        <p className="progress-placeholder-note">
          Esta herramienta no elimina,
          modifica ni sincroniza datos.
          Solo genera una copia de lo que
          ya existe en este dispositivo.
        </p>
      </div>
    </main>
  )
}

export default ProgressPlaceholder