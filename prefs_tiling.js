// omnipanel/prefs_tiling.js
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import { ShortcutButton, DictionaryConfigWindow } from './prefs_components.js';

export default function buildTilingPage(settings, window) {
    const pageTiling = new Adw.PreferencesPage({ 
        title: 'Layouts', 
        icon_name: 'view-grid-symbolic' 
    });

    // --- Master Toggle ---
    const groupMaster = new Adw.PreferencesGroup();

    const rowTilingEnabled = new Adw.ActionRow({ 
        title: 'Enable Window Management', 
        subtitle: 'Master switch for all OmniPanel tiling, snapping, and layout features' 
    });
    const switchTilingEnabled = new Gtk.Switch({ 
        active: settings.get_boolean('enable-tiling'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('enable-tiling', switchTilingEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowTilingEnabled.add_suffix(switchTilingEnabled);
    groupMaster.add(rowTilingEnabled);

    // --- Zone-Based Tiling ---
    const groupZone = new Adw.PreferencesGroup({ title: 'Zone-Based Tiling' });

    const rowDesigner = new Adw.ActionRow({ 
        title: 'Zone Designer Mode', 
        subtitle: 'Draw and configure drop zones visually across your screens' 
    });
    const switchDesigner = new Gtk.Switch({ 
        active: settings.get_boolean('designer-active'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('designer-active', switchDesigner, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowDesigner.add_suffix(switchDesigner);
    groupZone.add(rowDesigner);

    const rowAutoRestore = new Adw.ActionRow({ 
        title: 'Auto-Restore Layouts', 
        subtitle: 'Remember window positions based on monitor setups' 
    });
    const switchAutoRestore = new Gtk.Switch({ 
        active: settings.get_boolean('auto-restore-layouts'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('auto-restore-layouts', switchAutoRestore, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowAutoRestore.add_suffix(switchAutoRestore);
    groupZone.add(rowAutoRestore);

    const rowFuzzyMatch = new Adw.ActionRow({ 
        title: 'Fuzzy Monitor Matching', 
        subtitle: 'Restore layouts if monitor count matches despite resolution changes' 
    });
    const switchFuzzyMatch = new Gtk.Switch({ 
        active: settings.get_boolean('fuzzy-restore-monitors'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('fuzzy-restore-monitors', switchFuzzyMatch, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowFuzzyMatch.add_suffix(switchFuzzyMatch);
    groupZone.add(rowFuzzyMatch);

    // --- Tiling Settings -> Automation & Defaults ---
    const groupAutomation = new Adw.PreferencesGroup({ title: 'Automation & Defaults' });

    const rowSmartPlacement = new Adw.ActionRow({ 
        title: 'Fuzzy Auto-Placement', 
        subtitle: 'Automatically assign new unrecognized windows to zones matching their name or category' 
    });
    const switchSmartPlacement = new Gtk.Switch({ 
        active: settings.get_boolean('enable-smart-placement'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('enable-smart-placement', switchSmartPlacement, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowSmartPlacement.add_suffix(switchSmartPlacement);
    groupAutomation.add(rowSmartPlacement);

    const rowAffinity = new Adw.ActionRow({
        title: 'Remember App Affinity',
        subtitle: 'Restore apps to their last known zone upon relaunch'
    });
    const switchAffinity = new Gtk.Switch({
        active: settings.get_boolean('remember-app-affinity'),
        valign: Gtk.Align.CENTER
    });
    settings.bind('remember-app-affinity', switchAffinity, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowAffinity.add_suffix(switchAffinity);
    groupAutomation.add(rowAffinity);

    const rowDict = new Adw.ActionRow({
        title: 'Configure Auto-Placement Rules',
        subtitle: 'Easily manage app keywords and categories for layout routing'
    });
    const btnDict = new Gtk.Button({
        label: 'Configure',
        valign: Gtk.Align.CENTER
    });
    btnDict.connect('clicked', () => {
        let configWin = new DictionaryConfigWindow(settings, window);
        configWin.present();
    });
    rowDict.add_suffix(btnDict);
    groupAutomation.add(rowDict);

    let rowDefaultLayout = new Adw.ComboRow({
        title: 'Default Startup Layout',
        subtitle: 'Layout applied automatically when extension loads'
    });
    groupAutomation.add(rowDefaultLayout);

    // --- Tiling Settings -> Window Exclusions ---
    const groupExclusions = new Adw.PreferencesGroup({ 
        title: 'Window Exclusions',
        description: 'Provide a comma-separated list of application names (e.g. gimp, steam) to completely exclude them from being snapped or managed by OmniPanel.'
    });

    const rowIgnoreList = new Adw.EntryRow({
        title: 'Ignored Applications'
    });
    let currentIgnore = settings.get_strv('ignore-wm-classes') || [];
    rowIgnoreList.set_text(currentIgnore.join(', '));
    
    rowIgnoreList.connect('notify::text', () => {
        let text = rowIgnoreList.get_text();
        let arr = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
        settings.set_strv('ignore-wm-classes', arr);
    });
    groupExclusions.add(rowIgnoreList);

    // --- Tiling Settings -> Stacks ---
    const groupStacks = new Adw.PreferencesGroup({ title: 'Stack Indicators' });

    const rowStacks = new Adw.ActionRow({ 
        title: 'Zone Stack Indicators', 
        subtitle: 'Show a fast-switching overlay when multiple windows share the same drop zone' 
    });
    const switchStacks = new Gtk.Switch({ 
        active: settings.get_boolean('enable-stack-indicators'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('enable-stack-indicators', switchStacks, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowStacks.add_suffix(switchStacks);
    groupStacks.add(rowStacks);

    const rowStackPos = new Adw.ComboRow({
        title: 'Stack Indicator Position',
        subtitle: 'Corner of the window to draw the overlay',
        model: Gtk.StringList.new(['Bottom Left', 'Bottom Right'])
    });
    const currentPos = settings.get_string('stack-indicator-position');
    rowStackPos.selected = (currentPos === 'bottom-left') ? 0 : 1;
    
    rowStackPos.connect('notify::selected', () => {
        settings.set_string('stack-indicator-position', rowStackPos.selected === 0 ? 'bottom-left' : 'bottom-right');
    });
    groupStacks.add(rowStackPos);

    const rowDefaultStackMode = new Adw.ComboRow({
        title: 'Default Stack Layout',
        subtitle: 'Initial view behavior when multiple windows enter a zone',
        model: Gtk.StringList.new(['Stack (On Top)', 'Columns (Side by Side)', 'Rows (Vertical List)', 'Grid (Tiled)'])
    });
    const currentStackMode = settings.get_string('default-stack-mode');
    if (currentStackMode === 'columns') rowDefaultStackMode.selected = 1;
    else if (currentStackMode === 'rows') rowDefaultStackMode.selected = 2;
    else if (currentStackMode === 'grid') rowDefaultStackMode.selected = 3;
    else rowDefaultStackMode.selected = 0;

    rowDefaultStackMode.connect('notify::selected', () => {
        if (rowDefaultStackMode.selected === 1) settings.set_string('default-stack-mode', 'columns');
        else if (rowDefaultStackMode.selected === 2) settings.set_string('default-stack-mode', 'rows');
        else if (rowDefaultStackMode.selected === 3) settings.set_string('default-stack-mode', 'grid');
        else settings.set_string('default-stack-mode', 'stack');
    });
    groupStacks.add(rowDefaultStackMode);

    // --- Tiling Settings -> Shortcuts ---
    const groupShortcuts = new Adw.PreferencesGroup({ title: 'Keyboard Shortcuts' });

    let rowShortcut = new Adw.ActionRow({
        title: 'Cycle Layouts Shortcut',
        subtitle: 'Click to capture keybinding'
    });
    rowShortcut.add_suffix(new ShortcutButton(settings, 'switch-layout'));
    groupShortcuts.add(rowShortcut);

    let rowQuickTilerShortcut = new Adw.ActionRow({
        title: 'Quick Tiler Grid Shortcut',
        subtitle: 'Click to capture keybinding (Default: <Super>g)'
    });
    rowQuickTilerShortcut.add_suffix(new ShortcutButton(settings, 'quick-tiler-hotkey'));
    groupShortcuts.add(rowQuickTilerShortcut);

    // --- Named Layouts & Zones Management ---
    const groupLayouts = new Adw.PreferencesGroup({ 
        title: 'Saved Layouts & Drop Zones',
        description: 'Click a layout to expand and manage its associated drop zones.' 
    });

    let layoutRows = [];
    let isUpdatingLayouts = false;

    const refreshLayoutsAndZones = () => {
        isUpdatingLayouts = true;
        try {
            for (let row of layoutRows) {
                groupLayouts.remove(row);
            }
            layoutRows = [];

            let rawLayoutsStr = settings.get_string('named-layouts');
            let rawLayouts = {};
            try { rawLayouts = JSON.parse(rawLayoutsStr) || {}; } catch {}
            
            let rawKeys = Object.keys(rawLayouts).filter(k => k && k.trim() !== '' && k !== 'null' && k !== 'undefined');
            
            if (rawKeys.length > 0) {
                let currentDef = settings.get_string('default-layout');
                if (!rawKeys.includes(currentDef)) {
                    settings.set_string('default-layout', rawKeys[0]);
                }
            } else {
                settings.set_string('default-layout', '');
            }

            let needsHealingSave = false;
            for (let name of rawKeys) {
                if (!rawLayouts[name].hotkeySlot) {
                    let usedSlots = Object.values(rawLayouts).map(l => l.hotkeySlot).filter(s => s);
                    let freeSlot = [1,2,3,4,5,6,7,8,9].find(s => !usedSlots.includes(s)) || 1;
                    rawLayouts[name].hotkeySlot = freeSlot;
                    needsHealingSave = true;
                }
            }
            
            if (needsHealingSave) {
                settings.set_string('named-layouts', JSON.stringify(rawLayouts));
                return;
            }

            let modelList = rawKeys.length > 0 ? rawKeys : ['None'];
            rowDefaultLayout.model = Gtk.StringList.new(modelList);
            
            let currentDef = settings.get_string('default-layout');
            let idx = modelList.indexOf(currentDef);
            rowDefaultLayout.selected = (idx !== -1) ? idx : 0;

            let createNewRow = new Adw.EntryRow({ title: 'Create New Blank Layout', text: '' });
            let createBtn = new Gtk.Button({ icon_name: 'list-add-symbolic', valign: Gtk.Align.CENTER });
            createBtn.add_css_class('suggested-action');
            
            let handleCreate = () => {
                let newName = createNewRow.get_text().trim();
                if (!newName || newName === 'null') return;

                let fresh = JSON.parse(settings.get_string('named-layouts') || '{}');
                if (!fresh[newName]) {
                    let usedSlots = Object.values(fresh).map(l => l.hotkeySlot).filter(s => s);
                    let freeSlot = [1,2,3,4,5,6,7,8,9].find(s => !usedSlots.includes(s)) || 1;

                    fresh[newName] = { windows: {}, zones: {}, color: 'rgba(46, 204, 113, 1.0)', hotkeySlot: freeSlot };
                    settings.set_string('named-layouts', JSON.stringify(fresh));
                    if (!settings.get_string('default-layout')) {
                        settings.set_string('default-layout', newName);
                    }
                }
                createNewRow.set_text('');
            };
            
            createBtn.connect('clicked', handleCreate);
            createNewRow.connect('apply', handleCreate);
            createNewRow.add_suffix(createBtn);
            groupLayouts.add(createNewRow);
            layoutRows.push(createNewRow);

            for (let name of rawKeys) {
                let lZones = rawLayouts[name].zones || {};
                let lZoneKeys = Object.keys(lZones).filter(k => k && k !== 'null' && k !== 'undefined');
                let lSlot = rawLayouts[name].hotkeySlot || 1;
                
                let expander = new Adw.ExpanderRow({ 
                    title: `Layout: ${name}`, 
                    subtitle: `${lZoneKeys.length} zones saved` 
                });

                let renameRow = new Adw.EntryRow({ title: 'Layout Name', text: name });
                let handleRename = () => {
                    let newName = renameRow.get_text().trim();
                    if (!newName || newName === name) return;

                    let fresh = JSON.parse(settings.get_string('named-layouts') || '{}');
                    if (fresh[name] !== undefined && !fresh[newName]) {
                        fresh[newName] = fresh[name];
                        delete fresh[name];
                        settings.set_string('named-layouts', JSON.stringify(fresh));
                    }
                };
                renameRow.connect('apply', handleRename);

                let renameBtn = new Gtk.Button({ icon_name: 'document-edit-symbolic', valign: Gtk.Align.CENTER });
                renameBtn.connect('clicked', handleRename);

                let dupBtn = new Gtk.Button({ icon_name: 'edit-copy-symbolic', valign: Gtk.Align.CENTER });
                dupBtn.connect('clicked', () => {
                    let fresh = JSON.parse(settings.get_string('named-layouts') || '{}');
                    let copyName = name + " (Copy)";
                    let count = 1;
                    while (fresh[copyName]) {
                        copyName = `${name} (Copy ${count})`;
                        count++;
                    }
                    fresh[copyName] = JSON.parse(JSON.stringify(fresh[name]));
                    
                    let usedSlots = Object.values(fresh).map(l => l.hotkeySlot).filter(s => s);
                    let freeSlot = [1,2,3,4,5,6,7,8,9].find(s => !usedSlots.includes(s)) || 1;
                    fresh[copyName].hotkeySlot = freeSlot;
                    settings.set_strv(`layout-hotkey-${freeSlot}`, []);
                    
                    settings.set_string('named-layouts', JSON.stringify(fresh));
                    if (!settings.get_string('default-layout')) {
                        settings.set_string('default-layout', copyName);
                    }
                });

                let delLayoutBtn = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER });
                delLayoutBtn.add_css_class('destructive-action');
                delLayoutBtn.connect('clicked', () => {
                    let fresh = JSON.parse(settings.get_string('named-layouts') || '{}');
                    if (fresh[name] && fresh[name].hotkeySlot) {
                        settings.set_strv(`layout-hotkey-${fresh[name].hotkeySlot}`, []);
                    }
                    delete fresh[name];
                    settings.set_string('named-layouts', JSON.stringify(fresh));
                    
                    let currentDef = settings.get_string('default-layout');
                    if (currentDef === name) {
                        let remaining = Object.keys(fresh);
                        let newDef = remaining.length > 0 ? remaining[0] : '';
                        settings.set_string('default-layout', newDef);
                    }
                });

                renameRow.add_suffix(renameBtn);
                renameRow.add_suffix(dupBtn);
                renameRow.add_suffix(delLayoutBtn);
                expander.add_row(renameRow);

                let hotkeyRow = new Adw.ActionRow({ 
                    title: 'Activation Hotkey', 
                    subtitle: 'Click to capture keybinding' 
                });
                hotkeyRow.add_suffix(new ShortcutButton(settings, `layout-hotkey-${lSlot}`));
                expander.add_row(hotkeyRow);

                let colorRow = new Adw.ActionRow({ title: 'Layout Zone Color' });
                let colorDialog = new Gtk.ColorDialog();
                let colorBtn = new Gtk.ColorDialogButton({ dialog: colorDialog, valign: Gtk.Align.CENTER });
                let rgbaObj = new Gdk.RGBA();
                let savedColor = rawLayouts[name].color || 'rgba(46, 204, 113, 1.0)';
                rgbaObj.parse(savedColor);
                colorBtn.set_rgba(rgbaObj);
                
                colorBtn.connect('notify::rgba', () => {
                    let fresh = JSON.parse(settings.get_string('named-layouts') || '{}');
                    if (fresh[name]) {
                        fresh[name].color = colorBtn.get_rgba().to_string();
                        settings.set_string('named-layouts', JSON.stringify(fresh));
                    }
                });
                colorRow.add_suffix(colorBtn);
                expander.add_row(colorRow);

                if (lZoneKeys.length === 0) {
                    let emptyZ = new Adw.ActionRow({ title: 'No drop zones', subtitle: 'Open Zone Designer to create some.' });
                    expander.add_row(emptyZ);
                } else {
                    for (let zName of lZoneKeys) {
                        let zRow = new Adw.EntryRow({ title: 'Zone', text: zName });
                        
                        let handleZoneRename = () => {
                            let newName = zRow.get_text().trim();
                            if (!newName || newName === zName) return;
                            let fresh = JSON.parse(settings.get_string('named-layouts') || '{}');
                            if (fresh[name] && fresh[name].zones && fresh[name].zones[zName] !== undefined && !fresh[name].zones[newName]) {
                                fresh[name].zones[newName] = fresh[name].zones[zName];
                                delete fresh[name].zones[zName];
                                settings.set_string('named-layouts', JSON.stringify(fresh));
                            }
                        };
                        zRow.connect('apply', handleZoneRename);

                        let zEditBtn = new Gtk.Button({ icon_name: 'document-edit-symbolic', valign: Gtk.Align.CENTER });
                        zEditBtn.connect('clicked', handleZoneRename);

                        let zDelBtn = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER });
                        zDelBtn.add_css_class('destructive-action');
                        zDelBtn.connect('clicked', () => {
                            let fresh = JSON.parse(settings.get_string('named-layouts') || '{}');
                            if (fresh[name] && fresh[name].zones) {
                                delete fresh[name].zones[zName];
                                settings.set_string('named-layouts', JSON.stringify(fresh));
                            }
                        });
                        
                        zRow.add_suffix(zEditBtn);
                        zRow.add_suffix(zDelBtn);
                        expander.add_row(zRow);
                    }
                }

                groupLayouts.add(expander);
                layoutRows.push(expander);
            }
        } finally {
            isUpdatingLayouts = false;
        }
    };

    refreshLayoutsAndZones();
    settings.connect('changed::named-layouts', refreshLayoutsAndZones);
    settings.connect('changed::custom-sections', refreshLayoutsAndZones);

    rowDefaultLayout.connect('notify::selected', () => {
        if (isUpdatingLayouts) return;
        let selectedItem = rowDefaultLayout.model.get_string(rowDefaultLayout.selected);
        if (selectedItem === 'None') {
            settings.set_string('default-layout', '');
        } else {
            settings.set_string('default-layout', selectedItem);
        }
    });

    // --- Automatic Tiling (Separated at the Bottom) ---
    const groupAutoTiling = new Adw.PreferencesGroup({ 
        title: 'Alternative: Pure Automatic Tiling',
        description: 'Dynamically arrange all windows without requiring pre-defined zones. Overrides the zone-based layout logic above.'
    });

    const rowAutoTilingEnabled = new Adw.ActionRow({ 
        title: 'Enable Pure Automatic Tiling', 
        subtitle: 'Takes over workspace layout entirely (disables Zone Designer)' 
    });
    const switchAutoTilingEnabled = new Gtk.Switch({ 
        active: settings.get_boolean('auto-tiling-enabled'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('auto-tiling-enabled', switchAutoTilingEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowAutoTilingEnabled.add_suffix(switchAutoTilingEnabled);
    groupAutoTiling.add(rowAutoTilingEnabled);

    const rowAutoTilingMode = new Adw.ComboRow({
        title: 'Auto-Tiling Algorithm',
        subtitle: 'The layout strategy for active windows',
        model: Gtk.StringList.new(['BSP (Binary Space Partitioning)', 'Cascading'])
    });
    let currentMode = settings.get_string('auto-tiling-mode');
    rowAutoTilingMode.selected = currentMode === 'cascade' ? 1 : 0;
    rowAutoTilingMode.connect('notify::selected', () => {
        settings.set_string('auto-tiling-mode', rowAutoTilingMode.selected === 0 ? 'bsp' : 'cascade');
    });
    groupAutoTiling.add(rowAutoTilingMode);

    const gapAdjustment = new Gtk.Adjustment({ lower: 0, upper: 64, step_increment: 2, value: settings.get_int('auto-tiling-gap') });
    const rowGap = new Adw.SpinRow({ 
        title: 'Window Gap (px)', 
        adjustment: gapAdjustment, 
        digits: 0 
    });
    settings.bind('auto-tiling-gap', rowGap, 'value', Gio.SettingsBindFlags.DEFAULT);
    groupAutoTiling.add(rowGap);

    // --- Master Sync Logic ---
    const syncUI = () => {
        let masterOn = switchTilingEnabled.get_active();
        let autoOn = switchAutoTilingEnabled.get_active();

        groupZone.set_sensitive(masterOn);
        groupAutoTiling.set_sensitive(masterOn);
        
        let zoneFeaturesActive = masterOn && !autoOn;
        
        rowDesigner.set_sensitive(zoneFeaturesActive);
        if (autoOn && switchDesigner.get_active()) {
            switchDesigner.set_active(false);
        }

        groupAutomation.set_sensitive(zoneFeaturesActive);
        groupStacks.set_sensitive(zoneFeaturesActive);
        groupLayouts.set_sensitive(zoneFeaturesActive);
        
        groupExclusions.set_sensitive(masterOn);
        groupShortcuts.set_sensitive(masterOn);
    };

    switchTilingEnabled.connect('notify::active', syncUI);
    switchAutoTilingEnabled.connect('notify::active', syncUI);

    // Render Order
    pageTiling.add(groupMaster);
    pageTiling.add(groupZone);
    pageTiling.add(groupAutomation);
    pageTiling.add(groupExclusions);
    pageTiling.add(groupStacks);
    pageTiling.add(groupShortcuts);
    pageTiling.add(groupLayouts);
    pageTiling.add(groupAutoTiling);

    syncUI();

    return pageTiling;
}