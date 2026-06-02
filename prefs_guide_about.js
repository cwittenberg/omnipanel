import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

export function buildGuidePage() {
    const pageGuide = new Adw.PreferencesPage({
        title: 'Guide',
        icon_name: 'system-help-symbolic'
    });

    const groupConcept = new Adw.PreferencesGroup({
        title: '1. Core Philosophy',
        description: 'OmniPanel provides true multi-monitor capabilities. It replaces rigid grids with intelligent, user-drawn "Drop Zones" that remember app affinities, and dynamically teleports a single, active Top Bar to follow your focus. This provides a seamless, context-aware workspace out of the box.'
    });

    const groupTopBar = new Adw.PreferencesGroup({
        title: '2. The Multi-Monitor Top Panel',
        description: 'OmniPanel actively moves your primary GNOME top bar to your active monitor, ensuring extensions and indicators follow your focus.\n\n• Animations: Customize how the panel transitions between screens (Instant, Fade, Slide Down, or Pop).\n• Appearance: Highlight the active panel with a custom color, or make inactive panels translucent (or completely hidden).\n• Show Desktop: Optionally enable a quick button in the top bar to minimize and restore windows on the current monitor.'
    });

    const groupDesigner = new Adw.PreferencesGroup({
        title: '3. Window Layouts & The Zone Designer',
        description: 'Organize your workspace by drawing persistent Drop Zones:\n\n1. Open the OmniPanel system tray menu and toggle "Zone Designer Mode" on.\n2. Click and drag your mouse on any monitor to draw a rectangular zone.\n3. Type a name (e.g., "Browser", "Terminal") and hit Save.\n\n• Auto-Restore & Fuzzy Match: OmniPanel automatically saves your layouts based on your current monitor setup. If you unplug and replug monitors, it restores the layout when the monitor count matches.\n• Default Startup Layout: Select which saved layout should be applied instantly when you start your computer.'
    });

    const groupPlacement = new Adw.PreferencesGroup({
        title: '4. Smart Placement & Exclusions',
        description: 'OmniPanel acts as an intelligent assistant using Fuzzy Auto-Placement to sort your windows.\n\n• Auto-Routing: If you name a zone "Terminals", apps like Alacritty or GNOME Terminal snap there automatically. Naming a zone "Web" routes Firefox and Chrome.\n• App Affinity: If you manually drag a window into a different zone, OmniPanel permanently learns your preference for that app.\n• Ignored Applications: Use the Exclusions setting to define a comma-separated list of app names (like "steam" or "gimp") that OmniPanel should completely ignore.'
    });

    const groupHotkeys = new Adw.PreferencesGroup({
        title: '5. Hotkeys, Snapping & Stacks',
        description: 'Master your workspace with hotkeys and visual overlays.\n\n• Cycle Layouts: Press your configured hotkey to instantly loop through your saved Layouts.\n• Directional Snapping: Use Alt + Left, Right, Up, or Down to snap the active window into a neighboring Drop Zone.\n• Window Stacks: If multiple windows share the same zone, a Stack Indicator appears. Hover over it to cycle between them or instantly expand them using four modes: Stack (overlapping), Columns (side-by-side), Rows (vertical list), or Grid (tiled).'
    });

    pageGuide.add(groupConcept);
    pageGuide.add(groupTopBar);
    pageGuide.add(groupDesigner);
    pageGuide.add(groupPlacement);
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