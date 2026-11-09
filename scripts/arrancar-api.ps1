# Arranca la API de forma persistente en Windows (RNF-17 y RNF-18).
#
# Registra una tarea del Programador de Windows que inicia la API al iniciar sesión y la reinicia si
# falla: equivale a un servicio sin necesitar permisos de administrador. MongoDB ya corre como servicio.
#
# Requisitos: backend/.env configurado (ver backend/.env.example) y la base cargada (npm run seed).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\arrancar-api.ps1           # compila, registra y arranca
#   powershell -ExecutionPolicy Bypass -File scripts\arrancar-api.ps1 -Quitar   # detiene y elimina la tarea

param([switch]$Quitar)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz 'backend'
$lanzador = Join-Path $PSScriptRoot 'ejecutar-api.ps1'
$nombreTarea = 'inpe-devsecops-API'
$puerto = 3000

if ($Quitar) {
    if (Get-ScheduledTask -TaskName $nombreTarea -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $nombreTarea -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $nombreTarea -Confirm:$false
        Write-Output "Tarea '$nombreTarea' eliminada."
    } else {
        Write-Output "La tarea '$nombreTarea' no existe."
    }
    exit 0
}

function Test-Api {
    try {
        return (Invoke-WebRequest -Uri "http://127.0.0.1:$puerto/health" -TimeoutSec 4 -UseBasicParsing).StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-Path (Join-Path $backend '.env'))) { throw 'Falta backend\.env (copie backend\.env.example y complete las claves).' }

# La tarea ejecuta la versión compilada: se compila antes de registrarla
Push-Location $backend
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'La compilación del backend falló.' }
} finally {
    Pop-Location
}

$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$lanzador`"" -WorkingDirectory $backend
$disparador = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$configuracion = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $nombreTarea -Action $accion -Trigger $disparador -Settings $configuracion -Principal $principal `
    -Description 'API REST de inpe-devsecops (gestión y análisis de la población penitenciaria).' -Force | Out-Null

if (Test-Api) {
    Write-Output "Tarea '$nombreTarea' registrada. Ya había una API respondiendo en el puerto ${puerto}: la tarea la iniciará en el próximo inicio de sesión."
    exit 0
}

Start-ScheduledTask -TaskName $nombreTarea
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 800
    if (Test-Api) {
        Write-Output "API operativa en http://127.0.0.1:$puerto (tarea programada '$nombreTarea')."
        Write-Output 'Para quitarla: powershell -ExecutionPolicy Bypass -File scripts\arrancar-api.ps1 -Quitar'
        exit 0
    }
}
$info = Get-ScheduledTaskInfo -TaskName $nombreTarea -ErrorAction SilentlyContinue
Write-Error "La API no respondió tras 24 segundos. Último resultado de la tarea: $($info.LastTaskResult). Revise backend\logs\api.log"
exit 1
