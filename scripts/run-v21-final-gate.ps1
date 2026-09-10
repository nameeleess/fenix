param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ExpectedBackupSha = '3686d872e64d83f7fea7053fab9f2e32508bd525c50180431a5b437bad8e8732'
$ExpectedProduction = 'deac3890f4d1b794cae8f3acde5a12bf7c35cf94'
$ExpectedVersion = '2.1.0-rc.1.2'
$EvidenceRoot = Join-Path (Get-Location) 'qa\v2.1\evidence'
$ScreenshotDir = Join-Path $EvidenceRoot 'screenshots'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogPath = Join-Path $EvidenceRoot "FINAL_GATE_$Timestamp.txt"
$ZipPath = Join-Path (Get-Location) "FENIX_v2.1.0-rc.1.2_ENGINEERING_EVIDENCE_$Timestamp.zip"
$SourceZipPath = Join-Path (Get-Location) 'FENIX_v2.1.0-rc.1.2_SOURCE_BUNDLE.zip'

$GoldenNames = @(
  '01_HOY_Principal.png','02_HOY_Dia_0.png','03_TRAINING_Hoy.png','04_TRAINING_Rutinas.png',
  '05_TRAINING_Ejercicios.png','06_TRAINING_Historial.png','07_TRAINING_Sesion_en_curso.png','08_TRAINING_Detalle_rutina.png',
  '09_TRAINING_Detalle_ejercicio.png','10_TRAINING_Crear_Editar_rutina.png','11_TRAINING_Crear_Editar_ejercicio.png',
  '12_NUTRITION_Hoy.png','13_NUTRITION_Semana.png','14_NUTRITION_Recetas.png','15_NUTRITION_Compra.png',
  '16_NUTRITION_Detalle_receta.png','17_NUTRITION_Detalle_comida.png','18_NUTRITION_Crear_Editar_receta.png',
  '19_PROGRESO_Resumen.png','20_PROGRESO_Peso.png','21_PROGRESO_Rendimiento.png','22_PROGRESO_Adherencia.png',
  '23_PROGRESO_Cuerpo_Medidas.png','24_AJUSTES_Principal.png','25_AJUSTES_Rutina_diaria.png','26_AJUSTES_Datos_Backup_Restore.png'
)

function Run-Step {
  param([string]$Name, [scriptblock]$Command)
  Write-Host ''
  Write-Host ('=' * 62) -ForegroundColor Cyan
  Write-Host "EJECUTANDO: $Name" -ForegroundColor Cyan
  Write-Host ('=' * 62) -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "FALLO EN: $Name | Exit code: $LASTEXITCODE" }
  Write-Host "PASS: $Name" -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path $EvidenceRoot | Out-Null
if (Test-Path $ScreenshotDir) { Remove-Item -Recurse -Force $ScreenshotDir }
if (Test-Path (Join-Path $EvidenceRoot 'playwright-artifacts')) { Remove-Item -Recurse -Force (Join-Path $EvidenceRoot 'playwright-artifacts') }
if (Test-Path (Join-Path $EvidenceRoot 'playwright-results.json')) { Remove-Item -Force (Join-Path $EvidenceRoot 'playwright-results.json') }

Start-Transcript -Path $LogPath -Force
try {
  Write-Host 'FÉNIX v2.1.0-rc.1 — FINAL ENGINEERING / PRE-QA ADVERSARIAL GATE' -ForegroundColor Yellow

  $branch = (git branch --show-current).Trim()
  if ($branch -ne 'main') { throw "La implementación debe validarse en main. Rama actual: $branch" }
  Write-Host 'BRANCH main: PASS' -ForegroundColor Green

  $productionRef = $null
  foreach ($ref in @('refs/heads/production','refs/remotes/origin/production')) {
    git show-ref --verify --quiet $ref
    if ($LASTEXITCODE -eq 0) {
      $productionRef = (git rev-parse $ref).Trim()
      break
    }
  }
  if ($productionRef) {
    if ($productionRef -ne $ExpectedProduction) { throw "production cambió. Esperado $ExpectedProduction / obtenido $productionRef" }
    Write-Host "PRODUCTION UNTOUCHED: PASS ($productionRef)" -ForegroundColor Green
  } else {
    Write-Host 'PRODUCTION REF: no presente localmente; se registra como NO VERIFICABLE en este clon, no se toca.' -ForegroundColor Yellow
  }

  $packageVersion = (node -p "require('./package.json').version").Trim()
  if ($packageVersion -ne $ExpectedVersion) { throw "package version incorrecta: $packageVersion" }
  Write-Host "VERSION ${ExpectedVersion}: PASS" -ForegroundColor Green

  if (!(Test-Path $BackupPath)) { throw "No encuentro backup oficial: $BackupPath" }
  $backupSha = (Get-FileHash $BackupPath -Algorithm SHA256).Hash.ToLower()
  if ($backupSha -ne $ExpectedBackupSha) { throw "SHA backup incorrecto: $backupSha" }
  Write-Host 'BACKUP OFICIAL SHA-256: PASS' -ForegroundColor Green

  Run-Step 'npm ci limpio' { npm ci --no-audit --no-fund }
  Run-Step 'RepDB selected-media sync' { npm run media:sync }

  $mediaManifest = Join-Path (Get-Location) 'public\media\exercises\repdb\2026.8.1\FENIX_MEDIA_BUILD.json'
  if (!(Test-Path $mediaManifest)) { throw 'No se generó FENIX_MEDIA_BUILD.json' }
  $media = Get-Content $mediaManifest -Raw | ConvertFrom-Json
  if ($media.mappings -ne 26 -or $media.files -ne 49) { throw "Media Freeze build incorrecto: mappings=$($media.mappings), files=$($media.files)" }
  Copy-Item $mediaManifest (Join-Path $EvidenceRoot 'FENIX_MEDIA_BUILD.json') -Force
  Write-Host 'MEDIA FREEZE BUILD: PASS (26 RepDB mappings / 49 local WebP)' -ForegroundColor Green

  Run-Step 'npm run build (TypeScript + Vite + PWA generateSW)' { npm run build }
  if (!(Test-Path 'dist\sw.js')) { throw 'PWA: dist/sw.js ausente' }
  if (!(Test-Path 'dist\manifest.webmanifest')) { throw 'PWA: manifest.webmanifest ausente' }
  Write-Host 'PWA OUTPUT: PASS' -ForegroundColor Green

  Run-Step 'npm run lint' { npm run lint }
  Run-Step 'release source contract' { npm run test:release-source }
  Run-Step 'v2.1 domain/pre-QA suites' { npm run test:v21 }

  $env:FENIX_BACKUP_PATH = (Resolve-Path $BackupPath).Path
  Run-Step 'CORE regression + official 759 roundtrip' { npm run test:core }

  Run-Step 'Playwright Chromium install/check' { npx playwright install chromium }
  Run-Step 'Playwright E2E' { npm run test:e2e }
  Run-Step 'Playwright 26-state visual capture' { npm run test:visual }

  if (!(Test-Path $ScreenshotDir)) { throw 'Visual gate no creó carpeta screenshots.' }
  $actualScreens = @(Get-ChildItem $ScreenshotDir -File -Filter '*.png' | Select-Object -ExpandProperty Name | Sort-Object)
  $expectedScreens = @($GoldenNames | Sort-Object)
  if (($actualScreens -join '|') -ne ($expectedScreens -join '|')) {
    $missing = @($expectedScreens | Where-Object { $_ -notin $actualScreens })
    $extra = @($actualScreens | Where-Object { $_ -notin $expectedScreens })
    throw "Visual evidence incompleta. Missing=$($missing -join ',') Extra=$($extra -join ',')"
  }
  Write-Host 'VISUAL SCREENSHOTS: PASS (26/26 viewport captures)' -ForegroundColor Green

  Run-Step 'git diff --check' { git diff --check }

  node --version | Set-Content (Join-Path $EvidenceRoot 'node-version.txt')
  npm --version | Set-Content (Join-Path $EvidenceRoot 'npm-version.txt')
  git status --short | Set-Content (Join-Path $EvidenceRoot 'git-status.txt')
  $trackedDelta = @(git diff --name-status)
  $untrackedDelta = @(git ls-files --others --exclude-standard | Where-Object { $_ -notlike 'qa/v2.1/evidence/*' -and $_ -notlike 'FENIX_v2.1.0-rc.1_*' } | ForEach-Object { "A`t$_" })
  @($trackedDelta + $untrackedDelta) | Set-Content (Join-Path $EvidenceRoot 'changed-files.txt')
  Get-ChildItem dist -Recurse -File | ForEach-Object { $_.FullName.Replace((Resolve-Path '.').Path + '\','') } | Set-Content (Join-Path $EvidenceRoot 'dist-files.txt')
  "backup_sha256=$backupSha" | Set-Content (Join-Path $EvidenceRoot 'baseline-backup.txt')
  $productionEvidence = if ($productionRef) { $productionRef } else { 'not-present-in-local-clone' }
  "production_ref=$productionEvidence" | Add-Content (Join-Path $EvidenceRoot 'baseline-backup.txt')
  "local_head=$(git rev-parse HEAD)" | Add-Content (Join-Path $EvidenceRoot 'baseline-backup.txt')

  @"
# E2E EVIDENCE — FÉNIX v2.1.0-rc.1

- Final engineering/pre-QA automated gate: PASS
- Build / TypeScript / Vite / PWA: PASS
- Lint: PASS
- v2.1 domain/pre-QA suites: PASS
- CORE regression + official 759 roundtrip: PASS
- Playwright E2E: PASS
- Offline reload: PASS
- Visual capture: 26/26 viewport screenshots
- Media Freeze build: 26 RepDB mappings / 49 selected local WebP + 7 FÉNIX originals
- Database: fenix-db
- Schema: 5
- Migrations: NONE
- Production: not modified by this gate; when the ref is locally available it must equal deac3890f4d1b794cae8f3acde5a12bf7c35cf94

The 26 screenshots require Engineering visual parity review against the Golden Freeze before the CENTRAL handoff is declared final.
"@ | Set-Content (Join-Path $EvidenceRoot 'E2E_EVIDENCE_v2.1.0-rc.1.md') -Encoding UTF8

  Write-Host ''
  Write-Host ('#' * 62) -ForegroundColor Green
  Write-Host 'FÉNIX v2.1.0-rc.1' -ForegroundColor Green
  Write-Host 'FINAL ENGINEERING / PRE-QA ADVERSARIAL GATE: PASS' -ForegroundColor Green
  Write-Host '26/26 VISUAL CAPTURES: PASS (manual parity review still required before CENTRAL handoff)' -ForegroundColor Green
  Write-Host ('#' * 62) -ForegroundColor Green
}
catch {
  Write-Host ''
  Write-Host ('#' * 62) -ForegroundColor Red
  Write-Host 'FÉNIX v2.1.0-rc.1' -ForegroundColor Red
  Write-Host 'FINAL ENGINEERING / PRE-QA ADVERSARIAL GATE: FAIL' -ForegroundColor Red
  Write-Host ('#' * 62) -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host 'NO hagas commit. NO toques production.' -ForegroundColor Yellow
  throw
}
finally {
  Remove-Item Env:FENIX_BACKUP_PATH -ErrorAction SilentlyContinue
  Stop-Transcript
}

if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path @(
  $EvidenceRoot,
  'qa\v2.1\MUTATION_MAP_v2.1.md',
  'qa\v2.1\INVARIANT_REGISTRY_v2.1.md',
  'qa\v2.1\CONCURRENCY_MATRIX_v2.1.md',
  'qa\v2.1\FAULT_NEGATIVE_MATRIX_v2.1.md',
  'qa\v2.1\VISUAL_PARITY_MATRIX_v2.1.md',
  'qa\v2.1\MEDIA_REGISTRY_v2.1.md',
  'qa\v2.1\LICENSE_ATTRIBUTION_REGISTRY_v2.1.md',
  'qa\v2.1\BASELINE_EQUIVALENCE_v2.1.md',
  'docs\CHANGELOG.md'
) -DestinationPath $ZipPath -Force

$zipSha = (Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToLower()
Write-Host ''
Write-Host "EVIDENCE ZIP: $ZipPath" -ForegroundColor Cyan
Write-Host "EVIDENCE SHA-256: $zipSha" -ForegroundColor Cyan

$sourceStage = Join-Path $env:TEMP "fenix-v21-source-$Timestamp"
if (Test-Path $sourceStage) { Remove-Item -Recurse -Force $sourceStage }
New-Item -ItemType Directory -Force -Path $sourceStage | Out-Null

$sourceFiles = @(
  git ls-files
  git ls-files --others --exclude-standard
) | Sort-Object -Unique | Where-Object {
  $_ -and
  (Test-Path $_) -and
  ($_ -notlike 'qa/v2.1/evidence/*') -and
  ($_ -notlike 'FENIX_v2.1.0-rc.1_ENGINEERING_EVIDENCE_*.zip') -and
  ($_ -ne 'FENIX_v2.1.0-rc.1_SOURCE_BUNDLE.zip')
}

foreach ($relative in $sourceFiles) {
  $normalized = $relative -replace '/', [IO.Path]::DirectorySeparatorChar
  $destination = Join-Path $sourceStage $normalized
  $parent = Split-Path -Parent $destination
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  Copy-Item -LiteralPath $relative -Destination $destination -Force
}

if (Test-Path $SourceZipPath) { Remove-Item -Force $SourceZipPath }
Compress-Archive -Path (Join-Path $sourceStage '*') -DestinationPath $SourceZipPath -Force
Remove-Item -Recurse -Force $sourceStage

$sourceSha = (Get-FileHash $SourceZipPath -Algorithm SHA256).Hash.ToLower()
$sourceCount = $sourceFiles.Count

Write-Host "SOURCE BUNDLE: $SourceZipPath" -ForegroundColor Cyan
Write-Host "SOURCE FILES: $sourceCount" -ForegroundColor Cyan
Write-Host "SOURCE SHA-256: $sourceSha" -ForegroundColor Cyan
