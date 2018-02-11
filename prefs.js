
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

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
		
		this.box = new Gtk.Box({
			visible: true,
			can_focus: false,
			margin_left: 70,
			margin_right: 70,
			margin_top: 20,
			margin_bottom: 20,
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 15
		});
		this.add(this.box);
	},

	add_widget: function(filledbox) {
		this.box.add(filledbox);
	} 
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
		
		this.filtersPage = this.add_page('filters', _("Filters"));
		this.appearancePage = this.add_page('appearance', _("Appearance"));
		this.aboutPage = this.add_page('about', _("About"));

		this.SETTINGS = Convenience.getSettings('org.gnome.shell.extensions.places-files-desktop');
		
		this._blacklist = [];
		this.loadBlacklist();
		this.switchesList = [];
		//------------------------------------------------------
		
//		let labelFilter = _("<b>Filtrage des fichiers récents :</b>");
//		
//		let filterBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 15 });
//		filterBox.pack_start(new Gtk.Label({ label: labelFilter, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
//		this.filtersPage.add_widget(filterBox);
		
		//-------------------------------------------------------
		
		let AllSwitch = new Gtk.Switch();
		
		let AllBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 15 });
		AllBox.pack_start(new Gtk.Label({ label: _("All files"), halign: Gtk.Align.START }), false, false, 0);
		AllBox.pack_end(AllSwitch, false, false, 0);
		this.filtersPage.add_widget(AllBox);
		
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
			
			this.filtersPage.add_widget(
				this.createTypeSwitch(this._typeSwitches[i])
			);
		}
		//'blacklist'
		//available media-types are: text, image, audio, video, application, multipart, message, model (separated with ",").

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
		
		let gridBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 15 });
		gridBox.pack_start(new Gtk.Label({ label: labelGridSize, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		gridBox.pack_end(gridSize, false, false, 0);
		this.appearancePage.add_widget(gridBox);
		
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
		
		let listBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 15 });
		listBox.pack_start(new Gtk.Label({ label: labelListSize, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		listBox.pack_end(listSize, false, false, 0);
		this.appearancePage.add_widget(listBox);
		
		//-------------------------------------------------------
		
		let labelListNumber = _("Number of recent files listed:");
		
		let listNumber = new Gtk.SpinButton();
		listNumber.set_sensitive(true);
		listNumber.set_range(0, 100);
		listNumber.set_value(0);
		listNumber.set_value(this.SETTINGS.get_int('number-of-recent-files'));
		listNumber.set_increments(1, 2);
		
		listNumber.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('number-of-recent-files', value);
		}));
		
		let numberBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 15 });
		numberBox.pack_start(new Gtk.Label({ label: labelListNumber, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		numberBox.pack_end(listNumber, false, false, 0);
		this.appearancePage.add_widget(numberBox);
		
		//-------------------------------------------------------
		
		let labelPadding = _("Lateral padding:");
		
		let padding = new Gtk.SpinButton();
		padding.set_sensitive(true);
		padding.set_range(-100, 100);
		padding.set_value(0);
		padding.set_value(this.SETTINGS.get_int('padding'));
		padding.set_increments(1, 2);
		
		padding.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			this.SETTINGS.set_int('padding', value);
		}));
		
		let paddingBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 15 });
		paddingBox.pack_start(new Gtk.Label({ label: labelPadding, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		paddingBox.pack_end(padding, false, false, 0);
		this.appearancePage.add_widget(paddingBox);
		
		//--------------------------
		
		let labelName = Me.metadata.name.toString();
		
		let nameBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 15 });
		nameBox.add(
			new Gtk.Label({ label: labelName, use_markup: true, halign: Gtk.Align.CENTER })
		);
		this.aboutPage.add_widget(nameBox);
		
		//--------------------------
		
		let labelDescription = Me.metadata.description.toString();
		
		let DescriptionBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 15 });
		DescriptionBox.add(
			new Gtk.Label({ label: "<b>" + _( labelDescription ) + "</b>", use_markup: true, halign: Gtk.Align.CENTER })
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
		
		this.aboutPage.add_widget(LinkBox);
		
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
		
		let TypeBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, margin_start: 20/*, margin_end: 20*/ });
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
