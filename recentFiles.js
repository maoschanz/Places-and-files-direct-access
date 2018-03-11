const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;
const Util = imports.misc.util;
const Signals = imports.signals;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Extension = Me.imports.extension;

//-------------------------------------------------

function trierDate(x,y) {
	return y.get_modified() - x.get_modified();
}

//--------------------------------------------------------

/*
This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
*/
var RecentFileButton = new Lang.Class({
	Name: 'RecentFileButton',
	
	_init: function(icon, label, uri) {
		this.icon = new St.Icon({
			gicon: icon,
			style_class: 'popup-menu-icon', 
			icon_size: Extension.SETTINGS.get_int('recent-files-icon-size')
		});
		this.label = label;
		this.uri = uri;
		let file = Gio.File.new_for_uri(this.uri);
		this.path = file.get_path();
		this.displayedPath = this.truncatePath();
		
		this.actor = new St.Button({
			reactive: true,
			can_focus: true,
			track_hover: true,
			x_align: St.Align.START,
			x_fill: true,
			y_fill: true,
			style_class: 'list-search-result',
		});

		this.actor._delegate = this;
		this._connexion2 = this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
		
		this._menu = null;
		this._menuManager = new PopupMenu.PopupMenuManager(this);
		
		let content = new St.BoxLayout({
			style_class: 'list-search-result-content',
			vertical: false
		});
		this.actor.set_child(content);

		let titleBox = new St.BoxLayout({ style_class: 'list-search-result-title' });

		content.add(titleBox, {
			x_fill: true,
			y_fill: false,
			x_align: St.Align.START,
			y_align: St.Align.MIDDLE
		});

		if (icon) titleBox.add(this.icon);

		let title = new St.Label({ text: this.label });
		titleBox.add(title, {
			x_fill: false,
			y_fill: false,
			x_align: St.Align.START,
			y_align: St.Align.MIDDLE
		});

		this.actor.label_actor = title;

		if (this.uri) {
			this._descriptionLabel = new St.Label({ style_class: 'list-search-result-description', text: this.displayedPath });
			content.add(this._descriptionLabel, {
				x_fill: false,
				y_fill: false,
				x_align: St.Align.START,
				y_align: St.Align.MIDDLE
			});
		}
	},
	
	_onButtonPress: function(actor, event) {
		let button = event.get_button();
		if (button == 1) {
			this.activate();
		} else if (button == 3) {
			this.popupMenu();
			return Clutter.EVENT_STOP;
		}
		return Clutter.EVENT_PROPAGATE;
	},
	
	truncatePath: function() {
		let retValue = "";
		if(this.path == null) {
			retValue = this.uri;
		} else {
			let temp = this.path.split("/");
			for(var i = 0; i < temp.length-1; i++){
				retValue += temp[i] + "/";
			}
			let home = GLib.get_home_dir();
			let a = "";
			if(retValue.substr(0, home.length) == home){
				a = "~" + retValue.substr(home.length, retValue.length);
				retValue = a;
			}
		}
		return retValue;
	},
	
	activate: function() {
		Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context(0, -1));
	},
	
	_onMenuPoppedDown: function() {
		this.actor.sync_hover();
		this.emit('menu-state-changed', false);
	},
	
	popupMenu: function() {
		this.actor.fake_release();

		if (!this._menu) {
			this._menu = new RecentFileMenu(this);
			this._connexion = this._menu.connect('open-state-changed', Lang.bind(this, function (menu, isPoppedUp) {
				if (!isPoppedUp) this._onMenuPoppedDown();
			}));
			this._menuManager.addMenu(this._menu);
		}

		this.emit('menu-state-changed', true);
		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();

		return false;
	},
	
	destroy: function() {
		this.actor.disconnect(this._connexion2);
		this._menu.disconnect(this._connexion);
		this.parent();
	},
});
Signals.addSignalMethods(RecentFileButton.prototype);

var RecentFilesHeader = new Lang.Class({
	Name: 'RecentFilesHeader',
	Extends: St.BoxLayout,
	
	_init: function(list) {
		this._list = list;
		
		this.parent({
			vertical: false,
			style_class: 'recent-files-header',
		});
		
		this.conhandler = Extension.RECENT_MANAGER.connect('changed', Lang.bind(this, this._redisplay));
		
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
		this.searchEntry.connect('secondary-icon-clicked', Lang.bind(this, this._onIconRelease));
		ShellEntry.addContextMenu(this.searchEntry, null);
		
		//--------------------------------
	
		this.settingsButton = new St.Button({
			child: new St.Icon({
				icon_name: 'open-menu-symbolic',
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
		let searched = this.searchEntry.get_text().toLowerCase();
		if (Extension.SETTINGS.get_boolean('search-in-path')) {
			this._list._files.forEach(function(f){
				f.actor.visible = f.displayedPath.toLowerCase().includes(searched) || f.label.toLowerCase().includes(searched);
			});
		} else {
			this._list._files.forEach(function(f){
				f.actor.visible = f.label.toLowerCase().includes(searched);
			});
		}
	},
	
	_redisplay: function() {
		this._list._redisplay();
	},
});

/*
This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
*/
var RecentFilesList = new Lang.Class({
	Name: 'RecentFilesList',
	
	_init: function() {
		this.actor = new St.BoxLayout({ style_class: 'search-section', vertical: true, x_expand: true });
		this._resultDisplayBin = new St.Bin({ x_fill: true, y_fill: true });
		this.actor.add(this._resultDisplayBin, { expand: true });
		this._container = new St.BoxLayout({ style_class: 'search-section-content recent-files-list' });
		this._content = new St.BoxLayout({
			style_class: 'list-search-results',
			vertical: true,
		});
		this._container.add(this._content, { expand: true });
		this._resultDisplayBin.set_child(this._container);
		this._buildRecents();
	},
	
	_redisplay: function() {
		this._content.destroy_all_children();
		this._buildRecents();
	},
	
	_buildRecents: function() {
		/* inspired by the code from RecentItems@bananenfisch.net */
		let Ritems = Extension.RECENT_MANAGER.get_items();
		Ritems.sort(trierDate);
		
		let blacklistString = Extension.SETTINGS.get_string('blacklist').replace(/\s/g, ""); 
		let blacklistList = blacklistString.split(",");
		this._files = [];
		
		for(let i = 0 ; i < Extension.SETTINGS.get_int('number-of-recent-files') ; i++){
			if(Ritems[i] == null || Ritems[i] == undefined) {
				break;
			}
			let itemtype = Ritems[i].get_mime_type();
			
			if (blacklistList.indexOf((itemtype.split("/"))[0]) == -1) {
				
				let gicon = Gio.content_type_get_icon(itemtype);
				/*améliorable ? Gio.File.new_for_uri(****).query_info('standard::(((symbolic-)))icon', 0, null); */
				this._files.push(new RecentFileButton(
					gicon,
					Ritems[i].get_display_name(),
					Ritems[i].get_uri()
				));
				this._content.add( this._files[this._files.length -1].actor );
			}
		}
	},
	
	destroy() {
		Extension.RECENT_MANAGER.disconnect(this.conhandler);
		this.parent();
	},
});

var RecentFileMenu = new Lang.Class({
	Name: 'RecentFileMenu',
	Extends: PopupMenu.PopupMenu,

	_init: function(source) {
		let side = St.Side.BOTTOM;
		if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
			side = St.Side.TOP;

		this.parent(source.actor, 0.5, side);

		// We want to keep the item hovered while the menu is up
		this.blockSourceEvents = true;

		this._source = source;

		this.actor.add_style_class_name('app-well-menu');

		// Chain our visibility and lifecycle to that of the source
		source.actor.connect('notify::mapped', Lang.bind(this, function () {
			if (!source.actor.mapped) this.close();
		}));
		source.actor.connect('destroy', Lang.bind(this, this.destroy));

		Main.uiGroup.add_actor(this.actor);
	},

	_redisplay: function() {
		this.removeAll();

		this._appendMenuItem(_("Open") + " " + this._source.label).connect('activate', Lang.bind(this, this._onOpen));
		//this._appendMenuItem(_("Open with")).connect('activate', Lang.bind(this, this._onOpenWith));
		this._appendSeparator();
		this._appendMenuItem(_("Open parent folder")).connect('activate', Lang.bind(this, this._onParent));
		if(this._source.path != null) {
			this._appendMenuItem(_("Copy path")).connect('activate', Lang.bind(this, this._onCopyPath));
		}
		this._appendSeparator();
		this._appendMenuItem(_("Remove from the list")).connect('activate', Lang.bind(this, this._onRemove));
	},
	
	_onParent: function() {
		Gio.app_info_launch_default_for_uri(this._folderUri(), global.create_app_launch_context(0, -1));
	},
	
	_folderUri: function() {
		let temp = this._source.uri.split('/');
		let temp2 = "";
	
		for(var i = 0; i < temp.length; i++){
			if (i != temp.length-1) {
				temp2 += temp[i] + '/';
			}
		}
		return temp2;
	},
	
	_onCopyPath: function() {
		Clipboard.set_text(CLIPBOARD_TYPE, this._source.path);
	},
	
	_onOpen: function() {
		this._source.activate();
	},
	
	_onOpenWith: function() {
		//TODO
	},
	
	_onRemove: function() {
		Extension.RECENT_MANAGER.remove_item(this._source.uri);
	},
	
	_appendSeparator: function () {
		let separator = new PopupMenu.PopupSeparatorMenuItem();
		this.addMenuItem(separator);
	},

	_appendMenuItem: function(labelText) {
		let item = new PopupMenu.PopupMenuItem(labelText);
		this.addMenuItem(item);
		return item;
	},

	popup: function(activatingButton) {
		this._redisplay();
		this.open();
	},
});
Signals.addSignalMethods(RecentFileMenu.prototype);

//-----------------------


/*
This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
*/
var DesktopFilesList = new Lang.Class({
	Name: 'DesktopFilesList',
	
	_init: function() {
		this.actor = new St.BoxLayout({ style_class: 'search-section', vertical: true, x_expand: true });
		this._resultDisplayBin = new St.Bin({ x_fill: true, y_fill: true });
		this.actor.add(this._resultDisplayBin, { expand: true });
		this._container = new St.BoxLayout({ style_class: 'search-section-content recent-files-list' });
		this._content = new St.BoxLayout({
			style_class: 'list-search-results',
			vertical: true,
		});
		this._container.add(this._content, { expand: true });
		this._resultDisplayBin.set_child(this._container);
		this._buildRecents();
	},
	
	_redisplay: function() {
//		this._content.destroy_all_children();
//		this._buildRecents();
	},
	
	_buildRecents: function() {
		/* inspired by the code from RecentItems@bananenfisch.net */
//		let Ritems = Extension.RECENT_MANAGER.get_items();
//		Ritems.sort(trierDate);
//		
//		let blacklistString = Extension.SETTINGS.get_string('blacklist').replace(/\s/g, ""); 
//		let blacklistList = blacklistString.split(",");
//		this._files = [];
//		
//		for(let i = 0 ; i < Extension.SETTINGS.get_int('number-of-recent-files') ; i++){
//			if(Ritems[i] == null || Ritems[i] == undefined) {
//				break;
//			}
//			let itemtype = Ritems[i].get_mime_type();
//			
//			if (blacklistList.indexOf((itemtype.split("/"))[0]) == -1) {
//				
//				let gicon = Gio.content_type_get_icon(itemtype);
//				/*améliorable ? Gio.File.new_for_uri(****).query_info('standard::(((symbolic-)))icon', 0, null); */
//				this._files.push(new RecentFileButton(
//					gicon,
//					Ritems[i].get_display_name(),
//					Ritems[i].get_uri()
//				));
//				this._content.add( this._files[this._files.length -1].actor );
//			}
//		}
	},
	
	destroy() {
//		Extension.RECENT_MANAGER.disconnect(this.conhandler);
		this.parent();
	},
});



