// licensed under GPL3

const St = imports.gi.St;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const HeaderBox = Me.imports.headerBox;
const PlaceDisplay = Me.imports.placeDisplay;

const ViewBookmarks = Me.imports.contentLists.viewBookmarks;
const ViewRecent = Me.imports.contentLists.viewRecent;
const ViewDesktop = Me.imports.contentLists.viewDesktop;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

//------------------------------------------------------------------------------

var SETTINGS;
let PADDINGS = [];
let POSITION;
let SIGNALS_OVERVIEW = [];
let SIGNALS_PARAM = [];
let SIGNAL_MONITOR;

let MyLayout = null;

function init() {
	ExtensionUtils.initTranslations();

	ViewBookmarks.PLACES_MANAGER = new PlaceDisplay.PlacesManager();
	ViewRecent.RECENT_MANAGER = new Gtk.RecentManager();
}

//------------------------------------------------------------------------------

/**
 * Called when the user performs an action which affects the visibility of
 * `MyLayout` in the case its actor has been added to the `overviewGroup` (this
 * function is NOT called when it's on the desktop).
 * Such an action can be: opening or closing a window, changing the current
 * workspace, beginning a search, or opening the applications grid.
 */
function updateVisibility() {
	if (Main.overview.viewSelector._activePage != Main.overview.viewSelector._workspacesPage) {
		MyLayout.hide();
		return;
	}

	let i = global.workspaceManager.get_active_workspace_index();
	if (global.workspaceManager.get_workspace_by_index(i).list_windows() == '') {
		MyLayout.show();
	} else {
		MyLayout.hide();
	}
}

/**
 * Disconnect all signals in SIGNALS_OVERVIEW
 */
function disconnectOverviewSignals() {
	if (SIGNALS_OVERVIEW.length != 0) {
		global.workspaceManager.disconnect(SIGNALS_OVERVIEW[0]);
		global.display.disconnect(SIGNALS_OVERVIEW[1]);
		global.window_manager.disconnect(SIGNALS_OVERVIEW[2]);
		Main.overview.viewSelector._showAppsButton.disconnect(SIGNALS_OVERVIEW[3]);
		Main.overview.viewSelector._text.disconnect(SIGNALS_OVERVIEW[4]);
		Main.overview.disconnect(SIGNALS_OVERVIEW[5]);
	}
	SIGNALS_OVERVIEW = []
}

/**
 * Called when the user set a new layout position (desktop/overview).
 * `MyLayout` isn't rebuild from its constructor, but is just moved to the new
 * position.
 */
function updateLayoutPosition() {
	if (POSITION == '') {
		// do nothing
	} else if (POSITION == 'overview') {
		Main.layoutManager.overviewGroup.remove_actor(MyLayout.actor);
	} else {
		Main.layoutManager._backgroundGroup.remove_actor(MyLayout.actor);
	}

	disconnectOverviewSignals();

	POSITION = SETTINGS.get_string('position');
	SIGNALS_OVERVIEW = [];

	if (POSITION == 'desktop') {
		Main.layoutManager._backgroundGroup.add_actor(MyLayout.actor);
		MyLayout.show();
		return;
	} // else {

	Main.layoutManager.overviewGroup.add_actor(MyLayout.actor);

	// Update when the number of workspaces changes
	SIGNALS_OVERVIEW[0] = global.workspaceManager.connect(
		'notify::n-workspaces',
		updateVisibility.bind(this)
	);

	// Update when the number of windows in the workspace changes
	SIGNALS_OVERVIEW[1] = global.display.connect(
		'restacked',
		updateVisibility.bind(this)
	);

	// Update when the user switches to another workspace
	SIGNALS_OVERVIEW[2] = global.window_manager.connect(
		'switch-workspace',
		updateVisibility.bind(this)
	);

	// Update when the appgrid is shown/hidden
	SIGNALS_OVERVIEW[3] = Main.overview.viewSelector._showAppsButton.connect(
		'notify::checked',
		updateVisibility.bind(this)
	);

	// Update when the search results are shown/hidden
	SIGNALS_OVERVIEW[4] = Main.overview.viewSelector._text.connect(
		'text-changed',
		updateVisibility.bind(this)
	);

	// Update when the overview is shown/hidden
	SIGNALS_OVERVIEW[5] = Main.overview.connect(
		'showing',
		updateVisibility.bind(this)
	);
}

////////////////////////////////////////////////////////////////////////////////

class ConvenientLayout {
	constructor () {
		this.actor = new St.BoxLayout({
			vertical: false,
		});

		this.box_left = new St.BoxLayout({ vertical: true });
		this.box_right = new St.BoxLayout({ vertical: true });

		this.actor.add(this.box_left);
		this.actor.add(this.box_right);

		// this.active_positions = SETTINGS.get_strv('active-positions');
		this.adaptToMonitor();
	}

	filter_widgets (text) {
	}

	hide () {
		this.actor.visible = false;
	}

	show () {
		this.actor.visible = true;
	}

	fill_with_widgets () {
		return;

		// TODO build only the useful ones
		
		
		this.adaptInternalWidgets();
	}

	adaptToMonitor () {
		// change global position and size of the main actor
		PADDINGS = [
			SETTINGS.get_int('top-padding'),
			SETTINGS.get_int('bottom-padding'),
			SETTINGS.get_int('left-padding'),
			SETTINGS.get_int('right-padding')
		];
	
		let monitor = Main.layoutManager.primaryMonitor;
		this.actor.width = Math.floor(monitor.width - (PADDINGS[2] + PADDINGS[3]));
		this.actor.height = Math.floor(monitor.height - (PADDINGS[0] + PADDINGS[1]));
		this.actor.set_position(
			monitor.x + Math.floor(PADDINGS[2]),
			monitor.y + Math.floor(PADDINGS[0])
		);
		
		this.adaptInternalWidgets();
	}

	adaptInternalWidgets () {
		if (this.actor.width < this.actor.height) {
			this.actor.vertical = true;
		} else {
			this.actor.vertical = false;
		}
	}
};

////////////////////////////////////////////////////////////////////////////////

function enable() {
	SETTINGS = ExtensionUtils.getSettings();
	POSITION = '';
	PADDINGS = [
		SETTINGS.get_int('top-padding'),
		SETTINGS.get_int('bottom-padding'),
		SETTINGS.get_int('left-padding'),
		SETTINGS.get_int('right-padding')
	];

	if (MyLayout == null) {
		MyLayout = new ConvenientLayout();
		MyLayout.fill_with_widgets();
	}

	SIGNALS_PARAM = [];
	SIGNALS_PARAM[0] = SETTINGS.connect('changed::top-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNALS_PARAM[1] = SETTINGS.connect('changed::bottom-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNALS_PARAM[2] = SETTINGS.connect('changed::left-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNALS_PARAM[3] = SETTINGS.connect('changed::right-padding',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));
	SIGNALS_PARAM[4] = SETTINGS.connect('changed::position',
	                                       updateLayoutPosition.bind(MyLayout));

	SIGNAL_MONITOR = Main.layoutManager.connect('monitors-changed',
	                                    MyLayout.adaptToMonitor.bind(MyLayout));

	updateLayoutPosition();
}

//------------------------------------------------------------------------------

function disable() {
	if (POSITION == 'overview') {
		Main.layoutManager.overviewGroup.remove_actor(MyLayout.actor);
	} else {
		Main.layoutManager._backgroundGroup.remove_actor(MyLayout.actor);
	}

	// log('disabling signals for places-and-files-on-desktop');
	for (var i = 0; i < SIGNALS_PARAM.length; i++) {
		SETTINGS.disconnect(SIGNALS_PARAM[i]);
	}
	Main.layoutManager.disconnect(SIGNAL_MONITOR);
	disconnectOverviewSignals()
	// log('signals for places-and-files-on-desktop disabled');
}

////////////////////////////////////////////////////////////////////////////////

