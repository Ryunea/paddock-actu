#!/usr/bin/env python3
"""Récupère les photos officielles des pilotes présents dans data/*.json et génère
deux vignettes légères par pilote dans img/riders/ :
  <uuid>-bust.webp  buste (podium)      <uuid>-head.webp  tête carrée (tableau)
Le manifeste data/riders.json indique quels pilotes ont une image ; les sources
inchangées ne sont pas retéléchargées (les originaux font ~4 Mo chacun).
Dépendances : python3 + Pillow (pip install pillow).
"""
import io
import json
import os
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.motogp.pulselive.com/motogp/v1"
IMG_DIR = ROOT / "img" / "riders"
MANIFEST = ROOT / "data" / "riders.json"
BUST_HEIGHT = 320
HEAD_SIZE = 96


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "PaddockActu/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def profile_url(rider_uuid, season_year):
    """URL de la photo de profil de la saison en cours, sinon la plus récente."""
    data = json.loads(fetch(f"{API}/riders/{rider_uuid}"))
    steps = data.get("career") or []
    steps.sort(key=lambda s: (s.get("season") or 0, 1 if s.get("current") else 0), reverse=True)
    for step in steps:
        if season_year and (step.get("season") or 0) > season_year:
            continue
        url = ((step.get("pictures") or {}).get("profile") or {}).get("main")
        if url:
            return url
    return None


def alpha_bbox(img):
    return img.getchannel("A").getbbox()


def make_thumbnails(png_bytes, uuid):
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    box = alpha_bbox(img)
    if not box:
        return False
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0

    # Buste : moitié haute de la silhouette
    bust = img.crop((x0, y0, x1, y0 + int(h * 0.55)))
    ratio = BUST_HEIGHT / bust.height
    bust = bust.resize((max(1, round(bust.width * ratio)), BUST_HEIGHT), Image.LANCZOS)
    bust.save(IMG_DIR / f"{uuid}-bust.webp", "WEBP", quality=82, method=6)

    # Tête : centrée sur les pixels les plus hauts (casquette / casque), côté = moitié de la largeur
    alpha = img.getchannel("A")
    top_rows = alpha.crop((x0, y0, x1, y0 + max(1, h // 25)))
    xs = [i % top_rows.width for i, a in enumerate(top_rows.getdata()) if a > 40]
    cx = x0 + (sum(xs) / len(xs) if xs else w / 2)
    side = int(w * 0.5)
    left = int(min(max(cx - side / 2, 0), img.width - side))
    head = img.crop((left, y0, left + side, y0 + side)).resize((HEAD_SIZE, HEAD_SIZE), Image.LANCZOS)
    head.save(IMG_DIR / f"{uuid}-head.webp", "WEBP", quality=85, method=6)
    return True


def main():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    meta = json.loads((ROOT / "data" / "meta.json").read_text()) if (ROOT / "data" / "meta.json").exists() else {}
    season_year = meta.get("season_year")

    riders = {}
    for cat in ("motogp", "moto2", "moto3"):
        path = ROOT / "data" / f"{cat}.json"
        if not path.exists():
            continue
        for item in json.loads(path.read_text()).get("classification", []):
            rider = item.get("rider") or {}
            if rider.get("uuid"):
                riders[rider["uuid"]] = rider.get("full_name", "")

    updated, skipped, missing = 0, 0, 0
    for uuid, name in riders.items():
        try:
            source = profile_url(uuid, season_year)
        except Exception as e:
            print(f"{name} : API indisponible ({e})", file=sys.stderr)
            source = manifest.get(uuid, {}).get("source")
        if not source:
            missing += 1
            manifest.pop(uuid, None)
            continue
        entry = manifest.get(uuid)
        have_files = (IMG_DIR / f"{uuid}-bust.webp").exists() and (IMG_DIR / f"{uuid}-head.webp").exists()
        if entry and entry.get("source") == source and have_files:
            skipped += 1
            continue
        try:
            if make_thumbnails(fetch(source, timeout=120), uuid):
                manifest[uuid] = {"name": name, "source": source}
                updated += 1
                print(f"{name} : ok")
            else:
                missing += 1
        except Exception as e:
            print(f"{name} : échec ({e})", file=sys.stderr)

    # Retire du manifeste les pilotes qui ne sont plus au classement
    for uuid in list(manifest):
        if uuid not in riders:
            manifest.pop(uuid)
            for f in IMG_DIR.glob(f"{uuid}-*.webp"):
                f.unlink()

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    print(f"{updated} générées, {skipped} inchangées, {missing} sans photo")


if __name__ == "__main__":
    main()
