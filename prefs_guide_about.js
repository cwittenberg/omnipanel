// omnipanel/prefs_guide_about.js
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import { t, LANGUAGES } from './i18n.js';

function createFeatureRow(title, subtitle, iconName) {
    const row = new Adw.ActionRow({
        title: title,
        subtitle: subtitle
    });
    
    // Allow subtitles to wrap gracefully on smaller windows
    if (typeof row.set_subtitle_lines === 'function') {
        row.set_subtitle_lines(0);
    }

    const icon = new Gtk.Image({
        icon_name: iconName,
        pixel_size: 32,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 8,
        margin_end: 8
    });
    
    row.add_prefix(icon);
    return row;
}

function wrap(row) {
    if (row && typeof row.set_subtitle_lines === 'function') {
        row.set_subtitle_lines(0);
    }
    return row;
}

export function buildGuidePage(settings, dir) {
    const pageGuide = new Adw.PreferencesPage({
        title: t(settings, 'Guide'),
        icon_name: 'system-help-symbolic'
    });

    // 1. Core Philosophy (Visual Hero Section)
    const groupConcept = new Adw.PreferencesGroup();
    
    const heroBox = new Gtk.Box({ 
        orientation: Gtk.Orientation.VERTICAL, 
        spacing: 12, 
        margin_top: 32, 
        margin_bottom: 32,
        margin_start: 24,
        margin_end: 24
    });
    
    // Resolve the local path using the extension directory
    const imagePath = dir.get_child('logo.png').get_path();
    const gfile = Gio.File.new_for_path(imagePath);
    
    // Gtk.Picture is ideal for local files with explicit dimension requests in GTK4
    const heroIcon = new Gtk.Picture({
        file: gfile,
        can_shrink: true,
        width_request: 34,
        height_request: 34,
        content_fit: Gtk.ContentFit.CONTAIN
    });
    
    // Add built-in GTK CSS classes to make the image rounded and cast a subtle shadow
    heroIcon.add_css_class('circular');
    heroIcon.add_css_class('icon-dropshadow');
    
    const heroTitle = new Gtk.Label({ 
        label: `<span size="xx-large" weight="bold">${t(settings, 'OmniPanel')}</span>`, 
        use_markup: true, 
        justify: Gtk.Justification.CENTER 
    });
    
    const heroDesc = new Gtk.Label({ 
        label: t(settings, 'Multi-monitor productivity with configurable layouts for windows and a GNOME Top Bar that seamlessly follows your focus.'), 
        justify: Gtk.Justification.CENTER, 
        wrap: true 
    });
    
    heroBox.append(heroIcon);
    heroBox.append(heroTitle);
    heroBox.append(heroDesc);
    groupConcept.add(heroBox);
    pageGuide.add(groupConcept);

    // 3. Window Layouts & The Zone Designer
    const groupDesigner = new Adw.PreferencesGroup({ title: t(settings, 'Window Layouts & The Zone Designer') });
    groupDesigner.add(createFeatureRow(
        t(settings, 'Draw Your Workspace'),
        t(settings, 'Open the OmniPanel system tray menu and toggle "Zone Designer Mode". Click and drag your mouse on any monitor to draw a rectangular zone, name it, and hit Save.'),
        'document-edit-symbolic'
    ));
    groupDesigner.add(createFeatureRow(
        t(settings, 'Auto-Restore and Fuzzy Matching'),
        t(settings, 'Layouts are automatically saved based on your current monitor setup. Unplug and replug your screens, and your customized layouts return instantly.'),
        'view-refresh-symbolic'
    ));
    pageGuide.add(groupDesigner);

    // 4. Smart Placement & Exclusions
    const groupPlacement = new Adw.PreferencesGroup({ title: t(settings, 'Smart Placement & Exclusions') });
    groupPlacement.add(createFeatureRow(
        t(settings, 'Auto-Routing and Affinity'),
        t(settings, 'Name a zone "Terminals" and apps like Alacritty snap there automatically. Drag a window into a different zone, and OmniPanel learns your preference permanently.'),
        'focus-windows-symbolic'
    ));
    groupPlacement.add(createFeatureRow(
        t(settings, 'Quick Desktop Access'),
        t(settings, 'Use the "Show Desktop" button in the top bar to instantly minimize and restore windows on your current monitor.'),
        'computer-symbolic'
    ));
    groupPlacement.add(createFeatureRow(
        t(settings, 'Ignored Applications'),
        t(settings, 'Define a comma-separated list of app names (like "steam" or "gimp") in the layout settings to keep OmniPanel from ever managing them.'),
        'security-high-symbolic'
    ));

    groupPlacement.add(createFeatureRow(
        t(settings, 'Show the GNOME Top Bar on All Monitors'),
        t(settings, 'OmniPanel teleports the active Top Bar to the monitor where your focus is. See your current time, system tray, and app indicators no matter which screen you are on.'),
        'video-display-symbolic'
    ));
    groupPlacement.add(createFeatureRow(
        t(settings, 'Active and Inactive Appearance'),
        t(settings, 'Highlight the active Top Bar with a custom color, or make inactive panels translucent and distraction-free.'),
        'preferences-desktop-wallpaper-symbolic'
    ));
    pageGuide.add(groupPlacement);

    // 5. Hotkeys, Snapping & Stacks
    const groupHotkeys = new Adw.PreferencesGroup({ title: t(settings, 'Hotkeys, Snapping & Stacks') });
    
    groupHotkeys.add(createFeatureRow(
        t(settings, 'Window Stacks'),
        t(settings, 'When multiple windows share the exact same zone, a Stack Indicator appears. Hover over it to quickly cycle apps or seamlessly expand them into Stack, Column, Row, or Grid views.'),
        'view-grid-symbolic'
    ));
    groupHotkeys.add(createFeatureRow(
        t(settings, 'Directional Snapping and Cycling'),
        t(settings, 'Press Alt + Arrows to intuitively snap the active window into a neighboring Drop Zone. Bind a hotkey to instantly loop through your saved Layouts.'),
        'keyboard-shortcuts-symbolic'
    ));
    pageGuide.add(groupHotkeys);

    return pageGuide;
}

export function buildAboutPage(settings, metadata, dir) {
    const pageAbout = new Adw.PreferencesPage({
        title: t(settings, 'About'),
        icon_name: 'dialog-information-symbolic'
    });

    // --- Language Settings Group ---
    const groupLang = new Adw.PreferencesGroup({ title: t(settings, 'Language Settings') });
    
    const rowLang = new Adw.ComboRow({
        title: t(settings, 'Interface Language'),
        subtitle: t(settings, 'Choose the display language for OmniPanel elements and configurations'),
        model: Gtk.StringList.new(LANGUAGES.map(l => l.name))
    });
    
    let currentLang = settings.get_string('language');
    let langIndex = LANGUAGES.findIndex(l => l.id === currentLang);
    rowLang.selected = langIndex >= 0 ? langIndex : 0;
    
    rowLang.connect('notify::selected', () => {
        let selectedId = LANGUAGES[rowLang.selected].id;
        settings.set_string('language', selectedId);
    });
    
    groupLang.add(wrap(rowLang));

    // --- Extension Information Group ---
    const groupAboutInfo = new Adw.PreferencesGroup({ title: t(settings, 'Extension Information') });

    const logoRow = new Adw.ActionRow({
        title: t(settings, 'OmniPanel'),
        subtitle: t(settings, 'True multi-monitor capabilities for GNOME Shell.')
    });

    // Resolve the local path using the extension directory for the About page as well
    const imagePath = dir.get_child('logo.png').get_path();
    const gfile = Gio.File.new_for_path(imagePath);

    const logoImg = new Gtk.Picture({
        file: gfile,
        can_shrink: true,
        width_request: 48,
        height_request: 48,
        content_fit: Gtk.ContentFit.CONTAIN,
        margin_end: 16
    });
    
    // Add built-in GTK CSS classes to make the image rounded and cast a subtle shadow
    logoImg.add_css_class('circular');
    logoImg.add_css_class('icon-dropshadow');
    
    logoRow.add_prefix(logoImg);
    
    const versionStr = metadata.version ? metadata.version.toString() : t(settings, 'Local / Development');
    const rowVersion = new Adw.ActionRow({ title: t(settings, 'Version'), subtitle: versionStr });
    const rowAuthor = new Adw.ActionRow({ title: t(settings, 'Author'), subtitle: t(settings, 'Christian Wittenberg') });
    
    groupAboutInfo.add(wrap(logoRow));
    groupAboutInfo.add(wrap(rowVersion));
    groupAboutInfo.add(wrap(rowAuthor));

    // --- Advanced Settings Group ---
    const groupAdvanced = new Adw.PreferencesGroup({ title: t(settings, 'Advanced') });
    
    const rowDebugLogs = new Adw.ActionRow({
        title: t(settings, 'Enable Debug Logging'),
        subtitle: t(settings, 'Outputs verbose troubleshooting logs to journalctl')
    });
    
    const switchDebugLogs = new Gtk.Switch({
        active: settings.get_boolean('enable-debug-logs'),
        valign: Gtk.Align.CENTER
    });
    
    settings.bind('enable-debug-logs', switchDebugLogs, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowDebugLogs.add_suffix(switchDebugLogs);
    groupAdvanced.add(wrap(rowDebugLogs));

    pageAbout.add(groupLang);
    pageAbout.add(groupAboutInfo);
    pageAbout.add(groupAdvanced);

    return pageAbout;
}