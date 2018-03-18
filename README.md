# Convenient access to files

A GNOME Shell extension providing an access to devices, bookmarks and recent files on the desktop.

![Example with files on the desktop](https://i.imgur.com/FGRkMPv.png)

## Features

- Access to places:
    - GTK+ 3 bookmarks
    - Trash
    - Removable devices
    - Mounted partitions
- Access to files:
    - Recent files
    - ~/Desktop files (optional)
    - etc.
- Searching among recent files
- Unmounting devices & ejecting partitions
- Renaming/deleting/executing files from ~/Desktop
- Renaming/removing bookmarks

![Example with files in the overview](https://i.imgur.com/mbiSxF4.jpg)

## Settings

Most settings need to disable/re-enable the extension to be applied.

- search filtering by types
- search in files name or in their paths
- where to display the interface (on the desktop or in the overview)
- exact position (customizable paddings)
- icon sizes

https://i.imgur.com/Ntdutdf.png https://i.imgur.com/OEg2QVz.png https://i.imgur.com/UiOrBu7.png

## Manual installation

Download files and put them in the folder "`~/.local/share/gnome-shell/extensions/places-and-files-on-desktop@maestroschan.fr`"

You may need to restart the gnome shell environment ("logout and login again", or `alt` + `f2` then `r` then `enter`).

## Available in

- Français
- English

## Huge thanks to

- fmuellner (my "placeDisplay.js" file mostly comes from [places-menu@gnome-shell-extensions.gcampax.github.com](https://gitlab.gnome.org/GNOME/gnome-shell-extensions))
- bananenfisch (the code for getting, filtering and sorting recent files mostly comes from [RecentItems@bananenfisch.net](https://github.com/bananenfisch/RecentItems))
