# PROCASEF – Carte Leaflet des opérations foncières

Carte interactive des 138 communes de la phase initiale du PROCASEF :
**Inventaires · NICAD · Délibérations · Approbations**, avec les 5 grappes,
les 14 régions et un classement des communes.

## Lancer le projet
Aucune installation requise : ouvrez `index.html` dans un navigateur (double-clic).
Leaflet est lu depuis `lib/leaflet/` (voir ci-dessous) ; s'il y est absent, la page
se replie sur le CDN unpkg. Les tuiles OpenStreetMap (case facultative) exigent Internet.

### Rendre le projet 100 % hors-ligne
Lancez une fois `python3 fetch_leaflet.py` : Leaflet 1.9.4 est téléchargé dans `lib/leaflet/`.

Pour un serveur local (facultatif) :

    python3 -m http.server 8000      # puis http://localhost:8000

## Structure
    index.html            page principale
    img/                  logos (ministère, PROCASEF) affichés dans l'en-tête
    css/style.css         styles (thème clair/sombre automatique)
    lib/leaflet/          Leaflet local (à remplir via fetch_leaflet.py)
    fetch_leaflet.py      téléchargeur de Leaflet
    js/app.js             logique : onglets, choroplèthe, couches, classement
    data/*.geojson        données source (communes, grappes, régions, pays)
    data/*.js             mêmes données encapsulées (window.COMMUNES, …) pour
                          fonctionner en ouverture directe (file://) sans fetch
    README.md

## Fonctionnalités
- 5 vues : Grappes, Inventaires, NICAD, Délibérations, Approbations
  (chaque commune garde la couleur de base de sa grappe, sans dégradé ;
  gris = non renseigné ou 0 ; les valeurs sont lues dans l'infobulle et le classement).
  Les totaux des onglets suivent le filtre région / grappe.
- Chaîne foncière : part de l'inventaire encore présente au NICAD, en
  délibération et en approbation.
- Infobulle au survol ; au clic sur une commune, elle passe en orange et ses
  informations s'ouvrent dans un panneau latéral (chaîne foncière en % de
  l'inventaire). Fermer : bouton ×, clic sur la carte ou Échap.
- Habillage cartographique : flèche du Nord,
  échelle, pays voisins en pointillés (Mauritanie, Mali, Guinée, Gambie…), villes de repère.
- Couches : limites des grappes (masquées par défaut) et des régions, fond pays, OpenStreetMap,
  noms des communes à partir du zoom 9. Échelle métrique et recentrage.
- Classement avec recherche insensible aux accents (commune, région,
  grappe), tri par valeur, nom ou région, export CSV.
- Thème clair / sombre (mémorisé). La touche `/` place le curseur dans
  la recherche, Échap ferme la fiche.

## Données
Chaque commune porte : `c` (nom), `r` (région), `g` (grappe),
`i` (inventaires), `n` (NICAD), `l` (délibérations), `a` (approbations).
Quelques polygones n'ont pas de nom (`c = null`, valeurs vides) ; ils sont
dessinés mais exclus du classement.
Pour mettre à jour les chiffres : modifier `data/communes.geojson`, puis
régénérer `data/communes.js` (préfixe `window.COMMUNES=` + contenu + `;`).

## Dépendances
Leaflet 1.9.4 (BSD-2-Clause), local ou via unpkg.com.
