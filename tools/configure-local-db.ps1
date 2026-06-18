$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$createdb = "C:\Program Files\PostgreSQL\17\bin\createdb.exe"

if (-not (Test-Path -LiteralPath $psql)) {
    throw "PostgreSQL 17 nao foi encontrado em $psql"
}

Write-Host "Dice Invoker - configuracao local do PostgreSQL" -ForegroundColor Cyan
Write-Host "Digite a senha que voce escolheu no instalador. Ela nao sera exibida."
$securePassword = Read-Host "Senha do usuario postgres" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $env:PGPASSWORD = $plainPassword
    $env:PGSSLMODE = "disable"

    & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -tAc "SELECT 1" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "A senha nao foi aceita pelo PostgreSQL. Execute novamente e confira a senha."
    }

    $databaseExists = & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'dice_invoker'"
    if ($databaseExists -ne "1") {
        & $createdb -h 127.0.0.1 -p 5432 -U postgres dice_invoker
        if ($LASTEXITCODE -ne 0) {
            throw "Nao foi possivel criar o banco dice_invoker."
        }
    }

    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $databaseUrl = "DATABASE_URL=postgresql://postgres:$encodedPassword@127.0.0.1:5432/dice_invoker?sslmode=disable"
    [IO.File]::WriteAllText((Join-Path $projectRoot ".env.local"), $databaseUrl + [Environment]::NewLine)

    Write-Host "`nConfiguracao concluida. O banco dice_invoker esta pronto." -ForegroundColor Green
}
finally {
    $env:PGPASSWORD = $null
    $env:PGSSLMODE = $null
    $plainPassword = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

Read-Host "Pressione Enter para fechar"
