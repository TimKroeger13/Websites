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

# Die bisherigen Zahlen als "name<Tab>anzahl" ausgeben. Das Format ist das
# eigene von weiter unten, flach und ohne Verschachtelung - deshalb genuegt es,
# Klammern, Anfuehrungszeichen und Kommas wegzuwerfen.
alt() {
    [ -f "$ZIEL" ] || return 0
    tr -d '{}", ' < "$ZIEL" | awk -F: 'NF == 2 && $1 != "" && $2 != "" {
        print $1 "\t" $2
    }'
}

# Kombiniertes Format:  ip - - [datum] "GET /pfad HTTP/1.1" 200 1234 "ref" "ua"
#                       $1          $4      $6   $7   $8      $9
# Nur GET und nur 200: ein 206 ist eine fortgesetzte Uebertragung und wuerde
# denselben Download mehrfach zaehlen.
NEU="$ZIEL.neu"
trap 'rm -f "$NEU" "$ZIEL.tmp"' EXIT
sammeln | awk -v pfad="$PFAD" '
    $6 == "\"GET" && $9 == 200 && index($7, pfad) == 1 {
        name = substr($7, length(pfad) + 1)
        sub(/\?.*$/, "", name)
        if (name == "" || name == "files.json" || name == "downloads.json") next
        anzahl[name]++
    }
    END {
        for (name in anzahl) print name "\t" anzahl[name]
    }
' > "$NEU"

# Nichts gefunden? Dann lieber die alten Zahlen stehen lassen als sie mit
# einer leeren Datei zu ueberschreiben. Entweder stimmt der Pfad nicht, oder
# die Protokolle sind weggerotiert, ohne dass seither jemand geladen hat.
if [ ! -s "$NEU" ]; then
    echo "Keine Downloads im Protokoll. Stimmen LOGS=$LOGS und PFAD=$PFAD?" >&2
    exit 1
fi

# Gezaehlt wird je Datei das Hoehere von alt und neu. logrotate wirft die
# aelteren Protokolle irgendwann weg; ein Download, der einmal passiert ist,
# soll dadurch nicht wieder verschwinden.
{ alt; cat "$NEU"; } | awk -F'\t' '
    $2 + 0 > anzahl[$1] { anzahl[$1] = $2 + 0 }
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

mv "$ZIEL.tmp" "$ZIEL"
echo "downloads.json geschrieben:"
cat "$ZIEL"
