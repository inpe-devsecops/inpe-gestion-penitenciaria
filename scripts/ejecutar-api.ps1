# Lanzador de la API que invoca la tarea programada 'inpe-devsecops-API' (ver arrancar-api.ps1).
# Fija el directorio de trabajo (para que se lea backend\.env) y envía la salida a backend\logs\api.log.
#
# Uso directo, en primer plano, para depurar:
#   powershell -ExecutionPolicy Bypass -File scripts\ejecutar-api.ps1

$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz 'backend'
$logs = Join-Path $backend 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
Set-Location $backend

# La hora de cada arranque permite distinguir una ejecución nueva de una salida antigua en el registro
Add-Content -Path (Join-Path $logs 'api.log') -Value "`n--- arranque $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ---"
& node dist/server.js *>> (Join-Path $logs 'api.log')
