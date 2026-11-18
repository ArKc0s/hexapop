# Données

`pnpm data` régénère `packages/data/src/*.json` à partir de `data/sources/`.

| Fichier | Source |
|---|---|
| `v_departement.csv`, `v_arrondissement.csv`, `v_commune.csv`, `v_region.csv` | INSEE, Code officiel géographique 2025 (Licence Ouverte) |
| `dep-om.geojson` | [france-geojson](https://github.com/gregoiredavid/france-geojson) (contours IGN ADMIN EXPRESS, Licence Ouverte) |

Règles :
- **Préfecture** = chef-lieu du département (COG).
- **Sous-préfectures** = chefs-lieux des arrondissements du département, hors préfecture. Mayotte n'a pas d'arrondissement : aucune sous-préfecture.
- **Limitrophes** = départements partageant au moins un arc de frontière terrestre (topologie calculée sur les contours non simplifiés). Pas de voisinage maritime : la Corse (2A/2B) n'a que son autre moitié, l'outre-mer n'en a aucun.
- **Carte** : métropole en Lambert-93, largeur 1000 unités SVG ; outre-mer en encarts (colonne de gauche), chaque territoire à sa propre échelle. `zooms.idf` délimite Paris et la petite couronne pour l'encart agrandi.

## Atlas Monde (`pnpm data:monde`, `data/scripts/build-monde.mjs`)

| Fichier | Source |
|---|---|
| `monde/ne_50m_admin_0_countries.geojson` | Natural Earth 1:50m, pays (domaine public) |
| `monde/ne_50m_admin_0_breakaway_disputed_areas.geojson` | Natural Earth 1:50m, zones disputées ou sécessionnistes (domaine public) |
| `monde/villes.json` | Extrait de Natural Earth 1:10m populated places : les 10 villes les plus peuplées de chaque pays, nom en français |
| `apps/web/public/drapeaux/*.svg` | [flag-icons](https://github.com/lipis/flag-icons) 7.5.0 (licence MIT, voir `LICENSE` dans le dossier) |

Noms, articles et capitales en français : écrits à la main dans le script. Règles de neutralité : `docs/atlas.md`.
