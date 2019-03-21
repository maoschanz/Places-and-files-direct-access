#!/bin/bash

#####

echo "Generating .pot file..."

xgettext --files-from=POTFILES.in --from-code=UTF-8 --output=places-and-files-on-desktop@maestroschan.fr/locale/places-files-desktop.pot

#####

IFS='
'
liste=`ls ./places-and-files-on-desktop@maestroschan.fr/locale/`
prefix="./places-and-files-on-desktop@maestroschan.fr/locale"

for dossier in $liste
do
	if [ "$dossier" != "places-files-desktop.pot" ]; then
		echo "Updating translation for: $dossier"
		msgmerge -N $prefix/$dossier/LC_MESSAGES/places-files-desktop.po $prefix/places-files-desktop.pot > $prefix/$dossier/LC_MESSAGES/places-files-desktop.temp.po
		mv $prefix/$dossier/LC_MESSAGES/places-files-desktop.temp.po $prefix/$dossier/LC_MESSAGES/places-files-desktop.po
		echo "Compiling translation for: $dossier"
		msgfmt $prefix/$dossier/LC_MESSAGES/places-files-desktop.po -o $prefix/$dossier/LC_MESSAGES/places-files-desktop.mo
	fi
done

#####

exit 0
