#!/bin/bash

./update-and-compile-translations.sh

cd places-and-files-on-desktop@maestroschan.fr

glib-compile-schemas ./schemas

zip ../places-and-files-on-desktop@maestroschan.fr.zip convenience.js
zip ../places-and-files-on-desktop@maestroschan.fr.zip desktopFiles.js
zip ../places-and-files-on-desktop@maestroschan.fr.zip headerBox.js
zip ../places-and-files-on-desktop@maestroschan.fr.zip placeDisplay.js
zip ../places-and-files-on-desktop@maestroschan.fr.zip extension.js
zip ../places-and-files-on-desktop@maestroschan.fr.zip metadata.json
zip ../places-and-files-on-desktop@maestroschan.fr.zip prefs.js
zip ../places-and-files-on-desktop@maestroschan.fr.zip prefs.ui
zip ../places-and-files-on-desktop@maestroschan.fr.zip stylesheet.css

zip -r ../places-and-files-on-desktop@maestroschan.fr.zip schemas
zip -r ../places-and-files-on-desktop@maestroschan.fr.zip locale
zip -r ../places-and-files-on-desktop@maestroschan.fr.zip images
