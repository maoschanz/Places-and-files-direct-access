
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const GdkPixbuf = imports.gi.GdkPixbuf;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

//-----------------------------------------------

function init() {
	Convenience.initTranslations();
}

//-----------------------------------------------

const PrefsPage = new Lang.Class({
	Name: "PrefsPage",
	Extends: Gtk.ScrolledWindow,

	_init: function () {
		this.parent({
			vexpand: true,
			can_focus: true
		});
		
		this.stackpageMainBox = new Gtk.Box({
			visible: true,
			can_focus: false,
			margin_left: 50,
			margin_right: 50,
			margin_top: 20,
			margin_bottom: 20,
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 18
		});
		this.add(this.stackpageMainBox);
	},
	
	add_section: function(titre) {
		let section = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 6,
		});
		if (titre != "") {
			section.add(new Gtk.Label({
				label: '<b>' + titre + '</b>',
				halign: Gtk.Align.START,
				use_markup: true,
			}));
		}
	
		let a = new Gtk.ListBox({
			//titre ?
			can_focus: false,
			has_focus: false,
			is_focus: false,
			has_default: false,
			selection_mode: Gtk.SelectionMode.NONE,
		});
		section.add(a);
		this.stackpageMainBox.add(section);
		return a;
	},

	add_row: function(filledbox, section) {
		let a = new Gtk.ListBoxRow({
			can_focus: false,
			has_focus: false,
			is_focus: false,
			has_default: false,
//			activatable: false,
			selectable: false,	
		});
		a.add(filledbox);
		section.add(a);
		return a;
	},
	
	add_widget: function(filledbox) {
		this.stackpageMainBox.add(filledbox);
	},
});

//-----------------------------------------------

const PlacesOnDesktopSettingsWidget = new GObject.Class({
	Name: 'PlacesOnDesktop.Prefs.Widget',
	GTypeName: 'PlacesOnDesktopPrefsWidget',
	Extends: Gtk.Stack,

	_init: function(params) {
		this.parent({transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT});
		
		this.switcher = new Gtk.StackSwitcher({
			halign: Gtk.Align.CENTER,
			visible: true,
			stack: this
		});
		
		//---------------------------------------------------------------
		
		this.searchPage = this.add_page('search', _("Search"));
		this.positionPage = this.add_page('position', _("Position"));
		this.othersPage = this.add_page('others', _("Others"));
		this.aboutPage = this.add_page('about', _("About"));
		
		//------------------------------------------------------
		
		let searchSection = this.searchPage.add_section("");
		let filterSection = this.searchPage.add_section(_("Filtering"));
		
		let displaySection = this.positionPage.add_section("");
		let paddingSection = this.positionPage.add_section(_("Padding"));
		
		let iconsSection = this.othersPage.add_section(_("Icons"));
		let favSection = this.othersPage.add_section(_("Favorite files"));
		let recentSection = this.othersPage.add_section(_("Recent files"));
		
		//--------------------------------------------------------

		this.SETTINGS = Convenience.getSettings('org.gnome.shell.extensions.places-files-desktop');
		
		this._blacklist = [];
		this.loadBlacklist();
		this.switchesList = [];
		
		//------------------------------------------------------
		
		let labelSearch = _("Search in paths:");
		
		let searchSwitch = new Gtk.Switch();
		searchSwitch.set_sensitive(true);
		searchSwitch.set_state(false);
		searchSwitch.set_state(this.SETTINGS.get_boolean('search-in-path'));
		
		searchSwitch.connect('notify::active', Lang.bind(this, function(w){
			if (w.active) {
				this.SETTINGS.set_boolean('search-in-path', true);
			} else {
				this.SETTINGS.set_boolean('search-in-path', false);
			}
		}));
		
		let searchBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		searchBox.pack_start(new Gtk.Label({ label: labelSearch, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		searchBox.pack_end(searchSwitch, false, false, 0);
		this.searchPage.add_row(searchBox, searchSection);

		//-------------------------------------------------------
		
		let AllSwitch = new Gtk.Switch();
		
		let AllBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6
		});
		AllBox.pack_start(new Gtk.Label({ label: _("All files"), halign: Gtk.Align.START }), false, false, 0);
		AllBox.pack_end(AllSwitch, false, false, 0);
		this.searchPage.add_row(AllBox, filterSection);
		
		//--------------------------------------------------------
		
		this._typeSwitches = new Array();
		this._typeSwitches.push( ['text', _("Text files")] );
		this._typeSwitches.push( ['image', _("Image files")] );
		this._typeSwitches.push( ['audio', _("Audio files")] );
		this._typeSwitches.push( ['video', _("Video files")] );
		this._typeSwitches.push( ['application', _("Application files")] );
		this._typeSwitches.push( ['multipart', _("Multipart files")] );
		this._typeSwitches.push( ['message', _("Message files")] );
		this._typeSwitches.push( ['model', _("Model files")] );
		
		for(var i = 0; i < this._typeSwitches.length; i++) {
			this.searchPage.add_row(			
				this.createTypeSwitch(this._typeSwitches[i])
				, filterSection
			);
		}
		
		//-------------------------------------------------------
		
		AllSwitch.set_state(this.SETTINGS.get_string('blacklist') == '');
		
		if(this.SETTINGS.get_string('blacklist') == '') {
			this._lock(); 
		}
		
		AllSwitch.connect('notify::active', Lang.bind(this, function(widget) {
			if (widget.active) {
				this._lock();
			} else {
				this.switchesList.forEach(function(s) {
					s.sensitive = true;
				});
			}
		}));
		
		//-------------------------------------------------------
		
		let labelPosition = _("Display on:");
		
		let positionCombobox = new Gtk.ComboBoxText({
			visible: true,
			can_focus: true,
			halign: Gtk.Align.END,
			valign: Gtk.Align.CENTER
		});
		
		positionCombobox.append('desktop', _("Desktop"));
		positionCombobox.append('overview', _("Empty overview"));
		
		positionCombobox.active_id = this.SETTINGS.get_string('position');
		
		positionCombobox.connect("changed", (widget) => {
			this.SETTINGS.set_string('position', widget.get_active_id());
		});
		
		let positionBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		positionBox.pack_start(new Gtk.Label({ label: labelPosition, halign: Gtk.Align.START }), false, false, 0);
		positionBox.pack_end(positionCombobox, false, false, 0);
		this.positionPage.add_row(positionBox, displaySection);
		
		//----------------------------------------------
		
		let labelGridSize = _("Places icon size:");
		
		let gridSize = new Gtk.SpinButton();
		gridSize.set_sensitive(true);
		gridSize.set_range(16, 128);
		gridSize.set_value(0);
		gridSize.set_value(this.SETTINGS.get_int('places-icon-size'));
		gridSize.set_increments(1, 2);
		
		gridSize.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('places-icon-size', value);
		}));
		
		let gridBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		gridBox.pack_start(new Gtk.Label({ label: labelGridSize, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		gridBox.pack_end(gridSize, false, false, 0);
		this.othersPage.add_row(gridBox, iconsSection);
		
		//-------------------------------------------------------
		
		let labelListSize = _("Recent files icon size:");
		
		let listSize = new Gtk.SpinButton();
		listSize.set_sensitive(true);
		listSize.set_range(16, 128);
		listSize.set_value(0);
		listSize.set_value(this.SETTINGS.get_int('recent-files-icon-size'));
		listSize.set_increments(1, 2);
		
		listSize.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('recent-files-icon-size', value);
		}));
		
		let listBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		listBox.pack_start(new Gtk.Label({ label: labelListSize, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		listBox.pack_end(listSize, false, false, 0);
		this.othersPage.add_row(listBox, iconsSection);
		
		//-------------------------------------------------------
		
		let labelListNumber = _("Number of recent files listed:");
		
		let listNumber = new Gtk.SpinButton();
		listNumber.set_sensitive(true);
		listNumber.set_range(0, 300);
		listNumber.set_value(0);
		listNumber.set_value(this.SETTINGS.get_int('number-of-recent-files'));
		listNumber.set_increments(1, 2);
		
		listNumber.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('number-of-recent-files', value);
		}));
		
		let numberBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		numberBox.pack_start(new Gtk.Label({ label: labelListNumber, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		numberBox.pack_end(listNumber, false, false, 0);
		this.othersPage.add_row(numberBox, recentSection);
		
		//------------------------------------------------------
		
		let labelFav = _("Display files from:");
		
		let favCombobox = new Gtk.ComboBoxText({
			visible: true,
			can_focus: true,
			halign: Gtk.Align.END,
			valign: Gtk.Align.CENTER
		});
		
		favCombobox.append('desktop', _("~/Desktop"));
//		favCombobox.append('starred', _("Starred files"));
		favCombobox.append('none', _("Do not display"));
		
		favCombobox.active_id = this.SETTINGS.get_string('favorites-files');
		
		favCombobox.connect("changed", (widget) => {
			this.SETTINGS.set_string('favorites-files', widget.get_active_id());
		});
		
		let favBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		favBox.pack_start(new Gtk.Label({ label: labelFav, halign: Gtk.Align.START }), false, false, 0);
		favBox.pack_end(favCombobox, false, false, 0);
		this.othersPage.add_row(favBox, favSection);
		
		//-------------------------------------------------------
		
		let labelTopPadding = _("Top padding:");
		
		let TopPadding = new Gtk.SpinButton();
		TopPadding.set_sensitive(true);
		TopPadding.set_range(0, 300);
		TopPadding.set_value(0);
		TopPadding.set_value(this.SETTINGS.get_int('top-padding'));
		TopPadding.set_increments(1, 2);
		
		TopPadding.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('top-padding', value);
		}));
		
		let TopPaddingBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		TopPaddingBox.pack_start(new Gtk.Label({ label: labelTopPadding, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		TopPaddingBox.pack_end(TopPadding, false, false, 0);
		this.positionPage.add_row(TopPaddingBox, paddingSection);
		
		//-------------------------------------------------------
		
		let labelBottomPadding = _("Bottom padding:");
		
		let BottomPadding = new Gtk.SpinButton();
		BottomPadding.set_sensitive(true);
		BottomPadding.set_range(0, 300);
		BottomPadding.set_value(0);
		BottomPadding.set_value(this.SETTINGS.get_int('bottom-padding'));
		BottomPadding.set_increments(1, 2);
		
		BottomPadding.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('bottom-padding', value);
		}));
		
		let BottomPaddingBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		BottomPaddingBox.pack_start(new Gtk.Label({ label: labelBottomPadding, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		BottomPaddingBox.pack_end(BottomPadding, false, false, 0);
		this.positionPage.add_row(BottomPaddingBox, paddingSection);
				
		//-------------------------------------------------------
		
		let labelLeftPadding = _("Left padding:");
		
		let LeftPadding = new Gtk.SpinButton();
		LeftPadding.set_sensitive(true);
		LeftPadding.set_range(0, 300);
		LeftPadding.set_value(0);
		LeftPadding.set_value(this.SETTINGS.get_int('left-padding'));
		LeftPadding.set_increments(1, 2);
		
		LeftPadding.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('left-padding', value);
		}));
		
		let LeftPaddingBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		LeftPaddingBox.pack_start(new Gtk.Label({ label: labelLeftPadding, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		LeftPaddingBox.pack_end(LeftPadding, false, false, 0);
		this.positionPage.add_row(LeftPaddingBox, paddingSection);
		
		//-------------------------------------------------------
		
		let labelRightPadding = _("Right padding:");
		
		let RightPadding = new Gtk.SpinButton();
		RightPadding.set_sensitive(true);
		RightPadding.set_range(0, 300);
		RightPadding.set_value(0);
		RightPadding.set_value(this.SETTINGS.get_int('right-padding'));
		RightPadding.set_increments(1, 2);
		
		RightPadding.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('right-padding', value);
		}));
		
		let RightPaddingBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		RightPaddingBox.pack_start(new Gtk.Label({ label: labelRightPadding, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		RightPaddingBox.pack_end(RightPadding, false, false, 0);
		this.positionPage.add_row(RightPaddingBox, paddingSection);
		
		//--------------------------
		
		let labelName = Me.metadata.name.toString();
		
		let nameBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 15 });
		nameBox.add(
			new Gtk.Label({ label: "<b>" + _(labelName) + "</b>", use_markup: true, halign: Gtk.Align.CENTER })
		);
		this.aboutPage.add_widget(nameBox);
		
		//--------------------------
		
		let a_image = new Gtk.Image({ pixbuf: GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path+'/about_icon.png', 128, 128) });
		this.aboutPage.add_widget(a_image);
		
		//--------------------------
		
		let labelDescription = Me.metadata.description.toString();
		
		let DescriptionBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 15 });
		DescriptionBox.add(
			new Gtk.Label({ label: _( labelDescription ), use_markup: true, halign: Gtk.Align.CENTER })
		);
		this.aboutPage.add_widget(DescriptionBox);
		
		//--------------------------
		
		let LinkBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
		let a_version = ' (v' + Me.metadata.version.toString() + ') ';
		
		let url_button = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});
		
		LinkBox.pack_start(url_button, false, false, 0);
		LinkBox.pack_end(new Gtk.Label({ label: a_version, halign: Gtk.Align.START }), false, false, 0);
		
		this.aboutPage.stackpageMainBox.pack_end(LinkBox, false, false, 0);
		
		//-------------------------
	},
	
	loadBlacklist: function() {		
		let string_version = this.SETTINGS.get_string('blacklist');
		this._blacklist = string_version.split(',');
	},
	
	saveBlacklist: function() {
		let string_version = '';
		for(var i = 0; i < this._blacklist.length; i++) {
			string_version += this._blacklist[i];
			if(i != this._blacklist.length-1) {
				string_version += ',';
			}
		}
		this.SETTINGS.set_string('blacklist', string_version);
	},
	
	createTypeSwitch: function([type, label_switch]) {
		let TypeSwitch = new Gtk.Switch();
		this._blacklist.forEach(function(t) {
			if (t == type) {
				TypeSwitch.set_state(false);
			} else {
				TypeSwitch.set_state(true);
			}
		});
		
		TypeSwitch.connect('notify::active', Lang.bind(this, function(widget) {
			if (widget.active) {
				let temp = [];
				for(var i = 0; i < this._blacklist.length; i++) {
					if(this._blacklist[i] != type) {
						temp.push(this._blacklist[i]);
					}
				}
				this._blacklist = temp;
				this.saveBlacklist();
			} else {
				this._blacklist.push(type);
				this.saveBlacklist();
			}
		}));
		
		this.switchesList.push(TypeSwitch);
		
		let TypeBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 10,
			margin: 6,
		});
		TypeBox.pack_start(new Gtk.Label({ label: label_switch, halign: Gtk.Align.START }), false, false, 0);
		TypeBox.pack_end(TypeSwitch, false, false, 0);
		return TypeBox;
	},
	
	_lock: function(){
		this._blacklist = [];
		this.saveBlacklist();
		this.switchesList.forEach(function(s) {
			s.sensitive = false;
			s.active = true;
		});
	},
	
	add_page: function (id, title) {
		let page = new PrefsPage();
		this.add_titled(page, id, title);
		return page;
	},
});


//-----------------------------------------------

//I guess this is like the "enable" in extension.js : something called each
//time he user try to access the settings' window
function buildPrefsWidget() {
	let widget = new PlacesOnDesktopSettingsWidget();
	
	Mainloop.timeout_add(0, () => {
		let headerBar = widget.get_toplevel().get_titlebar();
		headerBar.custom_title = widget.switcher;
		return false;
	});
	
	widget.show_all();

	return widget;
}
