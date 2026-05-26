import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * OmniPanelPreferences
 * Handles the configuration UI for the extension using GTK4 and Libadwaita.
 */
export default class OmniPanelPreferences extends ExtensionPreferences {
    
    /**
     * Constructs the GTK window for the extension preferences.
     * @param {Adw.PreferencesWindow} window - The main preferences window passed by GNOME Shell.
     */
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({ 
            title: 'OmniPanel Settings', 
            icon_name: 'preferences-system-symbolic' 
        });
        
        const groupMovement = new Adw.PreferencesGroup({ title: 'Active Toolbar Movement' });
        const groupAnimations = new Adw.PreferencesGroup({ title: 'Animation Effects' });
        const groupActiveUI = new Adw.PreferencesGroup({ title: 'Active Panel Appearance' });
        const groupInactiveUI = new Adw.PreferencesGroup({ title: 'Inactive Panel Appearance' });
        const groupAbout = new Adw.PreferencesGroup({ title: 'About' });

        // --- Active Toolbar Movement Group ---
        const rowEnabled = new Adw.ActionRow({ 
            title: 'Enable Toolbar Movement', 
            subtitle: 'Dynamically move the real native panel to the active screen' 
        });
        const switchEnabled = new Gtk.Switch({ 
            active: settings.get_boolean('movement-enabled'), 
            valign: Gtk.Align.CENTER 
        });
        settings.bind('movement-enabled', switchEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
        rowEnabled.add_suffix(switchEnabled);
        groupMovement.add(rowEnabled);

        const rowSpeed = new Adw.ComboRow({
            title: 'Movement Response Speed',
            subtitle: 'Balance between snappiness and CPU usage',
            model: Gtk.StringList.new(['Fast (100ms)', 'Normal (200ms)', 'Battery Saver (500ms)'])
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
        groupMovement.add(rowSpeed);

        // --- Animation Effects Group ---
        const rowAnimStyle = new Adw.ComboRow({
            title: 'Movement Animation Style',
            subtitle: 'Visual effect when extensions arrive on the new screen',
            model: Gtk.StringList.new(['None (Instant)', 'Fade', 'Slide Down', 'Pop'])
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
        groupAnimations.add(rowAnimStyle);

        const durationAdjustment = new Gtk.Adjustment({ 
            lower: 100, upper: 1000, step_increment: 50, value: settings.get_int('animation-duration') 
        });
        const rowDuration = new Adw.SpinRow({ 
            title: 'Animation Duration (ms)', 
            adjustment: durationAdjustment, 
            digits: 0 
        });
        settings.bind('animation-duration', rowDuration, 'value', Gio.SettingsBindFlags.DEFAULT);
        groupAnimations.add(rowDuration);

        // --- Active Panel Appearance Group ---
        const rowHighlight = new Adw.ActionRow({ 
            title: 'Highlight Active Panel', 
            subtitle: 'Change the background color of the active monitor\'s top bar' 
        });
        const switchHighlight = new Gtk.Switch({ 
            active: settings.get_boolean('highlight-active'), 
            valign: Gtk.Align.CENTER 
        });
        settings.bind('highlight-active', switchHighlight, 'active', Gio.SettingsBindFlags.DEFAULT);
        rowHighlight.add_suffix(switchHighlight);
        groupActiveUI.add(rowHighlight);

        const rowColor = new Adw.ActionRow({ title: 'Active Panel Color' });
        const colorDialog = new Gtk.ColorDialog();
        const colorBtn = new Gtk.ColorDialogButton({ dialog: colorDialog, valign: Gtk.Align.CENTER });
        
        let rgba = new Gdk.RGBA();
        rgba.parse(settings.get_string('active-panel-color'));
        colorBtn.set_rgba(rgba);

        colorBtn.connect('notify::rgba', () => {
            settings.set_string('active-panel-color', colorBtn.get_rgba().to_string());
        });
        rowColor.add_suffix(colorBtn);
        groupActiveUI.add(rowColor);

        // --- Inactive Panel Appearance Group ---
        const rowTranslucent = new Adw.ActionRow({ 
            title: 'Translucent Inactive Bars', 
            subtitle: 'Make the top bar fade out on inactive monitors' 
        });
        const switchTranslucent = new Gtk.Switch({ 
            active: settings.get_boolean('translucent-inactive'), 
            valign: Gtk.Align.CENTER 
        });
        settings.bind('translucent-inactive', switchTranslucent, 'active', Gio.SettingsBindFlags.DEFAULT);
        rowTranslucent.add_suffix(switchTranslucent);
        groupInactiveUI.add(rowTranslucent);

        const opacityAdjustment = new Gtk.Adjustment({ 
            lower: 0.1, upper: 1.0, step_increment: 0.05, value: settings.get_double('inactive-opacity') 
        });
        const rowOpacity = new Adw.SpinRow({ 
            title: 'Inactive Opacity Level', 
            adjustment: opacityAdjustment, 
            digits: 2 
        });
        settings.bind('inactive-opacity', rowOpacity, 'value', Gio.SettingsBindFlags.DEFAULT);
        groupInactiveUI.add(rowOpacity);

        const rowClock = new Adw.ActionRow({ 
            title: 'Show Static Clock Label', 
            subtitle: 'Shows a non-clickable clock on inactive monitors' 
        });
        const switchClock = new Gtk.Switch({ 
            active: settings.get_boolean('show-clock'), 
            valign: Gtk.Align.CENTER 
        });
        settings.bind('show-clock', switchClock, 'active', Gio.SettingsBindFlags.DEFAULT);
        rowClock.add_suffix(switchClock);
        groupInactiveUI.add(rowClock);

        const rowHideInactive = new Adw.ActionRow({ 
            title: 'Hide toolbars on inactive screens', 
            subtitle: 'Make inactive top bars completely invisible' 
        });
        const switchHideInactive = new Gtk.Switch({ 
            active: settings.get_boolean('hide-inactive-panels'), 
            valign: Gtk.Align.CENTER 
        });
        settings.bind('hide-inactive-panels', switchHideInactive, 'active', Gio.SettingsBindFlags.DEFAULT);
        rowHideInactive.add_suffix(switchHideInactive);
        groupInactiveUI.add(rowHideInactive);

        const syncInactiveSensitivities = () => {
            let isHidden = switchHideInactive.get_active();
            rowTranslucent.set_sensitive(!isHidden);
            rowOpacity.set_sensitive(!isHidden);
            rowClock.set_sensitive(!isHidden);
        };
        switchHideInactive.connect('notify::active', syncInactiveSensitivities);
        syncInactiveSensitivities();

        // --- About Section Group ---
        const logoRow = new Adw.ActionRow({ 
            title: 'OmniPanel', 
            subtitle: 'True multi-monitor capabilities for GNOME Shell.' 
        });
        const logoImg = new Gtk.Image({ 
            icon_name: 'view-dual-symbolic', 
            pixel_size: 48, 
            margin_end: 16 
        });
        logoRow.add_prefix(logoImg);
        
        // Use a safe fallback for the version string, as EGO overrides metadata.json upon publication
        const versionStr = this.metadata.version ? this.metadata.version.toString() : 'Local / Development';
        const rowVersion = new Adw.ActionRow({ title: 'Version', subtitle: versionStr });
        const rowAuthor = new Adw.ActionRow({ title: 'Author', subtitle: 'Christian Wittenberg' });
        
        groupAbout.add(logoRow);
        groupAbout.add(rowVersion);
        groupAbout.add(rowAuthor);

        // Assemble Page Hierarchy
        page.add(groupMovement);
        page.add(groupAnimations);
        page.add(groupActiveUI);
        page.add(groupInactiveUI);
        page.add(groupAbout);
        
        window.add(page);
    }
}