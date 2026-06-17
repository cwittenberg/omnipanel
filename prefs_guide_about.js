// omnipanel/prefs_guide_about.js
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function createFeatureRow(title, subtitle, iconName) {
    const row = new Adw.ActionRow({
        title: title,
        subtitle: subtitle
    });
    
    if (typeof row.set_subtitle_lines === 'function') row.set_subtitle_lines(0);

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
    if (typeof row.set_subtitle_lines === 'function') {
        row.set_subtitle_lines(0);
    }
    return row;
}

function createLinkButton(title, uri, styleClass = null) {
    const button = new Gtk.Button({
        label: title,
        valign: Gtk.Align.CENTER
    });
    
    if (styleClass) {
        button.add_css_class(styleClass);
    }
    
    button.connect('clicked', () => {
        Gio.app_info_launch_default_for_uri(uri, null);
    });
    
    return button;
}

export function buildGuidePage() {
    const pageGuide = new Adw.PreferencesPage({
        title: _('Guide'),
        icon_name: 'system-help-symbolic'
    });

    const groupConcept = new Adw.PreferencesGroup();
    
    const heroBox = new Gtk.Box({ 
        orientation: Gtk.Orientation.VERTICAL, 
        spacing: 12, 
        margin_top: 5, 
        margin_bottom: 5,
        margin_start: 10,
        margin_end: 10
    });
    
    const heroDesc = new Gtk.Label({ 
        label: _('Multi-monitor productivity with configurable layouts for windows and a GNOME Top Bar that seamlessly follows your focus.'), 
        justify: Gtk.Justification.CENTER, 
        wrap: true 
    });
    
    // heroBox.append(heroIcon);
    // heroBox.append(heroTitle);
    heroBox.append(heroDesc);
    groupConcept.add(heroBox);
    pageGuide.add(groupConcept);

    const groupDesigner = new Adw.PreferencesGroup({ title: _('Window Layouts & The Zone Designer') });

    groupDesigner.add(createFeatureRow(
        _('Draw Your Workspace'),
        _('Open the OmniPanel system tray menu and toggle "Zone Designer Mode". Click and drag your mouse on any monitor to draw a rectangular zone, name it, and hit Save.'),
        'document-edit-symbolic'
    ));

    groupDesigner.add(createFeatureRow(
        _('Auto-Restore and Fuzzy Matching'),
        _('Layouts are automatically saved based on your current monitor setup. Unplug and replug your screens, and your customized layouts return instantly.'),
        'view-refresh-symbolic'
    ));
    pageGuide.add(groupDesigner);

    const groupPlacement = new Adw.PreferencesGroup({ title: _('Smart Placement & Exclusions') });

    groupPlacement.add(createFeatureRow(
        _('Auto-Routing and Affinity'),
        _('Name a zone "Terminals" and apps like Alacritty snap there automatically. Drag a window into a different zone, and OmniPanel learns your preference permanently.'),
        'focus-windows-symbolic'
    ));

    groupPlacement.add(createFeatureRow(
        _('Quick Desktop Access'),
        _('Use the "Show Desktop" button in the top bar to instantly minimize and restore windows on your current monitor.'),
        'computer-symbolic'
    ));

    groupPlacement.add(createFeatureRow(
        _('Ignored Applications'),
        _('Define a comma-separated list of app names (like "steam" or "gimp") in the layout settings to keep OmniPanel from ever managing them.'),
        'security-high-symbolic'
    ));

    groupPlacement.add(createFeatureRow(
        _('Show the GNOME Top Bar on All Monitors'),
        _('OmniPanel teleports the active Top Bar to the monitor where your focus is. See your current time, system tray, and app indicators no matter which screen you are on.'),
        'video-display-symbolic'
    ));

    groupPlacement.add(createFeatureRow(
        _('Active and Inactive Appearance'),
        _('Highlight the active Top Bar with a custom color, or make inactive panels translucent and distraction-free.'),
        'preferences-desktop-wallpaper-symbolic'
    ));
    pageGuide.add(groupPlacement);

    const groupHotkeys = new Adw.PreferencesGroup({ title: _('Hotkeys, Snapping & Stacks') });
    
    groupHotkeys.add(createFeatureRow(
        _('Window Stacks'),
        _('When multiple windows share the exact same zone, a Stack Indicator appears. Hover over it to quickly cycle apps or seamlessly expand them into Stack, Column, Row, or Grid views.'),
        'view-grid-symbolic'
    ));

    groupHotkeys.add(createFeatureRow(
        _('Directional Snapping and Cycling'),
        _('Press Alt + Arrows to intuitively snap the active window into a neighboring Drop Zone. Bind a hotkey to instantly loop through your saved Layouts.'),
        'keyboard-shortcuts-symbolic'
    ));
    pageGuide.add(groupHotkeys);

    return pageGuide;
}

export function buildAboutPage(settings, metadata, dir) {
    const pageAbout = new Adw.PreferencesPage({
        title: _('About'),
        icon_name: 'dialog-information-symbolic'
    });

    const groupAboutInfo = new Adw.PreferencesGroup({ title: _('Extension Information') });

    const logoRow = new Adw.ActionRow({
        title: _('OmniPanel'),
        subtitle: _('True multi-monitor capabilities for GNOME Shell.')
    });

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
    
    logoImg.add_css_class('circular');
    logoImg.add_css_class('icon-dropshadow');
    
    logoRow.add_prefix(logoImg);
    
    const versionStr = metadata.version ? metadata.version.toString() : _('Local / Development');
    const rowVersion = new Adw.ActionRow({ title: _('Version'), subtitle: versionStr });
    const rowAuthor = new Adw.ActionRow({ title: _('Author'), subtitle: 'Christian Wittenberg' });
    
    groupAboutInfo.add(wrap(logoRow));
    groupAboutInfo.add(wrap(rowVersion));
    groupAboutInfo.add(wrap(rowAuthor));

    const groupAdvanced = new Adw.PreferencesGroup({ title: _('Advanced') });
    
    const rowDebugLogs = new Adw.ActionRow({
        title: _('Enable Debug Logging'),
        subtitle: _('Outputs verbose troubleshooting logs to journalctl')
    });
    
    const switchDebugLogs = new Gtk.Switch({
        active: settings.get_boolean('enable-debug-logs'),
        valign: Gtk.Align.CENTER
    });
    
    settings.bind('enable-debug-logs', switchDebugLogs, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowDebugLogs.add_suffix(switchDebugLogs);
    groupAdvanced.add(wrap(rowDebugLogs));

    const groupLinks = new Adw.PreferencesGroup();

    const linkBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        halign: Gtk.Align.CENTER,
        margin_top: 24,
        margin_bottom: 24
    });

    linkBox.append(createLinkButton(
        _('Buy me a coffee') + ' 💙☕',
        'https://ko-fi.com/cwittenberg',
        'suggested-action' 
    ));

    linkBox.append(createLinkButton(
        _('Report a Bug') + ' 🪲',
        'https://github.com/cwittenberg/omnipanel/issues/new?template=bug_report.md'
    ));

    linkBox.append(createLinkButton(
        _('Request a Feature'),
        'https://github.com/cwittenberg/omnipanel/issues/new?template=feature_request.md'
    ));

    groupLinks.add(linkBox);

    pageAbout.add(groupLinks);
    pageAbout.add(groupAboutInfo);
    pageAbout.add(groupAdvanced);

    return pageAbout;
}