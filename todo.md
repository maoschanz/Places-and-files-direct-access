
blacklist avec un vrai array ptn

## La fameuse barre de recherche

Puisqu'il faut y cliquer, autant en faire une barre à boutons :
- chercher
- préférences
- coller si dispo
- la blacklist ??

--------------------

## Performance

Construire tous les objets, avec un objet par fichier, et :

- actived (booléen qui bloque les callbacks)
- searchable (booléen)
- on_activate_provider

## Organisation

Le fichier principal contient une liste des objets, qui sera parcourue dans divers cas (tels que la construction, la recherche, la destruction).

Ensuite un fichier par "élément"

Le fichier principal construit les boîtes, et mettra ce qu'il faut où il le faut selon les options de dconf.

Attention desktop manque de scrollview !!!!

Attention starred n'existe pas mdr

## Préférences

pour GTK on verra plus tard

## Fonctionnalités

Avec des boutons Coller et Nouveau dans le header qui serait plutøt ajouté en bas pour le bureau

Prévenir quand c'est admin et dire qu'on ne sait pas faire

Options avancées :

- éditer comme admin ?? --> impossible pour le moment
- ouvrir avec (via un portal ?)
- 






