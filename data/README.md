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
