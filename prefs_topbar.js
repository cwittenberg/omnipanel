// omnipanel/prefs_topbar.js
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function wrap(row) {
    if (row) {
        row.set_subtitle_lines(0);
    }
    return row;
}

export default function buildTopBarPage(settings) {
    const pageTopBar = new Adw.PreferencesPage({ 
        title: _('Top bar'), 
        icon_name: 'view-dual-symbolic' 
    });

    const groupMovement = new Adw.PreferencesGroup({ title: _('Active Toolbar Movement') });

    const rowEnabled = new Adw.ActionRow({ 
        title: _('Enable Toolbar Movement'), 
        subtitle: _('Dynamically move the real native panel to the active screen') 
    });
    const switchEnabled = new Gtk.Switch({ 
        active: settings.get_boolean('movement-enabled'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('movement-enabled', switchEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowEnabled.add_suffix(switchEnabled);
    groupMovement.add(wrap(rowEnabled));

    const rowSpeed = new Adw.ComboRow({
        title: _('Movement Response Speed'),
        subtitle: _('Balance between snappiness and CPU usage'),
        model: Gtk.StringList.new([_('Fast (100ms)'), _('Normal (200ms)'), _('Battery Saver (500ms)')])
    });
    const currentSpeed = settings.get_int('movement-speed');
    if (currentSpeed <= 100) rowSpeed.selected = 0;
    else if (currentSpeed >= 500) rowSpeed.selected = 2;
    else rowSpeed.selected = 1;
    
    rowSpeed.connect('notify::selected', () => {
        if (rowSpeed.selected === 0) settings.set_int('movement-speed', 100);
        else if (rowSpeed.selected === 1) settings.set_int('movement-speed', 200);
        else settings.set_int('movement-speed', 500);
    });
    groupMovement.add(wrap(rowSpeed));

    const groupDesktop = new Adw.PreferencesGroup({ title: _('Show Desktop Button') });

    const rowShowDesktop = new Adw.ActionRow({ 
        title: _('Enable Show Desktop Button'), 
        subtitle: _('Adds a button to the top bar to minimize/restore windows on the current monitor') 
    });
    const switchShowDesktop = new Gtk.Switch({ 
        active: settings.get_boolean('show-desktop-enabled'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('show-desktop-enabled', switchShowDesktop, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowShowDesktop.add_suffix(switchShowDesktop);
    groupDesktop.add(wrap(rowShowDesktop));

    const groupAnimations = new Adw.PreferencesGroup({ title: _('Animation Effects') });

    const rowAnimStyle = new Adw.ComboRow({
        title: _('Movement Animation Style'),
        subtitle: _('Visual effect when extensions arrive on the new screen'),
        model: Gtk.StringList.new([_('None (Instant)'), _('Fade'), _('Slide Down'), _('Pop')])
    });
    const currentAnim = settings.get_string('animation-style');
    if (currentAnim === 'fade') rowAnimStyle.selected = 1;
    else if (currentAnim === 'slide') rowAnimStyle.selected = 2;
    else if (currentAnim === 'pop') rowAnimStyle.selected = 3;
    else rowAnimStyle.selected = 0;

    rowAnimStyle.connect('notify::selected', () => {
        if (rowAnimStyle.selected === 1) settings.set_string('animation-style', 'fade');
        else if (rowAnimStyle.selected === 2) settings.set_string('animation-style', 'slide');
        else if (rowAnimStyle.selected === 3) settings.set_string('animation-style', 'pop');
        else settings.set_string('animation-style', 'none');
    });
    groupAnimations.add(wrap(rowAnimStyle));

    const durationAdjustment = new Gtk.Adjustment({ 
        lower: 100, upper: 1000, step_increment: 50, value: settings.get_int('animation-duration') 
    });
    const rowDuration = new Adw.SpinRow({ 
        title: _('Animation Duration (ms)'), 
        adjustment: durationAdjustment, 
        digits: 0 
    });
    settings.bind('animation-duration', rowDuration, 'value', Gio.SettingsBindFlags.DEFAULT);
    groupAnimations.add(wrap(rowDuration));

    const groupActiveUI = new Adw.PreferencesGroup({ title: _('Active Panel Appearance') });

    const rowHighlight = new Adw.ActionRow({ 
        title: _('Highlight Active Panel'), 
        subtitle: _('Change the background color of the active monitor\'s top bar') 
    });
    const switchHighlight = new Gtk.Switch({ 
        active: settings.get_boolean('highlight-active'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('highlight-active', switchHighlight, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowHighlight.add_suffix(switchHighlight);
    groupActiveUI.add(wrap(rowHighlight));

    const rowColor = new Adw.ActionRow({ title: _('Active Panel Color') });
    const colorDialog = new Gtk.ColorDialog();
    const colorBtn = new Gtk.ColorDialogButton({ dialog: colorDialog, valign: Gtk.Align.CENTER });
    
    let rgba = new Gdk.RGBA();
    rgba.parse(settings.get_string('active-panel-color'));
    colorBtn.set_rgba(rgba);

    colorBtn.connect('notify::rgba', () => {
        settings.set_string('active-panel-color', colorBtn.get_rgba().to_string());
    });
    rowColor.add_suffix(colorBtn);
    groupActiveUI.add(wrap(rowColor));

    const groupInactiveUI = new Adw.PreferencesGroup({ title: _('Inactive Panel Appearance') });

    const rowTranslucent = new Adw.ActionRow({ 
        title: _('Translucent Inactive Bars'), 
        subtitle: _('Make the top bar fade out on inactive monitors') 
    });
    const switchTranslucent = new Gtk.Switch({ 
        active: settings.get_boolean('translucent-inactive'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('translucent-inactive', switchTranslucent, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowTranslucent.add_suffix(switchTranslucent);
    groupInactiveUI.add(wrap(rowTranslucent));

    const opacityAdjustment = new Gtk.Adjustment({ 
        lower: 0.1, upper: 1.0, step_increment: 0.05, value: settings.get_double('inactive-opacity') 
    });
    const rowOpacity = new Adw.SpinRow({ 
        title: _('Inactive Opacity Level'), 
        adjustment: opacityAdjustment, 
        digits: 2 
    });
    settings.bind('inactive-opacity', rowOpacity, 'value', Gio.SettingsBindFlags.DEFAULT);
    groupInactiveUI.add(wrap(rowOpacity));

    const rowClock = new Adw.ActionRow({ 
        title: _('Show Static Clock Label'), 
        subtitle: _('Shows a non-clickable clock on inactive monitors') 
    });
    const switchClock = new Gtk.Switch({ 
        active: settings.get_boolean('show-clock'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('show-clock', switchClock, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowClock.add_suffix(switchClock);
    groupInactiveUI.add(wrap(rowClock));

    const rowHideInactive = new Adw.ActionRow({ 
        title: _('Hide toolbars on inactive screens'), 
        subtitle: _('Make inactive top bars completely invisible') 
    });
    const switchHideInactive = new Gtk.Switch({ 
        active: settings.get_boolean('hide-inactive-panels'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('hide-inactive-panels', switchHideInactive, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowHideInactive.add_suffix(switchHideInactive);
    groupInactiveUI.add(wrap(rowHideInactive));

    const syncInactiveSensitivities = () => {
        let isHidden = switchHideInactive.get_active();
        rowTranslucent.set_sensitive(!isHidden);
        rowOpacity.set_sensitive(!isHidden);
        rowClock.set_sensitive(!isHidden);
    };
    switchHideInactive.connect('notify::active', syncInactiveSensitivities);
    syncInactiveSensitivities();

    pageTopBar.add(groupMovement);
    pageTopBar.add(groupDesktop);
    pageTopBar.add(groupAnimations);
    pageTopBar.add(groupActiveUI);
    pageTopBar.add(groupInactiveUI);

    return pageTopBar;
}