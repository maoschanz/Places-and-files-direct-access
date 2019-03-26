const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Signals = imports.signals;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Extension = Me.imports.extension;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

var RECENT_MANAGER;

//-------------------------------------------------

function trierDate(x,y) {
	return y.get_modified() - x.get_modified();
}

function trierNom(l,r) {
	return l.get_display_name().localeCompare(r.get_display_name());
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
		this.actor.connect('button-press-event', this._onButtonPress.bind(this));
		
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
			this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
				if (!isPoppedUp)
					this._onMenuPoppedDown();
			});
			this._menuManager.addMenu(this._menu);
		}

		this.emit('menu-state-changed', true);
		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();

		return false;
	},
	
	destroy: function() {
		this.parent();
	},
});
Signals.addSignalMethods(RecentFileButton.prototype);

/*
This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
*/
var RecentFilesList = new Lang.Class({
	Name: 'RecentFilesList',
	
	_init: function() {
	
		this.actor = new St.ScrollView({
			x_fill: true,
			y_fill: true,
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE,
			x_expand: true,
			y_expand: true,
//			style_class: 'vfade', //FIXME ??
			hscrollbar_policy: Gtk.PolicyType.NEVER,
		});
	
		this._content = new St.BoxLayout({
			style_class: 'search-section-content convenient-files-list list-search-results', // FIXME ?
			vertical: true,
			x_expand: true, 
		});
		this.actor.add_actor(this._content);
		this._buildRecents();
		this.conhandler = RECENT_MANAGER.connect('changed', this._redisplay.bind(this));
		
		Extension.SETTINGS.connect('changed::blacklist-recent', this._redisplay.bind(this));
	},
	
	_redisplay: function() {
		this._content.destroy_all_children(); //XXX
		this._buildRecents();
	},
	
	_buildRecents: function() {
		/* inspired by the code from RecentItems@bananenfisch.net */
		let allRecentFiles = RECENT_MANAGER.get_items();
		allRecentFiles.sort(trierDate);
		
		let blacklistList = Extension.SETTINGS.get_strv('blacklist-recent').toString();
		this._files = [];
		
		var i = 0;
		let shouldContinue = true;
		while(this._files.length < Extension.SETTINGS.get_int('number-of-recent-files') && shouldContinue) {
			if(allRecentFiles[i] == null || allRecentFiles[i] == undefined) {
				shouldContinue = false;
			} else {
				let itemtype = allRecentFiles[i].get_mime_type();
				if ((blacklistList.indexOf((itemtype.split("/"))[0]) == -1) && (allRecentFiles[i].exists())){
					let gicon = Gio.content_type_get_icon(itemtype);
					/*améliorable ? Gio.File.new_for_uri(****).query_info('standard::(((symbolic-)))icon', 0, null); */
					this._files.push(new RecentFileButton(
						gicon,
						allRecentFiles[i].get_display_name(),
						allRecentFiles[i].get_uri()
					));
					this._content.add( this._files[this._files.length -1].actor );
				}
			}
			i++;
		}
	},
	
	filter_widget: function(text) {
		if (Extension.SETTINGS.get_boolean('search-in-path')) {
			this._files.forEach(function(f){
				f.actor.visible = f.displayedPath.toLowerCase().includes(text) || f.label.toLowerCase().includes(text);
			});
		} else {
			this._files.forEach(function(f){
				f.actor.visible = f.label.toLowerCase().includes(text);
			});
		}
	},
	
	destroy() {
//		RECENT_MANAGER.disconnect(this.conhandler);
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

		// Chain our visibility and lifecycle to that of the source // FIXME
//		source.actor.connect('notify::mapped', () => {
//			if (!source.actor.mapped) {
//				this.close();
//			}
//		});
		source.actor.connect('destroy', this.destroy.bind(this));

		Main.uiGroup.add_actor(this.actor);
	},

	_redisplay: function() {
		this.removeAll();

		this._appendMenuItem(_("Open") + " " + this._source.label).connect('activate', this._onOpen.bind(this));
		//this._appendMenuItem(_("Open with")).connect('activate', this._onOpenWith.bind(this));
		this._appendSeparator();
		this._appendMenuItem(_("Open parent folder")).connect('activate', this._onParent.bind(this));
		if(this._source.path != null) {
			this._appendMenuItem(_("Copy path")).connect('activate', this._onCopyPath.bind(this));
		}
		this._appendSeparator();
		this._appendMenuItem(_("Remove from the list")).connect('activate', this._onRemove.bind(this));
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
		RECENT_MANAGER.remove_item(this._source.uri);
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


