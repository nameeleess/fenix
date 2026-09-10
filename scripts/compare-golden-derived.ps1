param(
  [Parameter(Mandatory = $true)] [string]$GoldenDir,
  [Parameter(Mandatory = $true)] [string]$ActualDir,
  [Parameter(Mandatory = $true)] [string]$OutputDir,
  [string]$Python = 'python',
  [string[]]$States = @()
)
$ErrorActionPreference = 'Stop'
# Compatibility entry point: one implementation, uniform scale, every pixel.
$CompareScript = Join-Path $PSScriptRoot 'compare-golden-derived.py'
$CompareArgs = @($CompareScript, $GoldenDir, $ActualDir, $OutputDir)
if ($States.Count -gt 0) { $CompareArgs += '--states'; $CompareArgs += $States }
& $Python @CompareArgs
if ($LASTEXITCODE -ne 0) { throw "Golden comparator failed: $LASTEXITCODE" }
