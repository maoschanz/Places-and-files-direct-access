
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

var SETTINGS;

function init() {
	Convenience.initTranslations();
	SETTINGS = Convenience.getSettings('org.gnome.shell.extensions.places-files-desktop');
}

//-----------------------------------------------

const ElementBox = new GObject.Class({
	Name: 'PlacesOnDesktop.Prefs.ElementBox',
	GTypeName: 'PlacesOnDesktopPrefsElementBox',
	Extends: Gtk.Frame,
	
	_init: function(box_id, element_id, params) {
		this.parent(params);
		
		this.element_id = element_id;
		this.box_id = box_id;
		
		let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER });
		box.get_style_context().add_class('linked')
		this.select_btn = new Gtk.ToggleButton({ label: _("Select an element…") });
		this.options_btn = new Gtk.ToggleButton();
		this.options_btn.set_image(Gtk.Image.new_from_icon_name('view-more-symbolic', Gtk.IconSize.MENU));
		
		this.select_popover = new Gtk.Popover(this.select_btn);
		this.select_popover.set_relative_to(this.select_btn);
		this.select_popover_box = new Gtk.Box({visible: true, orientation: Gtk.Orientation.VERTICAL, margin: 6});
		this.select_popover.add(this.select_popover_box);
		
		this.buttons = [];
		this.buttons['delete'] = new Gtk.ModelButton({ label: _("Delete this element"), visible: true })
		this.buttons['searchbar'] = new Gtk.ModelButton({ label: _("Search bar"), visible: true })
		this.buttons['places'] = new Gtk.ModelButton({ label: _("Places"), visible: true })
		this.buttons['recent'] = new Gtk.ModelButton({ label: _("Recent files"), visible: true })
		this.buttons['desktop'] = new Gtk.ModelButton({ label: _("Desktop folder"), visible: true })
		this.buttons['starred'] = new Gtk.ModelButton({ label: _("Starred files"), visible: true })
		
		for (let i in this.buttons) {
			this.select_popover_box.add(this.buttons[i]);
		}
		
		this.buttons['delete'].connect('clicked', Lang.bind(this, function(){
			log('todo supprimer des arrays');
			this.destroy();
		}));
		this.buttons['searchbar'].connect('clicked', Lang.bind(this, function(){
			this.element_id = 'searchbar';
			this.save_new_id();
		}));
		this.buttons['places'].connect('clicked', Lang.bind(this, function(){
			this.element_id = 'places';
			this.save_new_id();
		}));
		this.buttons['recent'].connect('clicked', Lang.bind(this, function(){
			this.element_id = 'recent';
			this.save_new_id();
		}));
		this.buttons['desktop'].connect('clicked', Lang.bind(this, function(){
			this.element_id = 'desktop';
			this.save_new_id();
		}));
		this.buttons['starred'].connect('clicked', Lang.bind(this, function(){
			this.element_id = 'starred';
			this.save_new_id();
		}));
		
		this.options_popover = new Gtk.Popover(this.options_btn);
		this.options_popover.set_relative_to(this.options_btn);
		this.options_popover_box = new Gtk.Box({visible: true, orientation: Gtk.Orientation.VERTICAL, margin: 6});
		this.options_popover.add(this.options_popover_box);
		
		box.add(this.select_btn);
		box.add(this.options_btn);
		
		this.select_btn.connect('toggled', Lang.bind(this, this.on_select_opened));
		this.options_btn.connect('toggled', Lang.bind(this, this.on_options_opened));
		this.select_popover.connect('closed', Lang.bind(this, this.on_select_closed));
		this.options_popover.connect('closed', Lang.bind(this, this.on_options_closed));
		
		this.add(box);
		this.show_all();
		
		this.options_btn.set_sensitive(this.element_id != null);
	},
	
	on_select_closed: function(b) {
		this.select_popover.popdown();
		this.select_btn.set_active(false);
	},
	
	on_select_opened: function(b) {
		if (!b.get_active()) {
			this.options_btn.set_sensitive(this.element_id != null);
		} else {
			this.select_popover.popup();
		}
	},
	
	on_options_closed: function(b) {
		this.options_popover.popdown();
		this.options_btn.set_active(false);
	},
	
	on_options_opened: function(b) {
		if (!b.get_active()) {
			// application des réglages
		} else {
			this.options_popover_box.add(new Gtk.Button({ label: 'eeee', visible: true }));
			this.options_popover.popup();
		}
	},
	
	save_new_id: function() {
		let widgets = SETTINGS.get_strv('active-widgets');
		widgets.push(this.element_id);
		let positions = SETTINGS.get_strv('active-positions');
		positions.push(this.box_id);
		SETTINGS.set_strv('active-widgets', widgets);
		SETTINGS.set_strv('active-positions', positions);
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
		
		let builder = new Gtk.Builder();
		builder.add_from_file(Me.path+"/ui/layout.ui");
		builder.add_from_file(Me.path+"/ui/position.ui");
//        builder.add_from_file(Me.path+"/ui/about.ui"); // TODO

		let layout_page = builder.get_object("layout_page");
		this.add_titled(layout_page, 'layout', _("Layout"));

		let position_page = builder.get_object("position_page");
		this.add_titled(position_page, 'position', _("Position"));
		
		let aboutPage = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, margin: 25, spacing: 10 });
		this.add_titled(aboutPage, 'about', _("About"));
		
		//--------------------------------------------------------
		
		//layout.ui //TODO
//		let layout_btn = builder.get_object('layout_btn');
		let box_0 = builder.get_object('box_0');

		let box_0_add_btn = builder.get_object('box_0_add_btn');
		let box_1_add_btn = builder.get_object('box_1_add_btn');
		let box_2_add_btn = builder.get_object('box_2_add_btn');
		let box_3_add_btn = builder.get_object('box_3_add_btn');
		
		let box_0_widgets = builder.get_object('box_0_widgets');
		let box_1_widgets = builder.get_object('box_1_widgets');
		let box_2_widgets = builder.get_object('box_2_widgets');
		let box_3_widgets = builder.get_object('box_3_widgets');
		
		this.elements = [];
		
//		this.load_current_settings();
		
		box_0_add_btn.connect('clicked', Lang.bind(this, function() {
			let new_element = new ElementBox('0', null);
			box_0_widgets.add(new_element);
			this.elements.push(new_element);
		}));
		
		box_1_add_btn.connect('clicked', Lang.bind(this, function() {
			let new_element = new ElementBox('1', null);
			box_1_widgets.add(new_element);
			this.elements.push(new_element);
		}));
		
		box_2_add_btn.connect('clicked', Lang.bind(this, function() {
			let new_element = new ElementBox('2', null);
			box_2_widgets.add(new_element);
			this.elements.push(new_element);
		}));
		
		box_3_add_btn.connect('clicked', Lang.bind(this, function() {
			let new_element = new ElementBox('3', null);
			box_3_widgets.add(new_element);
			this.elements.push(new_element);
		}));
		
		
		
		
		//position.ui
		let position_combobox = builder.get_object('position_combobox');
		let top_padding_spinbtn = builder.get_object('top_padding_spinbtn');
		let bottom_padding_spinbtn = builder.get_object('bottom_padding_spinbtn');
		let left_padding_spinbtn = builder.get_object('left_padding_spinbtn');
		let right_padding_spinbtn = builder.get_object('right_padding_spinbtn');
		
		//about.ui
		//TODO
		
		//--------------------------------------------------------
		
		this._blacklist = [];
		this.loadBlacklist();
		this.switchesList = [];
		
		//------------------------------------------------------
		
		//à supprimer plus tard TODO TODO
//		layout_btn.connect('clicked', Lang.bind(this, function(w){
//			SETTINGS.set_strv('blacklist-recent', []);
//			SETTINGS.set_strv('active-widgets', ['places', 'searchbar', 'recent']);
//			SETTINGS.set_strv('active-positions', ['0', '3', '3']);
//		}));
		
		//------------------------------------------------------
		
		let labelSearch = _("Search in paths:");
		
		let searchSwitch = new Gtk.Switch();
		searchSwitch.set_sensitive(true);
		searchSwitch.set_state(false);
		searchSwitch.set_state(SETTINGS.get_boolean('search-in-path'));
		
		searchSwitch.connect('notify::active', Lang.bind(this, function(w){
			if (w.active) {
				SETTINGS.set_boolean('search-in-path', true);
			} else {
				SETTINGS.set_boolean('search-in-path', false);
			}
		}));
		
		let searchBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		searchBox.pack_start(new Gtk.Label({ label: labelSearch, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		searchBox.pack_end(searchSwitch, false, false, 0);
//		this.searchPage.add_row(searchBox, searchSection);

		//-------------------------------------------------------
		
		let AllSwitch = new Gtk.Switch();
		
		let AllBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6
		});
		AllBox.pack_start(new Gtk.Label({ label: _("All files"), halign: Gtk.Align.START }), false, false, 0);
		AllBox.pack_end(AllSwitch, false, false, 0);
//		this.searchPage.add_row(AllBox, filterSection);
		
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
		
//		for(var i = 0; i < this._typeSwitches.length; i++) {
//			this.searchPage.add_row(			
//				this.createTypeSwitch(this._typeSwitches[i])
//				, filterSection
//			);
//		}
		
		//-------------------------------------------------------
		
		AllSwitch.set_state(SETTINGS.get_string('blacklist') == '');
		
		if(SETTINGS.get_string('blacklist') == '') {
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
		
		position_combobox.append('desktop', _("Desktop"));
		position_combobox.append('overview', _("Empty overview"));
		
		position_combobox.active_id = SETTINGS.get_string('position');
		
		position_combobox.connect("changed", (widget) => {
			SETTINGS.set_string('position', widget.get_active_id());
		});
		
		//----------------------------------------------
		
		let labelGridSize = _("Places icon size:");
		
		let gridSize = new Gtk.SpinButton();
		gridSize.set_sensitive(true);
		gridSize.set_range(16, 128);
		gridSize.set_value(0);
		gridSize.set_value(SETTINGS.get_int('places-icon-size'));
		gridSize.set_increments(1, 2);
		
		gridSize.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('places-icon-size', value);
		}));
		
		let gridBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		gridBox.pack_start(new Gtk.Label({ label: labelGridSize, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		gridBox.pack_end(gridSize, false, false, 0);
//		this.othersPage.add_row(gridBox, iconsSection);
		
		//-------------------------------------------------------
		
		let labelListSize = _("Recent files icon size:");
		
		let listSize = new Gtk.SpinButton();
		listSize.set_sensitive(true);
		listSize.set_range(16, 128);
		listSize.set_value(0);
		listSize.set_value(SETTINGS.get_int('recent-files-icon-size'));
		listSize.set_increments(1, 2);
		
		listSize.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('recent-files-icon-size', value);
		}));
		
		let listBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		listBox.pack_start(new Gtk.Label({ label: labelListSize, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		listBox.pack_end(listSize, false, false, 0);
//		this.othersPage.add_row(listBox, iconsSection);
		
		//-------------------------------------------------------
		
		let labelListNumber = _("Number of recent files listed:");
		
		let listNumber = new Gtk.SpinButton();
		listNumber.set_sensitive(true);
		listNumber.set_range(0, 300);
		listNumber.set_value(0);
		listNumber.set_value(SETTINGS.get_int('number-of-recent-files'));
		listNumber.set_increments(1, 2);
		
		listNumber.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('number-of-recent-files', value);
		}));
		
		let numberBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		numberBox.pack_start(new Gtk.Label({ label: labelListNumber, use_markup: true, halign: Gtk.Align.START }), false, false, 0);
		numberBox.pack_end(listNumber, false, false, 0);
//		this.othersPage.add_row(numberBox, recentSection);
		
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
//		favCombobox.append('both', _("Display both"));
		
		favCombobox.active_id = SETTINGS.get_string('favorites-files');
		
		favCombobox.connect("changed", (widget) => {
			SETTINGS.set_string('favorites-files', widget.get_active_id());
		});
		
		let favBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		favBox.pack_start(new Gtk.Label({ label: labelFav, halign: Gtk.Align.START }), false, false, 0);
		favBox.pack_end(favCombobox, false, false, 0);
//		this.othersPage.add_row(favBox, favSection);
		
		//-------------------------------------------------------
		
		top_padding_spinbtn.set_value(SETTINGS.get_int('top-padding'));
		top_padding_spinbtn.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('top-padding', value);
		}));
		
		//-------------------------------------------------------
		
		bottom_padding_spinbtn.set_value(SETTINGS.get_int('bottom-padding'));
		bottom_padding_spinbtn.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('bottom-padding', value);
		}));
				
		//-------------------------------------------------------
		
		left_padding_spinbtn.set_value(SETTINGS.get_int('left-padding'));
		left_padding_spinbtn.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('left-padding', value);
		}));
		
		//-------------------------------------------------------
		
		right_padding_spinbtn.set_value(SETTINGS.get_int('right-padding'));
		right_padding_spinbtn.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('right-padding', value);
		}));
		
		//--------------------------
		
		let labelName = Me.metadata.name.toString();
		
		let nameBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 15 });
		nameBox.add(
			new Gtk.Label({ label: "<b>" + _(labelName) + "</b>", use_markup: true, halign: Gtk.Align.CENTER })
		);
		aboutPage.add(nameBox);
		
		//--------------------------
		
		let a_image = new Gtk.Image({ pixbuf: GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path+'/about_icon.png', 128, 128) });
		aboutPage.add(a_image);
		
		//--------------------------
		
		let labelDescription = Me.metadata.description.toString();
		
		let DescriptionBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 15 });
		DescriptionBox.add(
			new Gtk.Label({ label: _( labelDescription ), use_markup: true, halign: Gtk.Align.CENTER })
		);
		aboutPage.add(DescriptionBox);
		
		//--------------------------
		
		let LinkBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
		let a_version = ' (v' + Me.metadata.version.toString() + ') ';
		
		let url_button = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});
		
		LinkBox.pack_start(url_button, false, false, 0);
		LinkBox.pack_end(new Gtk.Label({ label: a_version, halign: Gtk.Align.START }), false, false, 0);
		
		aboutPage.pack_end(LinkBox, false, false, 0);
		
		//-------------------------
	},
	
	load_current_settings: function() {
		log('todo');
		
		
		
		
		
		
		
		
		let new_element = new ElementBox(0, 'places');
		box_0_widgets.add(new_element);
		this.elements.push(new_element);
	},
	
	loadBlacklist: function() {
		let string_version = SETTINGS.get_string('blacklist');
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
		SETTINGS.set_string('blacklist', string_version);
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
});

//-----------------------------------------------

//I guess this is like the "enable" in extension.js : something called each
//time he user try to access the settings' window
function buildPrefsWidget() {
	let widget = new PlacesOnDesktopSettingsWidget();
//	widget.set_size_request(700, 300);
	
	Mainloop.timeout_add(0, () => {
		let headerBar = widget.get_toplevel().get_titlebar();
		headerBar.custom_title = widget.switcher;
		
		/*
		let menu_btn = new Gtk.MenuButton();
		menu_btn.set_image(Gtk.Image.new_from_icon_name('open-menu-symbolic', Gtk.IconSize.MENU))
        let builder = new Gtk.Builder();
        builder.add_from_file(Me.path+"/ui/menu.ui");
        let menu = builder.get_object("prefs-menu");
        let menu_popover = new Gtk.Popover(menu_btn);
        menu_popover.bind_model(menu, 'win');
        menu_btn.set_popover(menu_popover);
		headerBar.pack_end(menu_btn)
		headerBar.show_all();
		*/
		
		return false;
	});
	
	widget.show_all();

	return widget;
}
