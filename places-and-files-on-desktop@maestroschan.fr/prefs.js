
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
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

const PlacesOnDesktopSettingsWidget = new GObject.Class({
	Name: 'PlacesOnDesktop.Prefs.Widget',
	GTypeName: 'PlacesOnDesktopPrefsWidget',

	_init: function(params) {
		let builder = new Gtk.Builder();
		builder.add_from_file(Me.path+'/prefs.ui');
		this.prefs_stack = builder.get_object('prefs_stack');
		
		this.switcher = new Gtk.StackSwitcher({
			halign: Gtk.Align.CENTER,
			visible: true,
			stack: this.prefs_stack
		});
		
		//--------------------------------------------------------
		
		//layout page
		
		let places_icon_size = builder.get_object('places_icon_size');
		let lists_icon_size = builder.get_object('lists_icon_size');
		let radio_btn_1 = builder.get_object('radio_btn_1');
		let radio_btn_2 = builder.get_object('radio_btn_2');
		let radio_btn_3 = builder.get_object('radio_btn_3');
//		let radio_btn_3v = builder.get_object('radio_btn_3v');
		let radio_btn_4 = builder.get_object('radio_btn_4');
		let radio_btn_x = builder.get_object('radio_btn_x');
		let number_recent = builder.get_object('number_recent');
		
		places_icon_size.set_value(SETTINGS.get_int('places-icon-size'));
		places_icon_size.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('places-icon-size', value);
		});
		
		lists_icon_size.set_value(SETTINGS.get_int('recent-files-icon-size'));
		lists_icon_size.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('recent-files-icon-size', value);
		});
		
		radio_btn_1.connect('toggled', (widget) => {
			SETTINGS.set_boolean('not-overwrite-layout', false);
			SETTINGS.set_strv('active-widgets', ['places', 'searchbar', 'recent']);
			SETTINGS.set_strv('active-positions', ['0', '3', '3']);
		});
		
		radio_btn_2.connect('toggled', (widget) => {
			SETTINGS.set_boolean('not-overwrite-layout', false);
			SETTINGS.set_strv('active-widgets', ['places', 'searchbar', 'desktop']);
			SETTINGS.set_strv('active-positions', ['0', '3', '3']);
		});
		
		radio_btn_3.connect('toggled', (widget) => {
			SETTINGS.set_boolean('not-overwrite-layout', false);
			SETTINGS.set_strv('active-widgets', ['places', 'searchbar', 'recent', 'desktop']);
			SETTINGS.set_strv('active-positions', ['0', '1', '2', '2']);
		});
		
//		radio_btn_3v.connect('toggled', (widget) => {
//			SETTINGS.set_boolean('not-overwrite-layout', false);
//			SETTINGS.set_strv('active-widgets', ['places', 'searchbar', 'recent', 'desktop']);
//			SETTINGS.set_strv('active-positions', ['0', '3', '3', '3']);
//		});
		
		radio_btn_4.connect('toggled', (widget) => {
			SETTINGS.set_boolean('not-overwrite-layout', false);
			SETTINGS.set_strv('active-widgets', ['searchbar', 'recent', 'desktop']);
			SETTINGS.set_strv('active-positions', ['1', '2', '2']);
		});
		
//		radio_btn_5.connect('toggled', (widget) => {
//			SETTINGS.set_boolean('not-overwrite-layout', false);
//			SETTINGS.set_strv('active-widgets', ['places', 'searchbar', 'starred']);
//			SETTINGS.set_strv('active-positions', ['0', '3', '3']);
//		});
		
		radio_btn_x.connect('toggled', (widget) => {
			SETTINGS.set_boolean('not-overwrite-layout', true);
		});
		
		if (SETTINGS.get_boolean('not-overwrite-layout')) {
			radio_btn_x.set_active(true);
		} else {
			let widgets = SETTINGS.get_strv('active-widgets').toString();
			let positions = SETTINGS.get_strv('active-positions').toString();
			if (widgets == ['places', 'searchbar', 'recent'].toString()) {
				radio_btn_1.set_active(true);
			} else if (widgets == ['places', 'searchbar', 'desktop'].toString()) {
				radio_btn_2.set_active(true);
			} else if (widgets == ['places', 'searchbar', 'recent', 'desktop'].toString()) {
//				if (positions == ['0', '1', '2', '2'].toString()) {
					radio_btn_3.set_active(true);
//				} else {
//					radio_btn_3v.set_active(true);
//				}
			} else if (widgets == ['searchbar', 'recent', 'desktop'].toString()) {
				radio_btn_4.set_active(true);
			} else {
				radio_btn_x.set_active(true);
			}
		}
		
		number_recent.set_value(SETTINGS.get_int('number-of-recent-files'));
		number_recent.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('number-of-recent-files', value);
		});
		
		//-------------------------------------------------------
		
		//position page
		
		let position_combobox = builder.get_object('position_combobox');
		let top_padding_spinbtn = builder.get_object('top_padding_spinbtn');
		let bottom_padding_spinbtn = builder.get_object('bottom_padding_spinbtn');
		let left_padding_spinbtn = builder.get_object('left_padding_spinbtn');
		let right_padding_spinbtn = builder.get_object('right_padding_spinbtn');
		
		position_combobox.append('desktop', _("Desktop"));
		position_combobox.append('overview', _("Empty overview"));
		position_combobox.active_id = SETTINGS.get_string('position');
		position_combobox.connect('changed', (widget) => {
			SETTINGS.set_string('position', widget.get_active_id());
		});
		
		top_padding_spinbtn.set_value(SETTINGS.get_int('top-padding'));
		top_padding_spinbtn.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('top-padding', value);
		});
		
		bottom_padding_spinbtn.set_value(SETTINGS.get_int('bottom-padding'));
		bottom_padding_spinbtn.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('bottom-padding', value);
		});
		
		left_padding_spinbtn.set_value(SETTINGS.get_int('left-padding'));
		left_padding_spinbtn.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('left-padding', value);
		});
		
		right_padding_spinbtn.set_value(SETTINGS.get_int('right-padding'));
		right_padding_spinbtn.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('right-padding', value);
		});
		
		//--------------------------
		
		//about page
		
		builder.get_object('about_icon').set_from_pixbuf(
			GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path+'/images/about_icon.png', 128, 128)
		);
		
		let translation_credits = builder.get_object('translation_credits').get_label();
		if (translation_credits == 'translator-credits') {
			builder.get_object('translation_label').set_label('');
			builder.get_object('translation_credits').set_label('');
		}
		
		let linkBox = builder.get_object('link_box')// FIXME padding ???
		let a_version = ' (v' + Me.metadata.version.toString() + ') ';
		
		let url_button = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});
		
		linkBox.pack_start(url_button, false, false, 0);
		linkBox.pack_end(new Gtk.Label({ label: a_version, halign: Gtk.Align.START }), false, false, 0);
	}
});

//-----------------------------------------------

//I guess this is like the "enable" in extension.js : something called each
//time he user try to access the settings' window
function buildPrefsWidget() {
	let widget = new PlacesOnDesktopSettingsWidget();
//	widget.prefs_stack.set_size_request(700, 300);
	
	Mainloop.timeout_add(0, () => {
		let headerBar = widget.prefs_stack.get_toplevel().get_titlebar();
		headerBar.custom_title = widget.switcher;
		return false;
	});
	
	widget.prefs_stack.show_all();

	return widget.prefs_stack;
}

