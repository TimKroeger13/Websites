# Erzeugt files/files.json aus allen Dateien im Ordner "files".
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\make-manifest.ps1
#
# Optional: Beschreibungen/Versionen bleiben erhalten, wenn sie in einer
# bereits vorhandenen files.json stehen (gleicher Dateiname).

$ErrorActionPreference = 'Stop'
$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesDir = Join-Path $root 'files'
$manifest = Join-Path $filesDir 'files.json'

if (-not (Test-Path $filesDir)) { New-Item -ItemType Directory -Path $filesDir | Out-Null }

# Bestehende Beschreibungen einlesen
$old = @{}
if (Test-Path $manifest) {
    try {
        foreach ($e in (Get-Content $manifest -Raw -Encoding UTF8 | ConvertFrom-Json)) {
            if ($e.name) { $old[$e.name] = $e }
        }
    } catch { Write-Warning "Alte files.json konnte nicht gelesen werden - wird neu erstellt." }
}

$skip = @('files.json', '.gitkeep', 'index.html')

$entries = Get-ChildItem -Path $filesDir -File -Force |
    Where-Object { $skip -notcontains $_.Name } |
    Sort-Object Name |
    ForEach-Object {
        $e = [ordered]@{
            name     = $_.Name
            size     = $_.Length
            modified = $_.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss')
        }
        if ($old.ContainsKey($_.Name)) {
            if ($old[$_.Name].description) { $e.description = $old[$_.Name].description }
            if ($old[$_.Name].version)     { $e.version     = $old[$_.Name].version }
        }
        [pscustomobject]$e
    }

$json = if ($entries) { ConvertTo-Json @($entries) -Depth 4 } else { '[]' }
[System.IO.File]::WriteAllText($manifest, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("files.json geschrieben: {0} Datei(en)" -f @($entries).Count) -ForegroundColor Green
