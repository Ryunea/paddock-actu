# PaddockActu

Site statique d'actualité MotoGP : articles, classements pilotes (MotoGP, Moto2, Moto3) et calendrier de la saison.
Aucune dépendance ni build : du HTML, du CSS et du JavaScript servis tels quels (GitHub Pages ou n'importe quel serveur statique).

## Lancer en local

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Un serveur est nécessaire (pas d'ouverture en `file://`) : les classements et le calendrier sont chargés depuis `data/` via `fetch`.

## Structure

```
index.html          accueil, catalogue, classements et calendrier (navigation par ancre : #tous-les-articles, #classements, #calendrier, #calendrier/AUT)
articles/*.html     une page par article
js/articles.js      liste des articles (source unique des cartes de l'accueil, du catalogue et du bloc "À lire aussi")
js/app.js           navigation, rendu des cartes, classements, calendrier
style.css           feuille de style commune
data/*.json         classements, calendrier, photos disponibles et date de mise à jour (générés, ne pas éditer à la main)
img/riders/         vignettes des pilotes (générées : <uuid>-bust.webp pour le podium, <uuid>-head.webp pour le tableau)
scripts/update-data.sh   récupération des données depuis l'API officielle MotoGP
scripts/rider-images.py  photos officielles des pilotes → vignettes WebP (python3 + Pillow)
.github/workflows/update-standings.yml   exécution automatique du script (tous les jours + dimanche soir)
```

## Publier un article

1. Copier une page existante de `articles/` (par exemple `articles/gp-autriche-2026.html`) sous un nouveau nom.
2. Adapter le `<title>`, les balises `meta`, le bloc JSON-LD, le titre, la date, l'image et le contenu.
3. Ajouter une entrée en tête de `js/articles.js` :

```js
{
    slug: 'nom-du-fichier-sans-html',
    title: 'Titre de l\'article',
    excerpt: 'Résumé affiché sur la carte.',
    category: 'motogp',        // motogp, moto2, moto3 ou paddock
    gp: 'JPN',                 // code du Grand Prix (shortname dans data/calendar.json), à omettre hors GP
    date: '2026-10-04',        // AAAA-MM-JJ, sert au tri
    author: 'Lucas',
    image: 'https://...'
}
```

Les cartes de l'accueil (à la une + 3 suivants), du catalogue (avec filtres), du bloc "À lire aussi" et de la fiche du Grand Prix (`#calendrier/JPN`) se mettent à jour toutes seules.

## Données MotoGP

`scripts/update-data.sh` interroge `api.motogp.pulselive.com` :

- détecte la saison courante (l'UUID de saison change chaque année) ;
- écrit `data/motogp.json`, `data/moto2.json`, `data/moto3.json` (classements pilotes, champs réduits à l'utile) ;
- écrit `data/calendar.json` (les Grands Prix de la saison avec circuit, tracé, tours et virages, sans les tests ni les présentations) ;
- écrit `data/meta.json` (date de mise à jour, saison).

`scripts/rider-images.py` lit ensuite les pilotes classés, récupère leur photo officielle (`riders/<uuid>`, ~4 Mo l'original) et génère deux vignettes WebP dans `img/riders/` ; `data/riders.json` sert de manifeste et évite de retélécharger une photo inchangée.

Un fichier n'est jamais écrasé par une réponse vide ou en erreur.
Le workflow GitHub Actions ne commite que si les classements ou le calendrier ont changé.
Pour forcer une mise à jour : onglet Actions du dépôt, « Mise à jour des données MotoGP », « Run workflow ». En local : `bash scripts/update-data.sh && python3 scripts/rider-images.py` (curl, jq, python3 + Pillow requis).
