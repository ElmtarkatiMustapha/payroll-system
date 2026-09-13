$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $workspacePath
$envPath = Join-Path $workspacePath '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath (Join-Path $workspacePath '.env.example') -Destination $envPath
}
$envText = [IO.File]::ReadAllText($envPath)
function New-PayrollSecret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
foreach ($keyName in @('APP_KEY', 'DB_PASSWORD', 'MYSQL_ROOT_PASSWORD')) {
    if ($envText -notmatch "(?m)^$keyName=\S+") {
        $value = New-PayrollSecret
        if ($keyName -eq 'APP_KEY') { $value = 'base64:' + $value }
        if ($envText -match "(?m)^$keyName=.*$") {
            $envText = [regex]::Replace($envText, "(?m)^$keyName=.*$", "$keyName=$value")
        } else { $envText += [Environment]::NewLine + "$keyName=$value" }
    }
}
[IO.File]::WriteAllText($envPath, $envText, (New-Object Text.UTF8Encoding($false)))
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Docker startup failed.' }
Write-Output 'Payroll is ready at http://localhost:8080. Create your administrator account on first visit.'
