// omnipanel/prefs_hotkeys.js
import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';

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

export function buildHotkeysPage() {
    const pageHotkeys = new Adw.PreferencesPage({
        title: 'Hotkeys',
        icon_name: 'keyboard-shortcuts-symbolic'
    });

    // 1. Directional Snapping
    const groupSnapping = new Adw.PreferencesGroup({ 
        title: 'Directional Snapping',
        description: 'Quickly snap the currently focused window into adjacent Drop Zones.'
    });
    groupSnapping.add(createHotkeyRow('Snap Left', 'Move window to the nearest zone on the left.', 'Alt + Left'));
    groupSnapping.add(createHotkeyRow('Snap Right', 'Move window to the nearest zone on the right.', 'Alt + Right'));
    groupSnapping.add(createHotkeyRow('Snap Up', 'Move window to the nearest zone above.', 'Alt + Up'));
    groupSnapping.add(createHotkeyRow('Snap Down', 'Move window to the nearest zone below.', 'Alt + Down'));
    pageHotkeys.add(groupSnapping);

    // 2. Drag Override
    const groupOverride = new Adw.PreferencesGroup({
        title: 'Drag & Drop Override',
        description: 'Bypass OmniPanel\'s layout engine for manual window placement.'
    });
    groupOverride.add(createHotkeyRow(
        'Temporarily Disable Snapping', 
        'Hold this modifier while dragging a window to hide Drop Zones and allow free-floating placement. Releasing the window drops its zone affinity.', 
        'Hold Alt (or Alt Gr)'
    ));
    pageHotkeys.add(groupOverride);

    // 3. Layouts & Workspaces
    const groupLayouts = new Adw.PreferencesGroup({
        title: 'Layout Management',
        description: 'These shortcuts can be customized in the Layouts tab.'
    });
    groupLayouts.add(createHotkeyRow(
        'Cycle Layouts', 
        'Instantly switch between your saved layouts.', 
        'Configurable (Default: Alt + -)'
    ));
    groupLayouts.add(createHotkeyRow(
        'Activate Specific Layout', 
        'Apply a specific saved layout using its assigned slot number.', 
        'Configurable'
    ));
    pageHotkeys.add(groupLayouts);

    // 4. Window Stacks
    const groupStacks = new Adw.PreferencesGroup({
        title: 'Stack Navigation',
        description: 'Interact with the Stack Indicator overlay when multiple windows share a zone.'
    });
    groupStacks.add(createHotkeyRow(
        'Cycle Stacked Windows', 
        'While hovering over a Stack Indicator, use the arrow keys to quickly page through the stacked windows.', 
        'Left / Right Arrows'
    ));
    pageHotkeys.add(groupStacks);

    return pageHotkeys;
}