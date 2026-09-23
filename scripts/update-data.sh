#!/usr/bin/env bash
# Récupère les classements pilotes et le calendrier depuis l'API officielle MotoGP
# et les écrit dans data/. Appelé par le workflow GitHub Actions, mais exécutable
# aussi en local (curl + jq requis).
set -euo pipefail
cd "$(dirname "$0")/.."

API="https://api.motogp.pulselive.com/motogp/v1"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p data

fetch() {
    curl -sSf --retry 3 --retry-delay 5 -m 60 "$1"
}

# Saison courante : l'UUID change chaque année, on ne le code pas en dur.
fetch "$API/results/seasons" > "$TMP/seasons.json"
SEASON=$(jq -r '[.[] | select(.current == true)][0].id' "$TMP/seasons.json")
YEAR=$(jq -r '[.[] | select(.current == true)][0].year' "$TMP/seasons.json")
if [ -z "$SEASON" ] || [ "$SEASON" = "null" ]; then
    echo "Saison courante introuvable" >&2
    exit 1
fi
echo "Saison $YEAR ($SEASON)"

fetch "$API/results/categories?seasonUuid=$SEASON" > "$TMP/categories.json"

# On ne garde que les champs utilisés par le site : le diff des commits reste lisible.
STANDINGS_FILTER='{
  classification: [.classification[] | {
    position, points, race_wins, podiums, sprint_wins, position_change, last_positions,
    rider: { full_name: .rider.full_name, number: .rider.number, country: .rider.country.iso, uuid: .rider.riders_api_uuid },
    team: { name: .team.name },
    manufacturer: .constructor.name
  }]
}'

for cat in motogp moto2 moto3; do
    case $cat in
        motogp) pattern="MotoGP" ;;
        moto2)  pattern="Moto2" ;;
        moto3)  pattern="Moto3" ;;
    esac
    CAT_ID=$(jq -r --arg p "$pattern" '[.[] | select(.name | test($p; "i"))][0].id' "$TMP/categories.json")
    if [ -z "$CAT_ID" ] || [ "$CAT_ID" = "null" ]; then
        echo "$cat : catégorie introuvable, fichier conservé" >&2
        continue
    fi
    fetch "$API/results/standings?seasonUuid=$SEASON&categoryUuid=$CAT_ID" > "$TMP/$cat.raw.json"
    # Ne jamais écraser un bon fichier par une réponse d'erreur.
    if jq -e '.classification | length > 0' "$TMP/$cat.raw.json" > /dev/null 2>&1; then
        jq "$STANDINGS_FILTER" "$TMP/$cat.raw.json" > "data/$cat.json"
        echo "$cat : $(jq '.classification | length' "data/$cat.json") pilotes"
    else
        echo "$cat : réponse sans classement, fichier conservé" >&2
    fi
done

# Calendrier : uniquement les Grands Prix (pas les tests ni les présentations).
fetch "$API/events?seasonUuid=$SEASON&seasonYear=$YEAR" > "$TMP/events.json"
CALENDAR_FILTER='def num: if . == null then null else tonumber end;
def laps($id): [.value.event_categories[]? | select(.category_timing_id == $id)][0];
[.[] | select(.kind == "GP")] | sort_by(.date_start) | to_entries | map({
  round: (.key + 1),
  name: (.value.additional_name // .value.name | gsub("^\\s+|\\s+$"; "")),
  full_name: (.value.name | gsub("^\\s+|\\s+$"; "")),
  shortname: .value.shortname,
  country: .value.country,
  status: .value.status,
  date_start: .value.date_start,
  date_end: .value.date_end,
  circuit: (.value.circuit.name // null),
  city: (.value.circuit.city // null),
  track_image: (.value.circuit.tracks[0].assets.simple.path // null),
  track: {
    length_m: (.value.circuit.tracks[0].lenght | num),
    width_m: (.value.circuit.tracks[0].width | num),
    longest_straight_m: (.value.circuit.tracks[0].longest_straight | num),
    left_corners: (.value.circuit.tracks[0].left_corners | num),
    right_corners: (.value.circuit.tracks[0].right_corners | num)
  },
  laps: {
    motogp: (laps(3).num_laps // null),
    motogp_sprint: (laps(3).sprint_num_laps // null),
    moto2: (laps(2).num_laps // null),
    moto3: (laps(1).num_laps // null)
  }
})'
if jq -e '[.[] | select(.kind == "GP")] | length > 0' "$TMP/events.json" > /dev/null 2>&1; then
    jq "$CALENDAR_FILTER" "$TMP/events.json" > data/calendar.json
    echo "calendrier : $(jq length data/calendar.json) Grands Prix"
else
    echo "calendrier : réponse vide, fichier conservé" >&2
fi

jq -n --arg d "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg s "$SEASON" --argjson y "$YEAR" \
    '{ updated_at: $d, season_uuid: $s, season_year: $y }' > data/meta.json
