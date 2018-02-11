const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const AppDisplay = imports.ui.appDisplay;
const PopupMenu = imports.ui.popupMenu;
const IconGrid = imports.ui.iconGrid;
const ShellEntry = imports.ui.shellEntry;
const Shell = imports.gi.Shell;
const Gtk = imports.gi.Gtk;
const Util = imports.misc.util;

const Mainloop = imports.mainloop;

const ShellMountOperation = imports.ui.shellMountOperation;

const Signals = imports.signals;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const PlaceDisplay = Me.imports.placeDisplay;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

//-------------------------------------------------

function init() {
	Convenience.initTranslations();
}

//-------------------------------------------------
/* do not edit this section */

function injectToFunction(parent, name, func) {
	let origin = parent[name];
	parent[name] = function() {
		let ret;
		ret = origin.apply(this, arguments);
			if (ret === undefined)
				ret = func.apply(this, arguments);
			return ret;
		}
	return origin;
}

function removeInjection(object, injection, name) {
	if (injection[name] === undefined)
		delete object[name];
	else
		object[name] = injection[name];
}

let injections=[];

//--------------------------------------------------------------

let SETTINGS;

const PlaceIcon = new Lang.Class({
	Name: 'PlaceIcon',
	Extends: IconGrid.BaseIcon,
	
	_init: function(info) {
		this.parent(
			info.name,
			{ createIcon:
				Lang.bind(this, function() {
					return (new St.Icon({
						gicon: info.icon,
						icon_size: SETTINGS.get_int('places-icon-size')
					}));
				})
			}
		);
		
//		this.height = SETTINGS.get_int('places-icon-size') + 4;
//		this.width = SETTINGS.get_int('places-icon-size') + 4;
		this.label.style_class = 'place-label';
	},
});

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
		
		this.actor.set_child( new PlaceIcon(this._info).actor );
		
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        
		//----------------
		
		this._menu = null;
        this._menuManager = new PopupMenu.PopupMenuManager(this);
		
	},
	
	_onClicked: function() {
		Util.trySpawnCommandLine('nautilus ' + this._info.file.get_uri()); //FIXME
	},
	
	_onMenuPoppedDown: function() {
        this.actor.sync_hover();
        this.emit('menu-state-changed', false);
    },
    
	popupMenu: function() {
        this.actor.fake_release();

        if (!this._menu) {
            this._menu = new PlaceIconMenu(this);
            this._menu.connect('open-state-changed', Lang.bind(this, function (menu, isPoppedUp) {
                if (!isPoppedUp)
                    this._onMenuPoppedDown();
            }));

            this._menuManager.addMenu(this._menu);
        }

        this.emit('menu-state-changed', true);

        this.actor.set_hover(true);
        this._menu.popup();
        this._menuManager.ignoreRelease();
//        this.emit('sync-tooltip');

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
    
	
});
Signals.addSignalMethods(PlaceButton.prototype);

const PlaceIconMenu = new Lang.Class({
    Name: 'PlaceIconMenu',
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

		this._appendMenuItem(_("Open")).connect('activate', Lang.bind(this, this._onClicked));
		
		let couldBeRemoved = this._source._category == 'bookmarks';
		if(couldBeRemoved) {
			this._appendSeparator();
//			this._appendMenuItem(_("Rename")).connect('activate', Lang.bind(this, this._onRename)); //TODO
			this._appendMenuItem(_("Remove")).connect('activate', Lang.bind(this, this._onRemove));
		}
		
		let couldBeEjected = (this._source._info._mount && this._source._info._mount.can_eject());
		let couldBeUnmount = (this._source._info._mount && this._source._info._mount.can_unmount());
		
		if(couldBeEjected || couldBeUnmount){
			this._appendSeparator();
		}
		if(couldBeEjected){
			this._appendMenuItem(_("Eject")).connect('activate', Lang.bind(this, this._onEject));
		}
		if(couldBeUnmount){
			this._appendMenuItem(_("Unmount")).connect('activate', Lang.bind(this, this._onUnmount));
		}
		
//		if( this._source._info.name == _("Trash") ){ //TODO
//			this._appendSeparator();
//			this._appendMenuItem(_("Empty")).connect('activate', Lang.bind(this, this._onEmpty));
//		}
    },
	
	_onRename: function() {
		//TODO ?
	},
	
	_onRemove: function() {

        let content = Shell.get_file_contents_utf8_sync(PLACES_MANAGER._bookmarksFile.get_path());
        let lines = content.split('\n');

        let currentUri = this._source._info.file.get_uri();
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let components = line.split(' ');

			if (!components[0] || currentUri == components[0]) {
				lines.splice(i, 1);
			} else {
				//rien ??
			}
        }
        
        content = '';
        for(var i = 0; i< lines.length; i++){
	        content += lines[i] + '\n';
		}
		
		GLib.file_set_contents(PLACES_MANAGER._bookmarksFile.get_path(), content);
		
        this.emit('bookmarks-updated'); // FIXME??
    },
	
	_onUnmount: function() {
		let mountOp = new ShellMountOperation.ShellMountOperation(this._source._info._mount);

		if (this._source._info._mount.can_unmount())
			this._source._info._mount.eject_with_operation(Gio.MountUnmountFlags.NONE,
                                            mountOp.mountOp,
					    null, // Gio.Cancellable
					    Lang.bind(this, this._ejectFinish));
		else
			this._source._info._mount.unmount_with_operation(Gio.MountUnmountFlags.NONE,
		                                          mountOp.mountOp,
					                  null, // Gio.Cancellable
					                  Lang.bind(this, this._unmountFinish));
	
	},
	
	_onEject: function() {
        let mountOp = new ShellMountOperation.ShellMountOperation(this._source._info._mount);

		if (this._source._info._mount.can_eject())
			this._source._info._mount.eject_with_operation(Gio.MountUnmountFlags.NONE,
                                            mountOp.mountOp,
					    null, // Gio.Cancellable
					    Lang.bind(this, this._ejectFinish));
		else
			this._source._info._mount.unmount_with_operation(Gio.MountUnmountFlags.NONE,
		                                          mountOp.mountOp,
					                  null, // Gio.Cancellable
					                  Lang.bind(this, this._unmountFinish));
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
	
	_onEmpty: function() {
		
	},
	
	_onClicked: function() {
		this._source._onClicked();
	},
	
    _appendSeparator: function () {
        let separator = new PopupMenu.PopupSeparatorMenuItem();
        this.addMenuItem(separator);
    },

    _appendMenuItem: function(labelText) {
        // FIXME: app-well-menu-item style
        let item = new PopupMenu.PopupMenuItem(labelText);
        this.addMenuItem(item);
        return item;
    },

    popup: function(activatingButton) {
        this._redisplay();
        this.open();
    },
});
Signals.addSignalMethods(PlaceIconMenu.prototype);


const BookmarksGrid = new Lang.Class({
	Name: 'BookmarksGrid',
	Extends: IconGrid.IconGrid,
	
	_init: function() {
		this.parent({
//			padWithSpacing: true, // inutile ?
//			fillParent: true, // si true ça nique le scroll (???)
		});
		
		this.actor.style_class = 'places-grid';
		
		let monitor = Main.layoutManager.primaryMonitor;

		this.actor.x_expand = true;
		this.actor.y_expand = true;
		this.actor.x_fill = true;
		this.actor.y_fill = true;
//		this.actor.opacity = 255;
		this.actor.x_align = St.Align.MIDDLE;
		this.actor.y_align = St.Align.MIDDLE;
		this.actor.height = Math.floor(monitor.height * 0.9 - 10);//0.8 - 10); //FIXME pas sérieux

//		this.actor.set_position(
//			monitor.x + Math.floor(monitor.width/2) - Math.floor(this.actor.width/2),
//			monitor.y + Math.floor(monitor.height/2) - Math.floor(this.actor.height/2)
//		);
		
		//--------------
		
		this._placesItem = new Array();
		
		this.placesManager = PLACES_MANAGER;//new PlaceDisplay.PlacesManager();
		
		this.placesManager.connect('special-updated', Lang.bind(this, this.redisplay ));
		this.placesManager.connect('devices-updated', Lang.bind(this, this.redisplay ));
		this.placesManager.connect('network-updated', Lang.bind(this, this.redisplay ));
		this.placesManager.connect('bookmarks-updated', Lang.bind(this, this.redisplay));
		
		this.buildItems();
		
	},
	
	/*
	This is a fork of extension.js from places-menu@gnome-shell-extensions.gcampax.github.com 
	*/
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
		let places = this.placesManager.get(id);

		for (let i = 0; i < places.length; i++){
			this._placesItem.push( new PlaceButton(places[i], id) );
		}
	},
	
	redisplay: function(){
		this._placesItem = []
		this.removeAll();
		this.buildItems();
	},
	
		/*
		TODO 
		
		il faut ajouter un le domaine de traduction btw
		et quasi tout renommer mdrrr
		*/
	
});

//--------------------------------------

const RecentFilesHeader = new Lang.Class({
	Name: 'RecentFilesHeader',
	Extends: St.BoxLayout,
	
	_init: function(list) {
		this._list = list;		
		
		this.parent({
			vertical: false,
			style_class: 'recent-files-header',
		});
		
		this.conhandler = RECENT_MANAGER.connect('changed', Lang.bind(this, this._redisplay));
		
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

		//----------------------------		
	
		this.clearButton = new St.Button({
			child: new St.Label({
				text: _("Clear List"),
				x_expand: true,
				y_expand: true,
				y_align: Clutter.ActorAlign.CENTER,
			}),
			accessible_name: _("Clear List"),
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'button',
			reactive: true,
			can_focus: true,
			track_hover: true,
			y_expand: false,
			y_fill: true
		});
		
		this.clearButton.connect('clicked', Lang.bind(this, this._list.clearList));
		
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
		
		ShellEntry.addContextMenu(this.searchEntry, null);
		
		this.add(new St.BoxLayout({x_expand: true,}));
		this.add(this.searchEntry);
		this.add(this.settingsButton);
		this.add(this.clearButton);
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
		this._list._files.forEach(function(f){
			f.actor.visible = f.label.toLowerCase().includes(searched);
		});
	},
	
	_redisplay: function() {
		this._list._redisplay();
	},
	
	setSize: function() {
//		log('hhhhhhhh');
	},
});

/*
This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
*/
const RecentFilesList = new Lang.Class({
	Name: 'RecentFilesList',
	
	_init: function() {
		this.actor = new St.BoxLayout({ style_class: 'search-section', vertical: true, x_expand: true });

		this._resultDisplayBin = new St.Bin({ x_fill: true, y_fill: true });
		this.actor.add(this._resultDisplayBin, { expand: true });

		this._container = new St.BoxLayout({ style_class: 'search-section-content dash-label' });

		this._content = new St.BoxLayout({
			style_class: 'list-search-results',
			vertical: true,
//			style: 'background-color: rgba(0,0,0,0.3)',
		});
		this._container.add(this._content, { expand: true });

		this._resultDisplayBin.set_child(this._container);
		
		this._buildRecents();
	},
	
	clearList: function(){
		RECENT_MANAGER.purge_items();
		this._redisplay();
	},
	
	_redisplay: function() {
		this._content.destroy_all_children();
		this._buildRecents();
	},
	
	_buildRecents: function() {
		let Ritems = RECENT_MANAGER.get_items();
		let blacklistString = SETTINGS.get_string('blacklist').replace(/\s/g, ""); 
		let blacklistList = blacklistString.split(",");
		this._files = [];
		
		for(let i = 0 ; i < SETTINGS.get_int('number-of-recent-files') ; i++){
			if(Ritems[i] == null || Ritems[i] == undefined) {
				break;
			}
			let itemtype = Ritems[i].get_mime_type();
			if (blacklistList.indexOf((itemtype.split("/"))[0]) == -1) {
				
	   			let gicon = Gio.content_type_get_icon(itemtype); /*améliorable ? les file_info ont un .get_symbolic_icon() non ? */
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
		RECENT_MANAGER.disconnect(this.conhandler);
		this.parent();
	},
	
});

const RecentFilesLayout = new Lang.Class({
	Name: 'RecentFilesLayout',
	
	_init: function() {
	
		this.actor = new St.BoxLayout({
			vertical: true,
			
		});
		
		this.scrollview = new St.ScrollView({
			x_fill: true,
			y_fill: true,
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE,
			x_expand: true,
			y_expand: true,
			style_class: /*'all-apps */ 'vfade',
			hscrollbar_policy: Gtk.PolicyType.NEVER,
		});
		
		let monitor = Main.layoutManager.primaryMonitor;
		
		this.actor.width = Math.floor(monitor.width * 0.5 - Math.abs(PADDING) * 0.5);// - 200; //FIXME pas sérieux
		this.actor.height = Math.floor(monitor.height * 0.9);//200; //FIXME pas sérieux
		
		this.setScrollviewposition();
		
		let list = new RecentFilesList();
		let header = new RecentFilesHeader(list);
		
		this.actor.add(header);
		this.scrollview.add_actor(list.actor);
		this.actor.add(this.scrollview);
		header.setSize();
	},
	
	setScrollviewposition: function() {
		let monitor = Main.layoutManager.primaryMonitor;
		this.actor.set_position(
			monitor.x + Math.floor(monitor.width/2 + PADDING * 0.5),
			monitor.y + Math.floor(monitor.height/2) - Math.floor(this.actor.height/2)
		);
	},

});


/*
This class is a fork of ListSearchResult or SearchResult (in search.js version 3.26)
*/
const RecentFileButton = new Lang.Class({
	Name: 'RecentFileButton',
	
	_init: function(icon, label, uri) {
		this.icon = new St.Icon({
			gicon: icon,
			style_class: 'popup-menu-icon', 
			icon_size: SETTINGS.get_int('recent-files-icon-size')
		});
		this.label = label;
		this.uri = uri;
		this.displayedUri = this.truncate();
		
		this.actor = new St.Button({
			reactive: true,
			can_focus: true,
			track_hover: true,
			x_align: St.Align.START,
			x_fill: true,
			y_fill: true,
			style_class: 'list-search-result',
//			style: 'background-color: rgba(0,0,0,0.3)',
		});

		this.actor._delegate = this;
		this.actor.connect('clicked', Lang.bind(this, this.activate));
		
		//-------------
		
		let content = new St.BoxLayout({
			style_class: 'list-search-result-content',
			vertical: false
		});
		this.actor.set_child(content);

		this._termsChangedId = 0;

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

		let title = new St.Label({ text: this.label });
		titleBox.add(title, {
			x_fill: false,
			y_fill: false,
			x_align: St.Align.START,
			y_align: St.Align.MIDDLE
		});

		this.actor.label_actor = title;

		if (this.uri) {
			this._descriptionLabel = new St.Label({ style_class: 'list-search-result-description', text: this.displayedUri });
			content.add(this._descriptionLabel, {
				x_fill: false,
				y_fill: false,
				x_align: St.Align.START,
				y_align: St.Align.MIDDLE
			});

		}
		
	},
	
	truncate: function() {
		let temp = this.uri.split('/');
		let temp2 = "/";
	
		for(var i = 0; i < temp.length; i++){
			if ((i > 2) && (i != temp.length-1)) {
				temp2 += temp[i] + '/';
			}
		}
		return temp2;
	},
	
	activate: function() {
		Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context(0, -1));
	},
});

//-------------------------------------

let RECENT_MANAGER;
let PLACES_MANAGER;
let PADDING;

//---------------------------------------------------------------------------------------------------

function enable() {
	SETTINGS = Convenience.getSettings('org.gnome.shell.extensions.places-files-desktop');
	PLACES_MANAGER = new PlaceDisplay.PlacesManager();
	RECENT_MANAGER = new Gtk.RecentManager();
	
	let scrollview = new St.ScrollView({
		x_fill: true,
		y_fill: true,
		x_align: St.Align.MIDDLE,
		y_align: St.Align.MIDDLE,
		x_expand: true,
		y_expand: true,
		style_class: 'vfade',
		hscrollbar_policy: Gtk.PolicyType.NEVER,
	});
	
	PADDING = SETTINGS.get_int('padding');
	
	let monitor = Main.layoutManager.primaryMonitor;
	scrollview.width = Math.floor(monitor.width * 0.5 - Math.abs(PADDING) * 0.5);
	scrollview.height = Math.floor(monitor.height * 0.9);//8); //FIXME pas sérieux
	
	let tempPadding = 0;
	if(PADDING > 0) { tempPadding = PADDING; } 
	scrollview.set_position(
		monitor.x + Math.floor(tempPadding),
		monitor.y + Math.floor(monitor.height/2 - scrollview.height/2)
	);
	
	scrollview.add_actor(new BookmarksGrid().actor);
	
	Main.layoutManager._backgroundGroup.add_actor(scrollview);
	Main.layoutManager._backgroundGroup.add_actor(new RecentFilesLayout().actor);
	
}

//-------------------------------------------------

function disable() {
	
}

//-------------------------------------------------
