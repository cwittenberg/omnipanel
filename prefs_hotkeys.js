// omnipanel/prefs_hotkeys.js
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function createHotkeyRow(title, subtitle, hotkeyText) {
    const row = new Adw.ActionRow({
        title: title,
        subtitle: subtitle
    });
    
    row.set_subtitle_lines(0);

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

export function buildHotkeysPage() {
    const pageHotkeys = new Adw.PreferencesPage({
        title: _('Hotkeys'),
        icon_name: 'keyboard-shortcuts-symbolic'
    });

    const groupSnapping = new Adw.PreferencesGroup({ 
        title: _('Directional Snapping'),
        description: _('Quickly snap the currently focused window into adjacent Drop Zones.')
    });
    groupSnapping.add(createHotkeyRow(_('Snap Left'), _('Move window to the nearest zone on the left.'), _('Alt + Left')));
    groupSnapping.add(createHotkeyRow(_('Snap Right'), _('Move window to the nearest zone on the right.'), _('Alt + Right')));
    groupSnapping.add(createHotkeyRow(_('Snap Up'), _('Move window to the nearest zone above.'), _('Alt + Up')));
    groupSnapping.add(createHotkeyRow(_('Snap Down'), _('Move window to the nearest zone below.'), _('Alt + Down')));
    pageHotkeys.add(groupSnapping);

    const groupOverride = new Adw.PreferencesGroup({
        title: _('Drag & Drop Override'),
        description: _('Bypass OmniPanel\'s layout engine for manual window placement.')
    });
    groupOverride.add(createHotkeyRow(
        _('Temporarily Disable Snapping'), 
        _('Hold this modifier while dragging a window to hide Drop Zones and allow free-floating placement. Releasing the window drops its zone affinity.'), 
        _('Hold Alt (or Alt Gr)')
    ));
    pageHotkeys.add(groupOverride);

    const groupLayouts = new Adw.PreferencesGroup({
        title: _('Layout Management'),
        description: _('These shortcuts can be customized in the Layouts tab.')
    });
    groupLayouts.add(createHotkeyRow(
        _('Cycle Layouts'), 
        _('Instantly switch between your saved layouts.'), 
        _('Configurable (Default: Alt + -)')
    ));
    groupLayouts.add(createHotkeyRow(
        _('Activate Specific Layout'), 
        _('Apply a specific saved layout using its assigned slot number.'), 
        _('Configurable')
    ));
    pageHotkeys.add(groupLayouts);

    const groupStacks = new Adw.PreferencesGroup({
        title: _('Stack Navigation'),
        description: _('Interact with the Stack Indicator overlay when multiple windows share a zone.')
    });
    groupStacks.add(createHotkeyRow(
        _('Cycle Stacked Windows'), 
        _('While hovering over a Stack Indicator, use the arrow keys to quickly page through the stacked windows.'), 
        _('Left / Right Arrows')
    ));
    pageHotkeys.add(groupStacks);

    const groupQuickTiler = new Adw.PreferencesGroup({
        title: _('Quick Tiler (Grid Spawning)'),
        description: _('Instantly resize the focused window using an interactive grid overlay. Configure this hotkey in the Layouts tab.')
    });
    groupQuickTiler.add(createHotkeyRow(
        _('Open Quick Tiler'),
        _('Press to spawn a centered 8x8 grid on the active monitor, then click and drag across cells to reshape the active window.'),
        _('Configurable (Default: Super + G)')
    ));
    pageHotkeys.add(groupQuickTiler);

    return pageHotkeys;
}