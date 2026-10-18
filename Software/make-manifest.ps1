# Erzeugt files/files.json aus allen Dateien im Ordner "files".
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\make-manifest.ps1
#
# Die Versionsnummer kommt aus dem Dateikopf der EXE selbst - Inno Setup und
# PyInstaller schreiben sie dort hinein. Das ist wichtig, weil der Dateiname
# beim naechsten Release derselbe bleibt: wuerde die Nummer nur aus der alten
# files.json uebernommen, stuende auf der Seite stillschweigend weiter die
# Version von vorletzter Woche.
#
# Beschreibungen bleiben erhalten, wenn sie in einer bereits vorhandenen
# files.json stehen (gleicher Dateiname) - ebenso Versionen von Dateien ohne
# Dateikopf, etwa ZIP-Archiven.

$ErrorActionPreference = 'Stop'
$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesDir = Join-Path $root 'files'
$manifest = Join-Path $filesDir 'files.json'

if (-not (Test-Path $filesDir)) { New-Item -ItemType Directory -Path $filesDir | Out-Null }

function Get-DateiVersion($datei) {
    # Inno Setup und PyInstaller schreiben die Version in den Dateikopf.
    # ProductVersion zuerst: dort steht "1.2.0", waehrend FileVersion haeufig
    # auf vier Stellen aufgefuellt wird ("1.2.0.0").
    $info = $datei.VersionInfo
    foreach ($kandidat in @($info.ProductVersion, $info.FileVersion)) {
        if (-not $kandidat) { continue }
        $wert = $kandidat.Trim()
        # Dateien ohne Versionsangabe melden je nach Typ Nullen statt nichts.
        if (-not $wert -or $wert -match '^0(\.0)*$') { continue }
        # Nur die vierte Stelle abschneiden ("1.2.0.0" -> "1.2.0"), niemals
        # aus "1.2.0" ein "1.2" machen.
        if (($wert -split '\.').Count -eq 4 -and $wert.EndsWith('.0')) {
            $wert = $wert -replace '\.0$', ''
        }
        return $wert
    }
    return $null
}

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
        $version = Get-DateiVersion $_
        if (-not $version -and $old.ContainsKey($_.Name)) {
            # Kein Dateikopf (ZIP, PDF, ...) - dann gilt, was von Hand eingetragen wurde.
            $version = $old[$_.Name].version
        }
        if ($version) { $e.version = $version }
        if ($old.ContainsKey($_.Name) -and $old[$_.Name].description) {
            $e.description = $old[$_.Name].description
        }
        Write-Host ("  {0}{1}" -f $_.Name, $(if ($version) { " - Version $version" } else { "" }))
        [pscustomobject]$e
    }

$json = if ($entries) { ConvertTo-Json @($entries) -Depth 4 } else { '[]' }
[System.IO.File]::WriteAllText($manifest, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("files.json geschrieben: {0} Datei(en)" -f @($entries).Count) -ForegroundColor Green
