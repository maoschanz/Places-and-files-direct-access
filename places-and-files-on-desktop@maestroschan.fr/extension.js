// extension.js

const St = imports.gi.St;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const HeaderBox = Me.imports.headerBox;
const PlaceDisplay = Me.imports.placeDisplay;
const PlacesGrid = Me.imports.placesGrid;
const RecentFiles = Me.imports.recentFiles;
//const StarredFiles = Me.imports.starredFiles;
const DesktopFiles = Me.imports.desktopFiles;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

//-------------------------------------------------

var SETTINGS;
let PADDING = [];
let POSITION;
let SIGNAUX_OVERVIEW = [];
let SIGNAUX_PARAM = [];
let SIGNAL_MONITOR;

let MyLayout;

//------------------------------------------------

function init() {
	Convenience.initTranslations();
	
	PlacesGrid.PLACES_MANAGER = new PlaceDisplay.PlacesManager();
	RecentFiles.RECENT_MANAGER = new Gtk.RecentManager();
}

//-------------------------------------------------

/*
	This function is called when the user performs an action which affects the visibility
	of MyLayout in the case its actor has been added to the overviewGroup.
	It can be opening or closing a window, changing the current workspace, beginning a
	research, or opening the applications grid.
*/
function updateVisibility() {
	if (Main.overview.viewSelector._activePage != Main.overview.viewSelector._workspacesPage) {
		MyLayout.hide();
		return;
	}

	let gwsm;
	if (global.hasOwnProperty('screen')) { // < 3.29
		gwsm = global.screen;
	} else { // > 3.29
		gwsm = global.workspaceManager;
	}

	if (gwsm.get_workspace_by_index(gwsm.get_active_workspace_index()).list_windows() == '') {
		MyLayout.show();
	} else {
		MyLayout.hide();
	}
}

//------------------------------------------------

/*
	This function is called when the user set a new layout position. It almost corresponds to
	a "disable and then enable again", except that MyLayout isn't rebuild from its
	constructor, but is just moved to the new position.
*/
function updateLayoutLayout() {
	if (POSITION == '') {
		// do nothing
	} else if (POSITION == 'overview') {
		Main.layoutManager.overviewGroup.remove_actor(MyLayout.actor);
	} else {
		Main.layoutManager._backgroundGroup.remove_actor(MyLayout.actor);
	}
	
//	if (SIGNAUX_OVERVIEW.length != 0) { //FIXME TODO
//		if (global.hasOwnProperty('screen')) { // < 3.29
//			global.screen.disconnect(SIGNAUX_OVERVIEW[0]);
//			global.screen.disconnect(SIGNAUX_OVERVIEW[1]);
//		} else { // > 3.29
//			global.workspaceManager.disconnect(SIGNAUX_OVERVIEW[0]);
//			global.display.disconnect(SIGNAUX_OVERVIEW[1]);
//		}
//		global.window_manager.disconnect(SIGNAUX_OVERVIEW[2]);
//		Main.overview.viewSelector._showAppsButton.disconnect(SIGNAUX_OVERVIEW[3]);
//		Main.overview.viewSelector._text.disconnect(SIGNAUX_OVERVIEW[4]);
//		Main.overview.disconnect(SIGNAUX_OVERVIEW[5]);
//	}
	
	POSITION = SETTINGS.get_string('position');
	SIGNAUX_OVERVIEW = [];
	
	if (POSITION == 'overview') {
		Main.layoutManager.overviewGroup.add_actor(MyLayout.actor);
		//XXX dans ce contexte, qu'est this ?
		if (global.hasOwnProperty('screen')) { // < 3.29
			SIGNAUX_OVERVIEW[0] = global.screen.connect('notify::n-workspaces',
			                                       updateVisibility.bind(this));
			SIGNAUX_OVERVIEW[1] = global.screen.connect('restacked',
			                                       updateVisibility.bind(this));
		} else { // > 3.29
			SIGNAUX_OVERVIEW[0] = global.workspaceManager.connect(
			               'notify::n-workspaces', updateVisibility.bind(this));
			SIGNAUX_OVERVIEW[1] = global.display.connect('restacked',
			                                       updateVisibility.bind(this));
		}

		SIGNAUX_OVERVIEW[2] = global.window_manager.connect('switch-workspace',
		                                           updateVisibility.bind(this));
		SIGNAUX_OVERVIEW[3] = Main.overview.viewSelector._showAppsButton.connect(
		                        'notify::checked', updateVisibility.bind(this));
		SIGNAUX_OVERVIEW[4] = Main.overview.viewSelector._text.connect(
		                           'text-changed', updateVisibility.bind(this));
		SIGNAUX_OVERVIEW[5] = Main.overview.connect('showing',
		                                           updateVisibility.bind(this));
	} else {
		Main.layoutManager._backgroundGroup.add_actor(MyLayout.actor);
		MyLayout.show();
	}
}

//----------------------

class ConvenientLayout {
	constructor () {
		this.actor = new St.BoxLayout({ //main actor of the extension
			vertical: false,
		});
		
		this.box_0 = new St.BoxLayout({ vertical: true });
		this.box_m = new St.BoxLayout({ vertical: true });
		this.box_1 = new St.BoxLayout({ vertical: false });
		this.box_2 = new St.BoxLayout({ vertical: false });
		this.box_3 = new St.BoxLayout({ vertical: true });
		
		this.actor.add(this.box_0);
		this.box_m.add(this.box_1);
		this.box_m.add(this.box_2);
		this.actor.add(this.box_m);
		this.actor.add(this.box_3);
		
		this.active_positions = SETTINGS.get_strv('active-positions');
		this.adaptToMonitor();
	}
	
	filter_widgets (text) {
		for (let i = 0; i < this.active_widgets.length; i++) {
			this['widget_' + this.active_widgets[i]].filter_widget(text);
		}
	}

	hide () {
		this.actor.visible = false;
	}

	show () {
		this.actor.visible = true;
	}

	fill_with_widgets () {
		this.active_positions = SETTINGS.get_strv('active-positions');
		this.active_widgets = SETTINGS.get_strv('active-widgets');

		// TODO build only the useful ones
		this.widget_places = new PlacesGrid.PlacesList();
		this.widget_recent = new RecentFiles.RecentFilesList();
//		this.widget_starred = new StarredFiles.StarredFilesList();
		this.widget_desktop = new DesktopFiles.DesktopFilesList();
		this.widget_searchbar = new HeaderBox.HeaderBox(this);
		
		for (let i=0; i<this.active_widgets.length; i++) {
			this['box_' + this.active_positions[i]].add(
			                    this['widget_' + this.active_widgets[i]].actor);
		}
		
		this.adaptInternalWidgets();
	}
	
	adaptToMonitor () {
		//change global position and size of the main actor
		PADDING = [
			SETTINGS.get_int('top-padding'),
			SETTINGS.get_int('bottom-padding'),
			SETTINGS.get_int('left-padding'),
			SETTINGS.get_int('right-padding')
		];
	
		let monitor = Main.layoutManager.primaryMonitor;
		this.actor.width = Math.floor(monitor.width - (PADDING[2] + PADDING[3]));
		this.actor.height = Math.floor(monitor.height - (PADDING[0] + PADDING[1]));
		this.actor.set_position(
			monitor.x + Math.floor(PADDING[2]),
			monitor.y + Math.floor(PADDING[0])
		);
		
		this.adaptInternalWidgets();
	}
	
	adaptInternalWidgets () {
		let has0 = this.active_positions.includes('0');
		let has1 = this.active_positions.includes('1');
		let has2 = this.active_positions.includes('2');
		let has3 = this.active_positions.includes('3');
		
//		FIXME le stacking de 2 listes échoue

//		if (this.actor.width < this.actor.height) {
//			this.actor.vertical = true;
//			// TODO
//		} else {
			// XXX améliorable
			// pas touche à la hauteur de box_1 et box_2
			this.actor.vertical = false;
			this.box_0.height = this.actor.height;
			this.box_m.height = this.actor.height;
			this.box_3.height = this.actor.height;
			if (has0 && has3 && (has1 || has2)) {
				this.box_0.width = Math.floor(this.actor.width * 0.3);
				this.box_m.width = Math.floor(this.actor.width * 0.4);
				this.box_3.width = Math.floor(this.actor.width * 0.3);
			} else if (has0 && has3) {
				this.box_0.width = Math.floor(this.actor.width * 0.5);
				this.box_3.width = Math.floor(this.actor.width * 0.5);
			} else if (has0 && (has1 || has2)) {
				this.box_0.width = Math.floor(this.actor.width * 0.5);
				this.box_m.width = Math.floor(this.actor.width * 0.5);
			} else if (has3 && (has1 || has2)) {
				this.box_m.width = Math.floor(this.actor.width * 0.5);
				this.box_3.width = Math.floor(this.actor.width * 0.5);
			}
//		}
	}
};

//------------------------------------------------

function enable() {
	SETTINGS = Convenience.getSettings('org.gnome.shell.extensions.places-files-desktop');
	POSITION = '';
	PADDING = [
		SETTINGS.get_int('top-padding'),
		SETTINGS.get_int('bottom-padding'),
		SETTINGS.get_int('left-padding'),
		SETTINGS.get_int('right-padding')
	];

	MyLayout = new ConvenientLayout();
	MyLayout.fill_with_widgets();

	SIGNAUX_PARAM = [];
	SIGNAUX_PARAM[0] = SETTINGS.connect('changed::top-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNAUX_PARAM[1] = SETTINGS.connect('changed::bottom-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNAUX_PARAM[2] = SETTINGS.connect('changed::left-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNAUX_PARAM[3] = SETTINGS.connect('changed::right-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNAUX_PARAM[4] = SETTINGS.connect('changed::position',
	                                         updateLayoutLayout.bind(MyLayout));

	SIGNAL_MONITOR = Main.layoutManager.connect('monitors-changed',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));

	updateLayoutLayout();
}

//------------------------------------------------

function disable() {
	if (POSITION == 'overview') {
		Main.layoutManager.overviewGroup.remove_actor(MyLayout.actor);
	} else {
		Main.layoutManager._backgroundGroup.remove_actor(MyLayout.actor);
	}

//	log('disabling signals for places-and-files-on-desktop');
//	for (var i = 0; i < SIGNAUX_PARAM.length; i++) { FIXME TODO
//		SETTINGS.disconnect(SIGNAUX_PARAM[i]);
//	}
//	
//	Main.layoutManager.disconnect(SIGNAL_MONITOR);
//	
//	if (SIGNAUX_OVERVIEW.length != 0) {
//		if (global.hasOwnProperty('screen')) { // < 3.29
//			global.screen.disconnect(SIGNAUX_OVERVIEW[0]);
//			global.screen.disconnect(SIGNAUX_OVERVIEW[1]);
//		} else { // > 3.29
//			global.workspaceManager.disconnect(SIGNAUX_OVERVIEW[0]);
//			global.display.disconnect(SIGNAUX_OVERVIEW[1]);
//		}
//		global.window_manager.disconnect(SIGNAUX_OVERVIEW[2]);
//		Main.overview.viewSelector._showAppsButton.disconnect(SIGNAUX_OVERVIEW[3]);
//		Main.overview.viewSelector._text.disconnect(SIGNAUX_OVERVIEW[4]);
//		Main.overview.disconnect(SIGNAUX_OVERVIEW[5]);
//	}
//	log('signals for places-and-files-on-desktop disabled');
}

//------------------------------------------------

