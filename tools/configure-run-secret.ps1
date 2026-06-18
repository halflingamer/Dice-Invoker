$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $projectRoot ".env.local"

if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw ".env.local nao existe. Execute configure-local-db.ps1 primeiro."
}

$current = [IO.File]::ReadAllText($environmentFile)
if ($current -match "(?m)^RUN_SEED_SECRET=") {
    exit 0
}

$bytes = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
$generator.GetBytes($bytes)
$generator.Dispose()
$secret = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
[IO.File]::AppendAllText($environmentFile, "RUN_SEED_SECRET=$secret" + [Environment]::NewLine)
