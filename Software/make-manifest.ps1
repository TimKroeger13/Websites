# Erzeugt files/files.json aus allen Dateien im Ordner "files".
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\make-manifest.ps1
#
# Seit der Versionsverwaltung ist eine Datei nicht mehr ein Eintrag, sondern
# eine *Version* eines Programms. Zusammengefasst wird ueber den Dateinamen:
#
#   LolGroupBotAgent-Setup-1.5.0.exe  \
#   LolGroupBotAgent-Setup-1.4.0.exe   >  ein Programm, drei Versionen
#   LolGroupBotAgent-Setup-1.2.0.exe  /
#
# Die Nummer am Ende macht die Version aus, der Rest den Programmschluessel.
# Genau dadurch zaehlt das Serverskript (count-downloads.sh) von selbst je
# Version: es zaehlt Dateinamen, und jede Version ist eine eigene Datei.
#
# Die Versionsnummer kommt bevorzugt aus dem Dateikopf der EXE - Inno Setup
# und PyInstaller schreiben sie dort hinein, und was dort steht, ist die
# Wahrheit. Der Dateiname ist die Rueckfallebene fuer alles ohne Kopf (ZIP).
#
# Von Hand gepflegt und deshalb erhalten bleiben: "name" und "description"
# des Programms sowie "changes" und "aliases" je Version.

$ErrorActionPreference = 'Stop'
$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesDir = Join-Path $root 'files'
$manifest = Join-Path $filesDir 'files.json'

if (-not (Test-Path $filesDir)) { New-Item -ItemType Directory -Path $filesDir | Out-Null }

function Get-DateiVersion($datei) {
    # ProductVersion zuerst: dort steht "1.5.0", waehrend FileVersion haeufig
    # auf vier Stellen aufgefuellt wird ("1.5.0.0").
    $info = $datei.VersionInfo
    foreach ($kandidat in @($info.ProductVersion, $info.FileVersion)) {
        if (-not $kandidat) { continue }
        $wert = $kandidat.Trim()
        # Dateien ohne Versionsangabe melden je nach Typ Nullen statt nichts.
        if (-not $wert -or $wert -match '^0(\.0)*$') { continue }
        # Nur die vierte Stelle abschneiden ("1.5.0.0" -> "1.5.0"), niemals
        # aus "1.5.0" ein "1.5" machen.
        if (($wert -split '\.').Count -eq 4 -and $wert.EndsWith('.0')) {
            $wert = $wert -replace '\.0$', ''
        }
        return $wert
    }
    return $null
}

function Split-Name($dateiname) {
    # "LolGroupBotAgent-Setup-1.5.0.exe" -> Schluessel + Version aus dem Namen.
    # Ohne Nummer im Namen ist der Stamm der Schluessel und die Version offen.
    $stamm = [IO.Path]::GetFileNameWithoutExtension($dateiname)
    if ($stamm -match '^(?<basis>.+?)[-_ ]v?(?<version>\d+(\.\d+)+)$') {
        return @{ schluessel = $Matches.basis; version = $Matches.version }
    }
    return @{ schluessel = $stamm; version = $null }
}

# Bestehendes Manifest einlesen - alles von Hand Gepflegte wird uebernommen.
$altProgramm = @{}   # schluessel -> @{ name; description }
$altVersion  = @{}   # dateiname  -> @{ changes; aliases; version }
if (Test-Path $manifest) {
    try {
        $alt = Get-Content $manifest -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($p in @($alt)) {
            if ($p.versions) {
                if ($p.id) { $altProgramm[$p.id] = $p }
                foreach ($v in $p.versions) {
                    if ($v.file) { $altVersion[$v.file] = $v }
                }
            } elseif ($p.name) {
                # Altes Format: ein Eintrag je Datei.
                $altVersion[$p.name] = $p
                $teile = Split-Name $p.name
                $altProgramm[$teile.schluessel] = $p
            }
        }
    } catch { Write-Warning "Alte files.json nicht lesbar - wird neu erstellt." }
}

$skip = @('files.json', 'downloads.json', '.gitkeep', 'index.html')

$programme = [ordered]@{}

Get-ChildItem -Path $filesDir -File -Force |
    Where-Object { $skip -notcontains $_.Name } |
    Sort-Object Name |
    ForEach-Object {
        $teile   = Split-Name $_.Name
        $version = Get-DateiVersion $_
        if (-not $version) { $version = $teile.version }
        if (-not $version -and $altVersion.ContainsKey($_.Name)) {
            $version = $altVersion[$_.Name].version
        }

        $eintrag = [ordered]@{
            version  = $version
            file     = $_.Name
            size     = $_.Length
            released = $_.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss')
        }
        # Von Hand gepflegt: was sich in dieser Version geaendert hat, und
        # unter welchen frueheren Namen sie schon gezaehlt wurde.
        if ($altVersion.ContainsKey($_.Name)) {
            if ($altVersion[$_.Name].changes) { $eintrag.changes = $altVersion[$_.Name].changes }
            if ($altVersion[$_.Name].aliases) { $eintrag.aliases = @($altVersion[$_.Name].aliases) }
        }

        $key = $teile.schluessel
        if (-not $programme.Contains($key)) {
            $kopf = [ordered]@{ id = $key; name = $key; description = $null; versions = @() }
            if ($altProgramm.ContainsKey($key)) {
                if ($altProgramm[$key].name)        { $kopf.name = $altProgramm[$key].name }
                if ($altProgramm[$key].description) { $kopf.description = $altProgramm[$key].description }
            }
            $programme[$key] = $kopf
        }
        $programme[$key].versions += [pscustomobject]$eintrag
        Write-Host ("  {0}{1}" -f $_.Name, $(if ($version) { " - Version $version" } else { "" }))
    }

# Neueste zuerst, und zwar der Groesse nach: sonst stuende 1.10.0 vor 1.9.0.
function Sortierschluessel($version) {
    $teile = @()
    foreach ($t in ("$version" -split '[.\-+]')) {
        $n = 0
        if ([int]::TryParse($t, [ref]$n)) { $teile += $n } else { $teile += -1 }
    }
    while ($teile.Count -lt 4) { $teile += 0 }
    # Als Zeichenkette mit fester Breite, damit der Vergleich stimmt.
    ($teile[0..3] | ForEach-Object { '{0:D6}' -f [math]::Max(0, $_) }) -join '.'
}

$ausgabe = @()
foreach ($key in $programme.Keys) {
    $p = $programme[$key]
    $p.versions = @($p.versions | Sort-Object @{ Expression = { Sortierschluessel $_.version }; Descending = $true })
    if (-not $p.description) { $p.Remove('description') }
    $ausgabe += [pscustomobject]$p
}

$json = if ($ausgabe) { ConvertTo-Json @($ausgabe) -Depth 6 } else { '[]' }
[System.IO.File]::WriteAllText($manifest, $json, (New-Object System.Text.UTF8Encoding($false)))

$anzahlVersionen = ($ausgabe | ForEach-Object { $_.versions.Count } | Measure-Object -Sum).Sum
Write-Host ("files.json geschrieben: {0} Programm(e), {1} Version(en)" -f $ausgabe.Count, $anzahlVersionen) -ForegroundColor Green
