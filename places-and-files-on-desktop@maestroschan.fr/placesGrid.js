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
const IconGrid = imports.ui.iconGrid;
const ShellMountOperation = imports.ui.shellMountOperation;
const Shell = imports.gi.Shell;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Extension = Me.imports.extension;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

var PLACES_MANAGER;

//-------------------------------------------------

const PlaceButton = new Lang.Class({
	Name: 'PlaceButton',
	
	_init: function( info, category ){
		this._info = info;
		this._category = category;
		
		this.actor = new St.Button({ style_class: 'app-well-app',
			reactive: true,
			button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO,
			can_focus: true,
			x_fill: true,
			y_fill: true,
		});
		
		this.placeIcon = new PlaceIcon(this._info);
		this.actor.set_child( this.placeIcon.actor );
		
		if (this._info.name == _("Trash")) {
			this._directory = Gio.file_new_for_uri("trash:///");
			
//			this._monitor = this._directory.monitor(Gio.FileMonitorFlags.SEND_MOVED, null);
//			this._updateSignal = this._monitor.connect('changed', this.update.bind(this));
		}
		
		this.actor.connect('button-press-event', this._onButtonPress.bind(this));
		this._menu = null;
		this._menuManager = new PopupMenu.PopupMenuManager(this);
	},
	
	update: function() {
		this.placeIcon.update();
	},
	
	_onClicked: function() {
		this.placeIcon.animateZoomOut();
		Util.trySpawnCommandLine('nautilus ' + this._info.file.get_uri());
		//FIXME the "normal" method doesn't understand the trash, so this has to stay commented.
//		Gio.app_info_launch_default_for_uri(this._info.file.get_uri(),
//		                               global.create_app_launch_context(0, -1));
	},
	
	_onMenuPoppedDown: function() {
		this.actor.sync_hover();
		this.emit('menu-state-changed', false);
	},
	
	popupMenu: function() {
		this.actor.fake_release();

		if (!this._menu) {
			this._menu = new PlaceButtonMenu(this);
			this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
				if (!isPoppedUp) this._onMenuPoppedDown();
			});
			this._menuManager.addMenu(this._menu);
		}

		this.emit('menu-state-changed', true);
		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();
		return false;
	},
	
	_onButtonPress: function(actor, event) {
		let button = event.get_button();
		if (button == 1) {
			this._onClicked();
		} else if (button == 3) {
			this.popupMenu();
			return Clutter.EVENT_STOP;
		}
		return Clutter.EVENT_PROPAGATE;
	},

	destroy: function() {
//		if (this._info.name == _("Trash")) {	
//			this._monitor.disconnect(this._updateSignal);
//		}
		this.parent();
	},
});
Signals.addSignalMethods(PlaceButton.prototype);

const PlaceButtonMenu = new Lang.Class({
	Name: 'PlaceButtonMenu',
	Extends: PopupMenu.PopupMenu,

	_init: function(source) {
		let side = St.Side.LEFT;
		if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
			side = St.Side.RIGHT;

		this.parent(source.actor, 0.5, side);

		// We want to keep the item hovered while the menu is up
		this.blockSourceEvents = true;

		this._source = source;
		this.actor.add_style_class_name('app-well-menu');

		// Chain our visibility and lifecycle to that of the source //XXX
		source.actor.connect('notify::mapped', () => {
			if (!source.actor.mapped) this.close();
		});
		source.actor.connect('destroy', this.destroy.bind(this));

		Main.uiGroup.add_actor(this.actor);
	},

	_redisplay: function() {
		this.removeAll();
		
		//TODO %s
		this._appendMenuItem(_("Open") + " " + this._source._info.name).connect(
		                                'activate', this._onClicked.bind(this));
		
		let couldBeRemoved = this._source._category == 'bookmarks';
		if(couldBeRemoved) {
			this._appendSeparator();
			this._addRenameEntryAndButtons();
			this._appendMenuItem(_("Remove")).connect('activate', this._onRemove.bind(this));
		}
		
		let couldBeEjected = (this._source._info._mount && this._source._info._mount.can_eject());
		let couldBeUnmount = (this._source._info._mount && this._source._info._mount.can_unmount());
		
		if(couldBeEjected || couldBeUnmount){
			this._appendSeparator();
		}
		if(couldBeEjected){
			this._appendMenuItem(_("Eject")).connect('activate', this._onEject.bind(this));
		}
		if(couldBeUnmount){
			this._appendMenuItem(_("Unmount")).connect('activate', this._onUnmount.bind(this));
		}
		
		if( this._source._info.name == _("Trash") ){
			this._appendSeparator();
			this._appendMenuItem(_("Empty")).connect('activate',
			                                     this._onEmptyTrash.bind(this));
		}

		if( this._source._info.name == _("Recent Files") ){
			this._appendSeparator();
			this._appendMenuItem(_("Clear")).connect('activate',
			                                    this._onEmptyRecent.bind(this));
		}
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
			hint_text: _('Type a name…'),
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
		
		renameItemButton.connect('clicked', this._onRename.bind(this));
		this.entry.connect('secondary-icon-clicked', this._actuallyRename.bind(this));
		
		this.renameEntryItem.actor.visible = false;
	},	
		
	_actuallyRename: function() {
		let content = Shell.get_file_contents_utf8_sync(
		                              PLACES_MANAGER._bookmarksFile.get_path());
		let lines = content.split('\n');

		let currentUri = this._source._info.file.get_uri();
		
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			let components = line.split(' ');

			if (currentUri == components[0]) {
				lines[i] = components[0] + " " + this.entry.get_text();
			}
		}
		content = '';
		for(var i = 0; i< lines.length; i++){
			content += lines[i] + '\n';
		}
		GLib.file_set_contents(PLACES_MANAGER._bookmarksFile.get_path(), content);
		this.emit('bookmarks-updated');
	},
	
	_onRemove: function() {
		let content = Shell.get_file_contents_utf8_sync(
		                              PLACES_MANAGER._bookmarksFile.get_path());
		let lines = content.split('\n');

		let currentUri = this._source._info.file.get_uri();
		
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			let components = line.split(' ');

			if (!components[0] || currentUri == components[0]) {
				lines.splice(i, 1);
			}
		}
		content = '';
		for(var i = 0; i< lines.length; i++){
			content += lines[i] + '\n';
		}
		GLib.file_set_contents(PLACES_MANAGER._bookmarksFile.get_path(), content);
		this.emit('bookmarks-updated');
	},
	
	_onUnmount: function() {
		let mountOp = new ShellMountOperation.ShellMountOperation(this._source._info._mount);

		if (this._source._info._mount.can_unmount()) {
			this._source._info._mount.eject_with_operation(Gio.MountUnmountFlags.NONE,
			                                      mountOp.mountOp, null, // Gio.Cancellable
			                                      this._ejectFinish.bind(this));
		} else {
			this._source._info._mount.unmount_with_operation(Gio.MountUnmountFlags.NONE,
				                                 mountOp.mountOp, null, // Gio.Cancellable
				                                 this._unmountFinish.bind(this));
		}
	},
	
	_onEject: function() {
		let mountOp = new ShellMountOperation.ShellMountOperation(this._source._info._mount);

		if (this._source._info._mount.can_eject()) {
			this._source._info._mount.eject_with_operation(Gio.MountUnmountFlags.NONE,
				                                  mountOp.mountOp, null, // Gio.Cancellable
				                                  this._ejectFinish.bind(this));
		} else {
			this._source._info._mount.unmount_with_operation(Gio.MountUnmountFlags.NONE,
				                                mountOp.mountOp, null, // Gio.Cancellable
				                                this._unmountFinish.bind(this));
		}
	},

	_unmountFinish: function(mount, result) {
		try {
			mount.unmount_with_operation_finish(result);
		} catch(e) {
			this._reportFailure(e);
		}
	},

	_ejectFinish: function(mount, result) {
		try {
			mount.eject_with_operation_finish(result);
		} catch(e) {
			this._reportFailure(e);
		}
	},
	
	_onEmptyTrash: function() {
		//code from gnome-shell-trash-extension, by Axel von Bertoldi (https://github.com/bertoldia/gnome-shell-trash-extension)
		let trash_file = Gio.file_new_for_uri("trash:///");
		
		let children = trash_file.enumerate_children('*', 0, null);
		let child_info = null;
		while ((child_info = children.next_file(null)) != null) {
			let child = trash_file.get_child(child_info.get_name());
			child.delete(null);
		}
	},
	
	_onEmptyRecent: function() {
		RECENT_MANAGER.purge_items();
	},
	
	_onClicked: function() {
		this._source._onClicked();
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
Signals.addSignalMethods(PlaceButtonMenu.prototype);

//--------------------------

var PlacesList = new Lang.Class({
	Name: 'PlacesList',
	
	_init: function() {
		this.actor = new St.ScrollView({
			x_fill: true,
			y_fill: true,
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE,
			x_expand: true,
			y_expand: true,
			style_class: 'vfade', //lui bug moins ? FIXME
			hscrollbar_policy: Gtk.PolicyType.NEVER,
		});
		
		this.grid = new PlacesGrid();
		this.actor.add_actor(this.grid.actor);
	},
	
	filter_widget: function(text) {
		/* TODO ? */
	},
	
	// destroy: function() {},
	
});

const PlacesGrid = new Lang.Class({
	Name: 'PlacesGrid',
	Extends: IconGrid.IconGrid,
	
	_init: function() {
		this.parent();
		this.actor.style_class = 'places-grid';
		let monitor = Main.layoutManager.primaryMonitor;

		this._placesItem = new Array();
		PLACES_MANAGER.connect('special-updated', this.redisplay.bind(this));
		PLACES_MANAGER.connect('devices-updated', this.redisplay.bind(this));
		PLACES_MANAGER.connect('network-updated', this.redisplay.bind(this));
		PLACES_MANAGER.connect('bookmarks-updated', this.redisplay.bind(this));
		this.buildItems();
	},
	
	//This is a fork of extension.js from places-menu@gnome-shell-extensions.gcampax.github.com 
	buildItems: function() {
		this._places = {
			special: [],
			devices: [],
			bookmarks: [],
			network: [],
		};
		this.buildCategory('special');
		this.buildCategory('devices');
		this.buildCategory('bookmarks');
		this.buildCategory('network');
		for(var i = 0; i < this._placesItem.length; i++) {
			this.addItem(this._placesItem[i]);
		}
	},
	
	buildCategory: function(id) { 
		let places = PLACES_MANAGER.get(id);
		for (let i = 0; i < places.length; i++){
			this._placesItem.push( new PlaceButton(places[i], id) );
		}
	},
	
	redisplay: function(){
		this._placesItem = []
		this.removeAll();
		this.buildItems();
	},
});

const PlaceIcon = new Lang.Class({
	Name: 'PlaceIcon',
	Extends: IconGrid.BaseIcon,
	
	_init: function(info) {
		this._info = info;
		this.parent( this._info.name );
		this.label.style_class = 'place-label';
	},
	
	createIcon: function() {
		return (new St.Icon({
			gicon: this._info.icon,
			icon_size: Extension.SETTINGS.get_int('places-icon-size')
		}));
	},
	
	update: function() {
		PLACES_MANAGER._updateSpecials();
		this.createIcon();
	},
});

//-------------------------------------------------------
