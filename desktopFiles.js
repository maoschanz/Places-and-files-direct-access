const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
//const Gtk = imports.gi.Gtk;
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

//-------------------------------------------------

function trierNom(l,r) {
	return l.get_display_name().localeCompare(r.get_display_name());
}

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
		this._container = new St.BoxLayout({ style_class: 'search-section-content convenient-files-list' });
		this._content = new St.BoxLayout({
			style_class: 'list-search-results',
			vertical: true,
		});
		this._container.add(this._content, { expand: true });
		this._resultDisplayBin.set_child(this._container);
		this._initDirectory();
		this._buildFiles();
	},
	
	_redisplay: function() {
		this._content.destroy_all_children();
		this._buildFiles();
	},
	
	_initDirectory: function () {		
		this._directory = Gio.file_new_for_path(
			GLib.get_user_special_dir(
				GLib.UserDirectory.DIRECTORY_DESKTOP
			)
		);
		
		this._monitor = this._directory.monitor(Gio.FileMonitorFlags.SEND_MOVED, null);
		
		this._updateSignal = this._monitor.connect('changed', Lang.bind(this, this._redisplay));
	},
	
	_buildFiles: function() {
		let children = this._directory.enumerate_children('*', 0, null);
		
		this._files = [];
		
		let files = [];
		let dirs = [];
		let file_info = null;
		while ((file_info = children.next_file(null)) !== null) {
			if (file_info.get_is_hidden()) {
				continue;
			}
			if (Gio.FileType.DIRECTORY == file_info.get_file_type()){
				dirs.push(file_info);
			} else {
				files.push(file_info);
			}
		}
		children.close(null);

		dirs.sort(trierNom);
		dirs.forEach(Lang.bind(this, function(fi) {
			let f = new DesktopFileButton(fi);
			this._files.push(f);
			this._content.add( f.actor );
		}));
		files.sort(trierNom);
		files.forEach(Lang.bind(this, function(fi) {
			let f = new DesktopFileButton(fi);
			this._files.push(f);
			this._content.add( f.actor );
		}));
	},
	
	filter_widget: function(text) {
		this._files.forEach(function(f){
			f.actor.visible = f.label.toLowerCase().includes(text);
		});
	},
	
	destroy() {
		this._monitor.disconnect(this._updateSignal);
		this.parent();
	},
});

//--------------------------------------------------------

/*
This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
*/
var DesktopFileButton = new Lang.Class({
	Name: 'DesktopFileButton',
	
	_init: function(info) {
		this._info = info;
		this.label = this._info.get_display_name();
		this.icon = new St.Icon({
			gicon: this._info.get_icon(),
			style_class: 'popup-menu-icon', 
			icon_size: Extension.SETTINGS.get_int('recent-files-icon-size')
		});
		
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

		if (this.icon) titleBox.add(this.icon);

		let title = new St.Label({ text: this.label });
		titleBox.add(title, {
			x_fill: false,
			y_fill: false,
			x_align: St.Align.START,
			y_align: St.Align.MIDDLE
		});

		this.actor.label_actor = title;
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
	
	activate: function () {
		Gio.app_info_launch_default_for_uri(
			'file://' + GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) + '/' + this._info.get_name(),
			global.create_app_launch_context(0, -1)
		);
	},
	
	_onExecute: function () {
		Util.trySpawnCommandLine(
			'"' + GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)
			+ '/' + this._info.get_name() + '"'
		);
	},
	
	_onLauncher: function () {
		let f = Gio.DesktopAppInfo.new_from_filename(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) + '/' + this._info.get_name());
		let command = f.get_string("Exec");
		Util.trySpawnCommandLine(command);
	},
	
	_onMenuPoppedDown: function () {
		this.actor.sync_hover();
		this.emit('menu-state-changed', false);
	},
	
	popupMenu: function () {
		this.actor.fake_release();

		if (!this._menu) {
			this._menu = new DesktopFileButtonMenu(this);
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
	
	hide: function () {
		this.actor.visible = false;
	},
	
	show: function () {
		this.actor.visible = true;
	},
	
	destroy: function() {
		this.actor.disconnect(this._connexion2);
		this._menu.disconnect(this._connexion);
		this.parent();
	},
});
Signals.addSignalMethods(DesktopFileButton.prototype);

const DesktopFileButtonMenu = new Lang.Class({
	Name: 'DesktopFileButtonMenu',
	Extends: PopupMenu.PopupMenu,

	_init: function(source) {
		let side = St.Side.BOTTOM;
		if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
			side = St.Side.TOP;

		this.parent(source.actor, 0.5, side);

		// We want to keep the item hovered while the menu is up
		this.blockSourceEvents = true;

		this._source = source;
		this._path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) + '/' + this._source._info.get_name();
		this._file = Gio.file_new_for_path(this._path);
		
		this.actor.add_style_class_name('app-well-menu');

		// Chain our visibility and lifecycle to that of the source
		source.actor.connect('notify::mapped', Lang.bind(this, function () {
			if (!source.actor.mapped)
				this.close();
		}));
		source.actor.connect('destroy', Lang.bind(this, this.destroy));

		Main.uiGroup.add_actor(this.actor);
	},

	_redisplay: function() {
		this.removeAll();

		this._appendMenuItem(_("Open")).connect('activate', Lang.bind(this, this._onOpen));
		this._appendMenuItem(_("Execute")).connect('activate', Lang.bind(this, this._onExecute));
		
		this._appendSeparator(); //----------------------------

		this._appendMenuItem(_("Open parent folder")).connect('activate', Lang.bind(this, this._onParent));
		
		this._appendSeparator(); //----------------------------
		
//		this._appendMenuItem(_("Copy")).connect('activate', Lang.bind(this, this._onCopy)); // FIXME can't work ?
		this._addRenameEntryAndButtons();
		this._appendMenuItem(_("Delete")).connect('activate', Lang.bind(this, this._onDelete));
	},
	
	_onParent: function() {
		let uri = Gio.file_new_for_path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)).get_uri();
		Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context(0, -1));
	},
	
	_onRename: function() {
		this.renameItem.actor.visible = false;
		this.renameEntryItem.actor.visible = true;
	
		global.stage.set_key_focus(this.entry);
	},
	
	_addRenameEntryAndButtons: function() {
		this.renameItem = new PopupMenu.PopupBaseMenuItem({
			reactive: true,
			activate: true,
			hover: true,
			style_class: null,
			can_focus: false
		});
		let renameItemButton = new St.Button({
			label: _("Rename")
		});
		this.renameItem.actor.add( renameItemButton );
		
		this.renameEntryItem = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: true,
			hover: true,
			style_class: null,
			can_focus: false
		});
		
		this.entry = new St.Entry({
			hint_text: _('Type a name...'),
			track_hover: true,
			x_expand: true,
			secondary_icon: new St.Icon({
				icon_name: 'ok-symbolic',
				icon_size: 16,
				style_class: 'system-status-icon',
				y_align: Clutter.ActorAlign.CENTER,
			}),
		});
		
		this.renameEntryItem.actor.add( this.entry );
		
		this.addMenuItem(this.renameItem);
		this.addMenuItem(this.renameEntryItem);
		
		renameItemButton.connect('clicked', Lang.bind(this, this._onRename));
		this.entry.connect('secondary-icon-clicked', Lang.bind(this, this._actuallyRename));
		
		this.renameEntryItem.actor.visible = false;
	},	
		
	_actuallyRename: function() {
		this._file.set_display_name(this.entry.get_text(), null);
	},	
	
	_onDelete: function(){
		this._file.trash(null); //FIXME confirmation
	},
	
	_onCopy: function(){
//		Clipboard.set_text(CLIPBOARD_TYPE, this._path);
		//TODO
	},
	
	_onExecute: function() {
		if(this._source._info.get_content_type() == 'application/x-desktop') {
			this._source._onLauncher();
		} else {
			this._source._onExecute();
		}
	},
	
	_onOpen: function() {
		this._source.activate();
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
Signals.addSignalMethods(DesktopFileButtonMenu.prototype);




