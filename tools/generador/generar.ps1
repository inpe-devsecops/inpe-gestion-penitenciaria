param(
    [string]$Salida = (Join-Path $PSScriptRoot "salida"),
    [int]$Semilla = 20260131
)
# Compila y ejecuta el generador de datos simulados de inpe-devsecops (calibrado con INPE, enero 2026).
$src = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "Generador.cs"), [Text.Encoding]::UTF8)
Add-Type -TypeDefinition $src -Language CSharp -ReferencedAssemblies System.Core
$Salida = [IO.Path]::GetFullPath($Salida)
[Generador]::Run($Salida, $Semilla)
"Archivos generados en: $Salida"
