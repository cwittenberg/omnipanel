// omnipanel/prefs_hotkeys.js
import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';
import { t } from './i18n.js';

function createHotkeyRow(title, subtitle, hotkeyText) {
    const row = new Adw.ActionRow({
        title: title,
        subtitle: subtitle
    });
    
    if (typeof row.set_subtitle_lines === 'function') {
        row.set_subtitle_lines(0);
    }

    const shortcutLabel = new Gtk.Label({
        label: `<b>${hotkeyText}</b>`,
        use_markup: true,
        valign: Gtk.Align.CENTER,
        margin_start: 12,
        margin_end: 12
    });
    
    shortcutLabel.add_css_class('dim-label');

    row.add_suffix(shortcutLabel);
    return row;
}

export function buildHotkeysPage(settings) {
    const pageHotkeys = new Adw.PreferencesPage({
        title: t(settings, 'Hotkeys'),
        icon_name: 'keyboard-shortcuts-symbolic'
    });

    const groupSnapping = new Adw.PreferencesGroup({ 
        title: t(settings, 'Directional Snapping'),
        description: t(settings, 'Quickly snap the currently focused window into adjacent Drop Zones.')
    });
    groupSnapping.add(createHotkeyRow(t(settings, 'Snap Left'), t(settings, 'Move window to the nearest zone on the left.'), t(settings, 'Alt + Left')));
    groupSnapping.add(createHotkeyRow(t(settings, 'Snap Right'), t(settings, 'Move window to the nearest zone on the right.'), t(settings, 'Alt + Right')));
    groupSnapping.add(createHotkeyRow(t(settings, 'Snap Up'), t(settings, 'Move window to the nearest zone above.'), t(settings, 'Alt + Up')));
    groupSnapping.add(createHotkeyRow(t(settings, 'Snap Down'), t(settings, 'Move window to the nearest zone below.'), t(settings, 'Alt + Down')));
    pageHotkeys.add(groupSnapping);

    const groupOverride = new Adw.PreferencesGroup({
        title: t(settings, 'Drag & Drop Override'),
        description: t(settings, 'Bypass OmniPanel\'s layout engine for manual window placement.')
    });
    groupOverride.add(createHotkeyRow(
        t(settings, 'Temporarily Disable Snapping'), 
        t(settings, 'Hold this modifier while dragging a window to hide Drop Zones and allow free-floating placement. Releasing the window drops its zone affinity.'), 
        t(settings, 'Hold Alt (or Alt Gr)')
    ));
    pageHotkeys.add(groupOverride);

    const groupLayouts = new Adw.PreferencesGroup({
        title: t(settings, 'Layout Management'),
        description: t(settings, 'These shortcuts can be customized in the Layouts tab.')
    });
    groupLayouts.add(createHotkeyRow(
        t(settings, 'Cycle Layouts'), 
        t(settings, 'Instantly switch between your saved layouts.'), 
        t(settings, 'Configurable (Default: Alt + -)')
    ));
    groupLayouts.add(createHotkeyRow(
        t(settings, 'Activate Specific Layout'), 
        t(settings, 'Apply a specific saved layout using its assigned slot number.'), 
        t(settings, 'Configurable')
    ));
    pageHotkeys.add(groupLayouts);

    const groupStacks = new Adw.PreferencesGroup({
        title: t(settings, 'Stack Navigation'),
        description: t(settings, 'Interact with the Stack Indicator overlay when multiple windows share a zone.')
    });
    groupStacks.add(createHotkeyRow(
        t(settings, 'Cycle Stacked Windows'), 
        t(settings, 'While hovering over a Stack Indicator, use the arrow keys to quickly page through the stacked windows.'), 
        t(settings, 'Left / Right Arrows')
    ));
    pageHotkeys.add(groupStacks);

    const groupQuickTiler = new Adw.PreferencesGroup({
        title: t(settings, 'Quick Tiler (Grid Spawning)'),
        description: t(settings, 'Instantly resize the focused window using an interactive grid overlay. Configure this hotkey in the Layouts tab.')
    });
    groupQuickTiler.add(createHotkeyRow(
        t(settings, 'Open Quick Tiler'),
        t(settings, 'Press to spawn a centered 8x8 grid on the active monitor, then click and drag across cells to reshape the active window.'),
        t(settings, 'Configurable (Default: Super + G)')
    ));
    pageHotkeys.add(groupQuickTiler);

    return pageHotkeys;
}