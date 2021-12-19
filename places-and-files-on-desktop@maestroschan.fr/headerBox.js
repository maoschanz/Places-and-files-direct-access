
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;
const Util = imports.misc.util;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Extension = Me.imports.extension;

////////////////////////////////////////////////////////////////////////////////

var HeaderBox = class HeaderBox {
	constructor (layout) {
		this.actor = new St.BoxLayout ({
			vertical: false,
			style_class: 'convenient-list-header',
		});
		this.layout = layout;

		this.searchEntry = new St.Entry({
			name: 'searchEntry',
			style_class: 'search-entry',
			can_focus: true,
			hint_text: _('Type here to search…'),
			track_hover: true,
			y_expand: false,
			primary_icon: new St.Icon({
				icon_name: 'edit-find-symbolic',
				icon_size: 16,
				style_class: 'system-status-icon',
				y_align: Clutter.ActorAlign.CENTER,
			}),
			secondary_icon: new St.Icon({
				icon_name: 'edit-clear-symbolic',
				icon_size: 16,
				style_class: 'system-status-icon',
				y_align: Clutter.ActorAlign.CENTER,
			}),
		});
		this.searchEntry.get_clutter_text().connect('text-changed',
		                                  this._onSearchTextChanged.bind(this));
		this.searchEntry.connect('secondary-icon-clicked',
		                                        this._onIconRelease.bind(this));
		// this.searchEntry.connect('enter-event', this.beginSearch.bind(this));
		this.searchEntry.connect('key-focus-in', this.beginSearch.bind(this)); // ???? XXX TODO
		this.searchEntry.connect('key-focus-out', this.endSearch.bind(this));
		ShellEntry.addContextMenu(this.searchEntry, null);

		//----------------------------------------------------------------------

		// TODO add a switch to toggle "search in path"

		//----------------------------------------------------------------------

		this.settingsButton = new St.Button({
			child: new St.Icon({
				icon_name: 'emblem-system-symbolic',
				style_class: 'system-status-icon',
				icon_size: 16,
				y_align: Clutter.ActorAlign.CENTER,
			}),
			accessible_name: _("Settings"),
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'button',
			style: 'padding-right: 12px; padding-left: 12px;',
			reactive: true,
			can_focus: true,
			track_hover: true,
			y_expand: false,
			y_fill: true
		});

		this.settingsButton.connect('clicked', this.openSettings.bind(this));

		//----------------------------------------------------------------------

		this.actor.add(new St.BoxLayout({x_expand: true,}));
		this.actor.add(this.searchEntry);
		this.actor.add(this.settingsButton);
		this.actor.add(new St.BoxLayout({x_expand: true,}));
	}

	beginSearch () {
//		this.searchEntry.set_text('');
		global.stage.set_key_focus(this.searchEntry);
	}

	endSearch () {
		return;
	}

	openSettings () {
		Util.spawn(['gnome-shell-extension-prefs', 'places-and-files-on-desktop@maestroschan.fr']);
	}

	_onIconRelease () {
		this.searchEntry.set_text('');
	}

	_onSearchTextChanged () {
		this.layout.filter_widgets(this.searchEntry.get_text().toLowerCase());
	}

	filter_widget (text) {
		/* nothing */
	}
};

