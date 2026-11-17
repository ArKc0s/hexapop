# Référencement (SEO)

## Principe
Le jeu tient sur une seule page (`/`, écrans en `#…`), invisible pour les moteurs. Le référencement repose donc sur des
**pages de contenu générées à chaque compilation** (`apps/web/scripts/seo.ts`, lancé par `pnpm build`) : du HTML pur,
léger, une page par chose que les gens cherchent, avec la réponse en haut et un lien vers le jeu.

Techniques reprises des sites de quiz géographiques qui se classent bien (Seterra, Sporcle, sites de révision) :
- **une page par intention de recherche** : « préfecture du Finistère », « liste des départements », « carte des départements », « quiz départements » ;
- **la réponse tout de suite** (phrase d'introduction + fiche), puis le jeu en appel à l'action ;
- **cartes en SVG cliquables**, numéros affichés ;
- **fiches question / réponse visibles et balisées** (schema.org `Quiz` / `Flashcard`, résultat « Questions-réponses éducatives » de Google), FAQ (`FAQPage`), fil d'Ariane (`BreadcrumbList`), lieux (`AdministrativeArea`), jeu (`VideoGame`) ;
- **maillage serré** : département ↔ région ↔ voisins ↔ ordre des numéros ↔ listes ↔ quiz, et depuis le jeu (Album, À propos, pied de l'accueil) ;
- **technique** : adresse canonique, titres et descriptions uniques, plan du site, `robots.txt`, vraies erreurs 404, aperçus de partage, pages sans JavaScript.

## Pages (atlas France)
| Adresse | Cible |
|---|---|
| `/france` | sommaire de l'atlas |
| `/france/departements` | « liste des départements », « numéros des départements » |
| `/france/departements/29-finistere` (×101) | « Finistère », « 29 département », « préfecture du Finistère », « sous-préfectures du Finistère » |
| `/france/regions/bretagne` (×18) | « départements de Bretagne » |
| `/france/prefectures` | « liste des préfectures » |
| `/france/carte-des-departements` | « carte des départements (avec numéros) » |
| `/quiz`, `/quiz/departements`, `/quiz/numeros-des-departements`, `/quiz/prefectures` | « quiz départements », « quiz préfectures »… |

## Évolution avec les atlas (feuille de route)
Les adresses sont pensées pour grandir sans rien casser :
- **chaque atlas a son préfixe** : `/france/…` aujourd'hui, `/europe/pays/allemagne`, `/europe/capitales`… demain ;
- **tous les quiz sous `/quiz/…`** (`/quiz/pays-d-europe`, `/quiz/drapeaux-d-europe`, `/quiz/gentiles`…) et le sommaire `/quiz` les liste par atlas ;
- **un plan du site par atlas** (`/sitemaps/france.xml`, puis `europe.xml`…) réunis dans `/sitemap.xml` ;
- dans le générateur, un atlas = un module (ses pages, ses quiz, sa section de plan du site) ; les gabarits (fiche, carte, fiches question / réponse, FAQ, appel au jeu) sont communs ;
- l'accueil vise aujourd'hui « apprendre les départements » ; quand plusieurs atlas existeront, il visera « apprendre la géographie en jouant », et `/france` gardera les recherches sur les départements.

## À faire par Léo (hors code)
1. **Google Search Console** : ajouter la propriété « Domaine » `hexapop.app`, valider avec l'enregistrement TXT proposé (dans Cloudflare › DNS), puis envoyer `https://hexapop.app/sitemap.xml` (menu Sitemaps). Même chose sur **Bing Webmaster Tools** (il peut importer depuis Search Console).
2. Suivre dans Search Console les requêtes qui amènent du monde : on ajustera titres et contenus d'après les vrais chiffres.
3. **Liens entrants** (le facteur le plus fort) : communautés (Reddit r/france, Discord de géographie), enseignants (forums, sites de ressources : c'est un outil de classe), annuaires de jeux éducatifs.

## Plus tard
- Image de partage propre à chaque page (silhouette du département).
- « Le savais-tu ? » par département (origine du nom…) : contenu unique supplémentaire.
- Pages par sous-préfecture si Search Console montre la demande.

## Images d'aperçu et IndexNow (v1.14)
- **Images d'aperçu par page** : chaque fiche de département et de région a sa propre image (1200 × 630 : nom, préfecture ou chef-lieu, carte avec le département ou la région en rose), dessinée en SVG puis convertie en PNG à la compilation (`@resvg/resvg-js`, polices TTF dans `apps/web/scripts/og-fonts/`, licence OFL). Servies sous `/og/<adresse de la page>.png`. Les autres pages gardent `/og.png`.
- **IndexNow** : après chaque déploiement, `deploy/indexnow.mjs` relit le plan du site en ligne et signale à Bing (et aux autres moteurs IndexNow) les pages nouvelles ou modifiées. Clé publique : `apps/web/public/<clé>.txt`. Empreintes du dernier envoi : `deploy/.indexnow.json` (local, ignoré par git). Google n'utilise pas IndexNow : pour lui, le plan du site suffit.
