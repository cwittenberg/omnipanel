import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

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

export function buildGuidePage() {
    const pageGuide = new Adw.PreferencesPage({
        title: 'Guide',
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
    
    const heroIcon = new Gtk.Image({ 
        icon_name: 'view-dual-symbolic', 
        pixel_size: 80 
    });
    
    const heroTitle = new Gtk.Label({ 
        label: '<span size="xx-large" weight="bold">OmniPanel</span>', 
        use_markup: true, 
        justify: Gtk.Justification.CENTER 
    });
    
    const heroDesc = new Gtk.Label({ 
        label: 'True multi-monitor capabilities. OmniPanel replaces rigid grids with intelligent, user-drawn "Drop Zones" and teleports a single, active Top Bar to seamlessly follow your focus.', 
        justify: Gtk.Justification.CENTER, 
        wrap: true 
    });
    
    heroBox.append(heroIcon);
    heroBox.append(heroTitle);
    heroBox.append(heroDesc);
    groupConcept.add(heroBox);
    pageGuide.add(groupConcept);

    
    // 3. Window Layouts & The Zone Designer
    const groupDesigner = new Adw.PreferencesGroup({ title: 'Window Layouts & The Zone Designer' });
    groupDesigner.add(createFeatureRow(
        'Draw Your Workspace',
        'Open the OmniPanel system tray menu and toggle "Zone Designer Mode". Click and drag your mouse on any monitor to draw a rectangular zone, name it, and hit Save.',
        'document-edit-symbolic'
    ));
    groupDesigner.add(createFeatureRow(
        'Auto-Restore and Fuzzy Matching',
        'Layouts are automatically saved based on your current monitor setup. Unplug and replug your screens, and your customized layouts return instantly.',
        'view-refresh-symbolic'
    ));
    pageGuide.add(groupDesigner);

    // 4. Smart Placement & Exclusions
    const groupPlacement = new Adw.PreferencesGroup({ title: 'Smart Placement & Exclusions' });
    groupPlacement.add(createFeatureRow(
        'Auto-Routing and Affinity',
        'Name a zone "Terminals" and apps like Alacritty snap there automatically. Drag a window into a different zone, and OmniPanel learns your preference permanently.',
        'focus-windows-symbolic'
    ));
    groupPlacement.add(createFeatureRow(
        'Quick Desktop Access',
        'Use the "Show Desktop" button in the top bar to instantly minimize and restore windows on your current monitor.',
        'computer-symbolic'
    ));
    groupPlacement.add(createFeatureRow(
        'Ignored Applications',
        'Define a comma-separated list of app names (like "steam" or "gimp") in the layout settings to keep OmniPanel from ever managing them.',
        'security-high-symbolic'
    ));

    groupPlacement.add(createFeatureRow(
        'Show the GNOME Top Bar on All Monitors',
        'OmniPanel teleports the active Top Bar to the monitor where your focus is. See your current time, system tray, and app indicators no matter which screen you are on.',
        'video-display-symbolic'
    ));
    groupPlacement.add(createFeatureRow(
        'Active and Inactive Appearance',
        'Highlight the active Top Bar with a custom color, or make inactive panels translucent and distraction-free.',
        'preferences-desktop-wallpaper-symbolic'
    ));
    pageGuide.add(groupPlacement);

    // 5. Hotkeys, Snapping & Stacks
    const groupHotkeys = new Adw.PreferencesGroup({ title: 'Hotkeys, Snapping & Stacks' });
    
    groupHotkeys.add(createFeatureRow(
        'Window Stacks',
        'When multiple windows share the exact same zone, a Stack Indicator appears. Hover over it to quickly cycle apps or seamlessly expand them into Stack, Column, Row, or Grid views.',
        'view-grid-symbolic'
    ));
    groupHotkeys.add(createFeatureRow(
        'Directional Snapping and Cycling',
        'Press Alt + Arrows to intuitively snap the active window into a neighboring Drop Zone. Bind a hotkey to instantly loop through your saved Layouts.',
        'keyboard-shortcuts-symbolic'
    ));
    pageGuide.add(groupHotkeys);

    return pageGuide;
}

export function buildAboutPage(settings, metadata) {
    const pageAbout = new Adw.PreferencesPage({
        title: 'About',
        icon_name: 'dialog-information-symbolic'
    });

    const groupAboutInfo = new Adw.PreferencesGroup({ title: 'Extension Information' });

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
    
    const versionStr = metadata.version ? metadata.version.toString() : 'Local / Development';
    const rowVersion = new Adw.ActionRow({ title: 'Version', subtitle: versionStr });
    const rowAuthor = new Adw.ActionRow({ title: 'Author', subtitle: 'Christian Wittenberg' });
    
    groupAboutInfo.add(logoRow);
    groupAboutInfo.add(rowVersion);
    groupAboutInfo.add(rowAuthor);

    // --- Advanced Settings Group ---
    const groupAdvanced = new Adw.PreferencesGroup({ title: 'Advanced' });
    
    const rowDebugLogs = new Adw.ActionRow({
        title: 'Enable Debug Logging',
        subtitle: 'Outputs verbose troubleshooting logs to journalctl'
    });
    
    const switchDebugLogs = new Gtk.Switch({
        active: settings.get_boolean('enable-debug-logs'),
        valign: Gtk.Align.CENTER
    });
    
    settings.bind('enable-debug-logs', switchDebugLogs, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowDebugLogs.add_suffix(switchDebugLogs);
    groupAdvanced.add(rowDebugLogs);

    pageAbout.add(groupAboutInfo);
    pageAbout.add(groupAdvanced);

    return pageAbout;
}