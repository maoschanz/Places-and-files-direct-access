
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const GdkPixbuf = imports.gi.GdkPixbuf;

const Gettext = imports.gettext.domain('places-files-desktop');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var SETTINGS;

function init() {
	ExtensionUtils.initTranslations();
	SETTINGS = ExtensionUtils.getSettings();
}

//------------------------------------------------------------------------------

const PlacesOnDesktopSettingsWidget = new GObject.Class({
	Name: 'PlacesOnDesktop.Prefs.Widget',
	GTypeName: 'PlacesOnDesktopPrefsWidget',

	_init: function() {
		let builder = new Gtk.Builder();
		builder.add_from_file(Me.path+'/prefs.ui');
		this.prefs_stack = builder.get_object('prefs_stack');
		
		this.switcher = new Gtk.StackSwitcher({
			halign: Gtk.Align.CENTER,
			visible: true,
			stack: this.prefs_stack
		});
		
		this._buildContentPage(builder);
		this._buildPositionPage(builder);
		this._buildAboutPage(builder);
	},

	////////////////////////////////////////////////////////////////////////////

	_buildContentPage: function(builder) {
		let lists_icon_size = builder.get_object('lists_icon_size');
		lists_icon_size.set_value(SETTINGS.get_int('icon-size'));
		lists_icon_size.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('icon-size', value);
		});

		this._addContentColumn('left');
		this._addContentColumn('right');

		let number_recent = builder.get_object('number_recent');
		number_recent.set_value(SETTINGS.get_int('number-of-recent-files'));
		number_recent.connect('value-changed', (widget) => {
			var value = widget.get_value_as_int();
			SETTINGS.set_int('number-of-recent-files', value);
		});
	},

	_addContentColumn(side) {
		let value;

		let radio_content1 = builder.get_object('radio_' + side + '_content');
		let radio_content2 = builder.get_object('radio_' + side + '_content2');
		let radio_content3 = builder.get_object('radio_' + side + '_content3');

		value = SETTINGS.get_string('content-' + side);
		radio_content1.set_active(value === 'places');
		radio_content2.set_active(value === 'recent');
		radio_content3.set_active(value === 'desktop');

		radio_content1.connect('toggled', (widget) => {
			SETTINGS.set_string('content-' + side, 'places');
		});
		radio_content2.connect('toggled', (widget) => {
			SETTINGS.set_string('content-' + side, 'recent');
		});
		radio_content3.connect('toggled', (widget) => {
			SETTINGS.set_string('content-' + side, 'desktop');
		});

		//----------------------------------------------------------------------

		let radio_searchbar1 = builder.get_object('radio' + side + 'searchbar');
		let radio_searchbar2 = builder.get_object('radio' + side + 'searchbar2');
		let radio_searchbar3 = builder.get_object('radio' + side + 'searchbar3');

		value = SETTINGS.get_string('searchbar-' + side);
		radio_searchbar1.set_active(value === 'top');
		radio_searchbar2.set_active(value === 'bottom');
		radio_searchbar3.set_active(value === 'none');

		radio_searchbar1.connect('toggled', (widget) => {
			SETTINGS.set_string('searchbar-' + side, 'top');
		});
		radio_searchbar2.connect('toggled', (widget) => {
			SETTINGS.set_string('searchbar-' + side, 'bottom');
		});
		radio_searchbar3.connect('toggled', (widget) => {
			SETTINGS.set_string('searchbar-' + side, 'none');
		});
	},

	////////////////////////////////////////////////////////////////////////////

	_buildPositionPage: function(builder) {
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
	},

	////////////////////////////////////////////////////////////////////////////

	_buildAboutPage: function(builder) {
		let translation_credits = builder.get_object('translation_credits').get_label();
		if (translation_credits == 'translator-credits') {
			builder.get_object('translation_label').set_label('');
			builder.get_object('translation_credits').set_label('');
		}

		let linkBox = builder.get_object('link_box') // XXX ugly padding
		let a_version = ' (v' + Me.metadata.version.toString() + ') ';

		let url_button = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});

		linkBox.pack_start(url_button, false, false, 0);
		let versionLabel = new Gtk.Label({
			label: a_version,
			halign: Gtk.Align.START
		});
		linkBox.pack_end(versionLabel, false, false, 0);
	},

});

//-----------------------------------------------

// I guess this is like the "enable" in `extension.js`: something called each
// time he user try to access the settings' window
function buildPrefsWidget() {
	let widget = new PlacesOnDesktopSettingsWidget();
	Mainloop.timeout_add(0, () => {
		let headerBar = widget.prefs_stack.get_toplevel().get_titlebar();
		headerBar.custom_title = widget.switcher;
		return false;
	});
	widget.prefs_stack.show_all();
	return widget.prefs_stack;
}

