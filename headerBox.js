const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
//const Main = imports.ui.main;
//const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;
const Util = imports.misc.util;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

//-------------------------------------------------

var HeaderBox = new Lang.Class({
	Name: 'HeaderBox',
	Extends: St.BoxLayout,
	
	_init: function(layout) {

		this.layout = layout;
		
		this.actor = this;
		
		this.parent({
			vertical: false,
			style_class: 'convenient-list-header',
		});
		
		this.searchEntry = new St.Entry({
			name: 'searchEntry',
			style_class: 'search-entry',
			can_focus: true,
			hint_text: _('Type here to search...'),
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
		this.searchEntry.get_clutter_text().connect(
			'text-changed', 
			Lang.bind(this, this._onSearchTextChanged)
		);
		this.searchEntry.connect('secondary-icon-clicked', Lang.bind(this, this._onIconRelease)); //FIXME 3.18
		ShellEntry.addContextMenu(this.searchEntry, null);
		
		//--------------------------------
	
		this.settingsButton = new St.Button({
			child: new St.Icon({
				icon_name: 'emblem-system-symbolic',
//				icon_name: 'open-menu-symbolic',
				style_class: 'system-status-icon',
				icon_size: 16,
				y_align: Clutter.ActorAlign.CENTER,
			}),
			accessible_name: _("Settings"),
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'button',
			reactive: true,
			can_focus: true,
			track_hover: true,
			y_expand: false,
			y_fill: true
		});
		
		this.settingsButton.connect('clicked', Lang.bind(this, this.openSettings));

		//--------------------------------
		
		this.add(new St.BoxLayout({x_expand: true,}));
		this.add(this.searchEntry);
		this.add(this.settingsButton);
		this.add(new St.BoxLayout({x_expand: true,}));
	},
	
	openSettings: function() {
		Util.spawn(["gnome-shell-extension-prefs", "places-and-files-on-desktop@maestroschan.fr"]);
	},
	
	_onIconRelease: function() {
		this.searchEntry.set_text('');
	},
	
	_onSearchTextChanged: function() {
		this.layout.filter_widgets(this.searchEntry.get_text().toLowerCase());
	},
	
	filter_widget: function(text) {
		/* nothing */
	},
});



