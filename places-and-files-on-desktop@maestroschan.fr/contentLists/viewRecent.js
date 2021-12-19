'use strict';

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Signals = imports.signals;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Extension = Me.imports.extension;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

var RECENT_MANAGER;

//------------------------------------------------------------------------------

function trierDate(x,y) {
	return y.get_modified() - x.get_modified();
}

function trierNom(l,r) {
	return l.get_display_name().localeCompare(r.get_display_name());
}

//------------------------------------------------------------------------------

// This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
var RecentFileButton = class RecentFileButton {
	constructor (icon, label, uri) {
		this.icon = new St.Icon({
			gicon: icon,
			style_class: 'popup-menu-icon',
			icon_size: Extension.SETTINGS.get_int('icon-size')
		});
		this.uri = uri;
		let file = Gio.File.new_for_uri(this.uri);
		let displayedPath = this.truncatePath(file.get_path());
		
		this.actor = new St.Button({
			reactive: true,
			can_focus: true,
			track_hover: true,
			x_align: St.Align.START,
			x_fill: true,
			y_fill: true,
			style_class: 'list-search-result',
		});
		// XXX ?? is it useful to remember the signal to disconnect it ?
		this.signal = this.actor.connect('button-press-event', this._onButtonPress.bind(this));
		
		this._menu = null;
		this._menuManager = new PopupMenu.PopupMenuManager(this.actor);
		
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
		
		if (icon) {
			titleBox.add(this.icon);
		}
		
		let title = new St.Label({ text: label });
		titleBox.add(title, {
			x_fill: false,
			y_fill: false,
			x_align: St.Align.START,
			y_align: St.Align.MIDDLE
		});
		
		this.actor.label_actor = title;
		
		if (this.uri) {
			let descriptionLabel = new St.Label({
				style_class: 'list-search-result-description',
				text: displayedPath
			});
			content.add(descriptionLabel, {
				x_fill: false,
				y_fill: false,
				x_align: St.Align.START,
				y_align: St.Align.MIDDLE
			});
		}
		
		this.searchableLabel = label.toLowerCase();
		this.searchablePath = displayedPath.toLowerCase();
	}

	_onButtonPress (actor, event) {
		let button = event.get_button();
		if (button == 1) {
			this.activate();
		} else if (button == 3) {
			this.popupMenu();
			return Clutter.EVENT_STOP;
		}
		return Clutter.EVENT_PROPAGATE;
	}

	truncatePath (actualPath) {
		let retValue = '';
		if(actualPath == null) {
			retValue = this.uri;
		} else {
			let temp = actualPath.split('/');
			for(var i = 0; i < temp.length-1; i++){
				retValue += temp[i] + '/';
			}
			let home = GLib.get_home_dir();
			let a = '';
			if(retValue.substr(0, home.length) == home){
				a = '~' + retValue.substr(home.length, retValue.length);
				retValue = a;
			}
		}
		return retValue;
	}

	activate () {
		Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context(0, -1));
	}

	_onMenuPoppedDown () {
		this.actor.sync_hover();
		this.emit('menu-state-changed', false);
	}

	popupMenu () {
		this.actor.fake_release();
		if (!this._menu) {
			this._menu = new RecentFileMenu(this, this.actor, this.uri);
			this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
				if (!isPoppedUp) {
					this._onMenuPoppedDown();
				}
			});
			this._menuManager.addMenu(this._menu);
		}
		this.emit('menu-state-changed', true);
		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();
		return false;
	}

	matchSearch (text, withPath) {
		if (withPath) {
			this.actor.visible = this.searchablePath.includes(text) || this.searchableLabel.includes(text);
		} else {
			this.actor.visible = this.searchableLabel.includes(text);
		}
	}

	destroy () {
		this._menu = null;
		this._menuManager = null;
		
		this.actor.disconnect(this.signal); // XXX probably useless
		this.actor.destroy();
		this.actor = null;
		
		this.uri = null;
		this.searchableLabel = null;
		this.searchablePath = null;
	}
};
Signals.addSignalMethods(RecentFileButton.prototype);

//This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
var RecentFilesList = class RecentFilesList {
	constructor () {
		this.actor = new St.ScrollView({
			x_fill: true,
			y_fill: true,
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE,
			x_expand: true,
			y_expand: true,
//			style_class: 'vfade', //FIXME ??
			hscrollbar_policy: Gtk.PolicyType.NEVER
		});
		
		this._content = new St.BoxLayout({
			style_class: 'search-section-content convenient-files-list list-search-results',
			vertical: true,
			x_expand: true
		});
		
		this.conhandler = RECENT_MANAGER.connect('changed', this._redisplay.bind(this));
		Extension.SETTINGS.connect('changed::blacklist-recent', this._redisplay.bind(this));
		
		this.actor.add_actor(this._content);
		this._buildRecents();
	}

	_removeAll () {
//		this._content.destroy_all_children(); //XXX would destroy actors only
		this._content.remove_all_children();
		this._files.forEach(function(f){
				f.destroy();
				delete f.actor; // XXX probably an overkill
				f = null;
			});
		this._files = null; // XXX probably an overkill
		this._files = [];
	}
	
	_redisplay () {
		this._removeAll();
		this._buildRecents();
	}

	_buildRecents () {
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
				let isCorrectMime = (blacklistList.indexOf((itemtype.split("/"))[0]) == -1);
				if (isCorrectMime && allRecentFiles[i].exists()) {
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
	}

	filter_widget (text) {
		let searchInPath = Extension.SETTINGS.get_boolean('search-in-path');
		this._files.forEach(function(f){
			f.matchSearch(text, searchInPath);
		});
	}

	destroy() {
//		RECENT_MANAGER.disconnect(this.conhandler);
		this._removeAll();
		this.actor.destroy();
	}
};

var RecentFileMenu = class RecentFileMenu extends PopupMenu.PopupMenu {
	constructor (source, source_actor, uri) {
		let side = St.Side.BOTTOM;
		if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
			side = St.Side.TOP;
		super(source_actor, 0.5, side);
		this.blockSourceEvents = true; // We want to keep the item hovered while the menu is up
		this.actor.add_style_class_name('app-well-menu');

		// Chain our visibility and lifecycle to that of the source // FIXME
//		source.actor.connect('notify::mapped', () => {
//			if (!source.actor.mapped) {
//				this.close();
//			}
//		});
		source_actor.connect('destroy', this.destroy.bind(this));

		Main.uiGroup.add_actor(this.actor);
		
		this._source = source;
		this._source_uri = uri;
	}
	
	_addSimpleMenuItem (label, callback) {
		this._appendMenuItem(label).connect('activate', callback.bind(this));
	}

	_redisplay () {
		this.removeAll();

		this._addSimpleMenuItem(_("Open"), this._onOpen);
		//this._appendMenuItem(_("Open with")).connect('activate',
		//                     this._onOpenWith.bind(this)); // TODO submenu
		this._appendSeparator();
		this._addSimpleMenuItem(_("Open parent folder"), this._onParent);
		if(this._source_uri != null) { //XXX pas sûr de moi
			this._addSimpleMenuItem(_("Copy path"), this._onCopyPath);
		}
		this._appendSeparator();
		this._addSimpleMenuItem(_("Remove from the list"), this._onRemove);
	}

	_onParent () {
		Gio.app_info_launch_default_for_uri( this._folderUri(),
		                              global.create_app_launch_context(0, -1) );
	}

	_folderUri () {
		let temp = this._source_uri.split('/');
		let temp2 = '';
		
		for(var i = 0; i < temp.length; i++){
			if (i != temp.length-1) {
				temp2 += temp[i] + '/';
			}
		}
		return temp2;
	}

	_onCopyPath () {
		let file = Gio.File.new_for_uri(this._source_uri);
		Clipboard.set_text(CLIPBOARD_TYPE, file.get_path());
	}

	_onOpen () {
		this._source.activate();
	}

	_onOpenWith () {
		//TODO
	}

	_onRemove () {
		RECENT_MANAGER.remove_item(this._source_uri);
	}

	_appendSeparator () {
		let separator = new PopupMenu.PopupSeparatorMenuItem();
		this.addMenuItem(separator);
	}

	_appendMenuItem (labelText) {
		let item = new PopupMenu.PopupMenuItem(labelText);
		this.addMenuItem(item);
		return item;
	}

	popup (activatingButton) {
		this._redisplay();
		this.open();
	}
};
Signals.addSignalMethods(RecentFileMenu.prototype);

//------------------------------------------------------------------------------

