#!/bin/sh
# Zaehlt die Downloads und schreibt files/downloads.json.
#
# Laeuft AUF DEM SERVER, nicht zu Hause: gezaehlt wird aus dem
# Zugriffsprotokoll des Webservers. Damit braucht die Downloadseite kein PHP,
# keine Datenbank und keinen zusaetzlichen Dienst - sie bleibt statisch.
#
#   ./count-downloads.sh
#
# Einmal pro Stunde automatisch (crontab -e):
#   17 * * * * /home/jerry/Websites/Software/count-downloads.sh >/dev/null 2>&1
#
# Pfade bei Bedarf hier oder als Umgebungsvariable setzen:
SITE=${SITE:-/home/jerry/Websites/Software}
LOGS=${LOGS:-/var/log/nginx}
PFAD=${PFAD:-/websites/Software/files/}

set -e
ZIEL="$SITE/files/downloads.json"

# Auch die rotierten Protokolle mitlesen - sonst faellt die Zahl jede Woche
# auf null zurueck, wenn logrotate die access.log wegschiebt.
sammeln() {
    for datei in "$LOGS"/access.log*; do
        [ -f "$datei" ] || continue
        case "$datei" in
            *.gz) zcat -- "$datei" ;;
            *)    cat  -- "$datei" ;;
        esac
    done
}

# Kombiniertes Format:  ip - - [datum] "GET /pfad HTTP/1.1" 200 1234 "ref" "ua"
#                       $1          $4      $6   $7   $8      $9
# Nur GET und nur 200: ein 206 ist eine fortgesetzte Uebertragung und wuerde
# denselben Download mehrfach zaehlen.
sammeln | awk -v pfad="$PFAD" '
    $6 == "\"GET" && $9 == 200 && index($7, pfad) == 1 {
        name = substr($7, length(pfad) + 1)
        sub(/\?.*$/, "", name)
        if (name == "" || name == "files.json" || name == "downloads.json") next
        anzahl[name]++
    }
    END {
        printf "{\n"
        erste = 1
        for (name in anzahl) {
            if (!erste) printf ",\n"
            printf "  \"%s\": %d", name, anzahl[name]
            erste = 0
        }
        printf "\n}\n"
    }
' > "$ZIEL.tmp"

# Nichts gefunden? Dann lieber die alten Zahlen stehen lassen als sie mit
# einer leeren Datei zu ueberschreiben - meist stimmt dann nur der Pfad nicht.
if ! grep -q ':' "$ZIEL.tmp"; then
    rm -f "$ZIEL.tmp"
    echo "Keine Downloads gefunden. Stimmen LOGS=$LOGS und PFAD=$PFAD?" >&2
    exit 1
fi

mv "$ZIEL.tmp" "$ZIEL"
echo "downloads.json geschrieben:"
cat "$ZIEL"
