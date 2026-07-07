// omnipanel/prefs_tiling.js
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import { ShortcutButton, DictionaryConfigWindow } from './prefs_components.js';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default function buildTilingPage(settings, window) {
    const pageTiling = new Adw.PreferencesPage({ 
        title: _('Layouts'), 
        icon_name: 'view-grid-symbolic' 
    });

    const groupMaster = new Adw.PreferencesGroup();
    const rowTilingEnabled = new Adw.ActionRow({ 
        title: _('Enable Window Management'), 
        subtitle: _('Master switch for all OmniPanel tiling, snapping, and layout features'),
        subtitle_lines: 0
    });
    const switchTilingEnabled = new Gtk.Switch({ 
        active: settings.get_boolean('enable-tiling'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('enable-tiling', switchTilingEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowTilingEnabled.add_suffix(switchTilingEnabled);
    groupMaster.add(rowTilingEnabled);

    const groupZone = new Adw.PreferencesGroup({ title: _('Zone-Based Tiling') });
    const rowDesigner = new Adw.ActionRow({ 
        title: _('Zone Designer Mode'), 
        subtitle: _('Draw and configure drop zones visually across your screens'),
        subtitle_lines: 0
    });
    const switchDesigner = new Gtk.Switch({ 
        active: settings.get_boolean('designer-active'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('designer-active', switchDesigner, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowDesigner.add_suffix(switchDesigner);
    groupZone.add(rowDesigner);

    const rowAutoRestore = new Adw.ActionRow({ 
        title: _('Auto-Restore Layouts'), 
        subtitle: _('Remember window positions based on monitor setups'),
        subtitle_lines: 0
    });
    const switchAutoRestore = new Gtk.Switch({ 
        active: settings.get_boolean('auto-restore-layouts'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('auto-restore-layouts', switchAutoRestore, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowAutoRestore.add_suffix(switchAutoRestore);
    groupZone.add(rowAutoRestore);

    const rowFuzzyMatch = new Adw.ActionRow({ 
        title: _('Fuzzy Monitor Matching'), 
        subtitle: _('Restore layouts if monitor count matches despite resolution changes'),
        subtitle_lines: 0
    });
    const switchFuzzyMatch = new Gtk.Switch({ 
        active: settings.get_boolean('fuzzy-restore-monitors'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('fuzzy-restore-monitors', switchFuzzyMatch, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowFuzzyMatch.add_suffix(switchFuzzyMatch);
    groupZone.add(rowFuzzyMatch);

    const groupAutomation = new Adw.PreferencesGroup({ title: _('Automation & Defaults') });
    
    const rowSmartPlacement = new Adw.ActionRow({ 
        title: _('Fuzzy Auto-Placement'), 
        subtitle: _('Automatically assign new unrecognized windows to zones matching their name or category'),
        subtitle_lines: 0
    });
    const switchSmartPlacement = new Gtk.Switch({ 
        active: settings.get_boolean('enable-smart-placement'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('enable-smart-placement', switchSmartPlacement, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowSmartPlacement.add_suffix(switchSmartPlacement);
    groupAutomation.add(rowSmartPlacement);

    const rowAffinity = new Adw.ActionRow({
        title: _('Remember App Affinity'),
        subtitle: _('Restore apps to their last known zone upon relaunch'),
        subtitle_lines: 0
    });
    const switchAffinity = new Gtk.Switch({
        active: settings.get_boolean('remember-app-affinity'),
        valign: Gtk.Align.CENTER
    });
    settings.bind('remember-app-affinity', switchAffinity, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowAffinity.add_suffix(switchAffinity);
    groupAutomation.add(rowAffinity);

    const rowDict = new Adw.ActionRow({
        title: _('Configure Auto-Placement Rules'),
        subtitle: _('Easily manage app keywords and categories for layout routing'),
        subtitle_lines: 0
    });
    const btnDict = new Gtk.Button({
        label: _('Configure'),
        valign: Gtk.Align.CENTER
    });
    btnDict.connect('clicked', () => {
        let configWin = new DictionaryConfigWindow(settings, window);
        configWin.present();
    });
    rowDict.add_suffix(btnDict);
    groupAutomation.add(rowDict);

    let rowDefaultLayout = new Adw.ComboRow({
        title: _('Default Startup Layout'),
        subtitle: _('Layout applied automatically when extension loads'),
        subtitle_lines: 0
    });
    groupAutomation.add(rowDefaultLayout);

    const groupExclusions = new Adw.PreferencesGroup({ 
        title: _('Window Exclusions'),
        description: _('Provide a comma-separated list of application names (e.g. gimp, steam) to completely exclude them from being snapped or managed by OmniPanel.')
    });
    
    const rowIgnoreList = new Adw.EntryRow({
        title: _('Ignored Applications')
    });
    let currentIgnore = settings.get_strv('ignore-wm-classes') || [];
    rowIgnoreList.set_text(currentIgnore.join(', '));
    
    rowIgnoreList.connect('notify::text', () => {
        let text = rowIgnoreList.get_text();
        let arr = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
        settings.set_strv('ignore-wm-classes', arr);
    });
    groupExclusions.add(rowIgnoreList);

    const groupStacks = new Adw.PreferencesGroup({ title: _('Stack Indicators') });
    
    const rowStacks = new Adw.ActionRow({ 
        title: _('Zone Stack Indicators'), 
        subtitle: _('Show a fast-switching overlay when multiple windows share the same drop zone'),
        subtitle_lines: 0
    });
    const switchStacks = new Gtk.Switch({ 
        active: settings.get_boolean('enable-stack-indicators'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('enable-stack-indicators', switchStacks, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowStacks.add_suffix(switchStacks);
    groupStacks.add(rowStacks);

    const rowStackPos = new Adw.ComboRow({
        title: _('Stack Indicator Position'),
        subtitle: _('Corner of the window to draw the overlay'),
        model: Gtk.StringList.new([_('Bottom Left'), _('Bottom Right')]),
        subtitle_lines: 0
    });
    const currentPos = settings.get_string('stack-indicator-position');
    rowStackPos.selected = (currentPos === 'bottom-left') ? 0 : 1;
    
    rowStackPos.connect('notify::selected', () => {
        settings.set_string('stack-indicator-position', rowStackPos.selected === 0 ? 'bottom-left' : 'bottom-right');
    });
    groupStacks.add(rowStackPos);

    const rowDefaultStackMode = new Adw.ComboRow({
        title: _('Default Stack Layout'),
        subtitle: _('Initial view behavior when multiple windows enter a zone'),
        model: Gtk.StringList.new([_('Stack (On Top)'), _('Columns (Side by Side)'), _('Rows (Vertical List)'), _('Grid (Tiled)')]),
        subtitle_lines: 0
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

    const groupShortcuts = new Adw.PreferencesGroup({ title: _('Keyboard Shortcuts') });
    
    let rowShortcut = new Adw.ActionRow({
        title: _('Cycle Layouts Shortcut'),
        subtitle: _('Click to capture keybinding'),
        subtitle_lines: 0
    });
    rowShortcut.add_suffix(new ShortcutButton(settings, 'switch-layout'));
    groupShortcuts.add(rowShortcut);

    let rowQuickTilerShortcut = new Adw.ActionRow({
        title: _('Quick Tiler Grid Shortcut'),
        subtitle: _('Click to capture keybinding (Default: ⌘g)'),
        subtitle_lines: 0
    });
    rowQuickTilerShortcut.add_suffix(new ShortcutButton(settings, 'quick-tiler-hotkey'));
    groupShortcuts.add(rowQuickTilerShortcut);

    const groupLayouts = new Adw.PreferencesGroup({ 
        title: _('Saved Layouts & Drop Zones'),
        description: _('Click a layout to expand and manage its associated drop zones.') 
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
            try { rawLayouts = JSON.parse(rawLayoutsStr) || {}; } catch (e) { console.error("OmniPanel JSON Parse Error:", e); }
            
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

            let modelList = rawKeys.length > 0 ? rawKeys : [_('None')];
            rowDefaultLayout.model = Gtk.StringList.new(modelList);
            
            let currentDef = settings.get_string('default-layout');
            let idx = modelList.indexOf(currentDef);
            rowDefaultLayout.selected = (idx !== -1) ? idx : 0;

            let createNewRow = new Adw.EntryRow({ title: _('Create New Blank Layout'), text: '' });
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
                    title: `${_('Layout')}: ${name}`, 
                    subtitle: `${lZoneKeys.length} ${_('zones saved')}`,
                    subtitle_lines: 0
                });

                let renameRow = new Adw.EntryRow({ title: _('Layout Name'), text: name });
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
                    let copyName = `${name} ${_('(Copy)')}`;
                    let count = 1;
                    while (fresh[copyName]) {
                        copyName = `${name} ${_('(Copy)')} ${count}`;
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
                    title: _('Activation Hotkey'), 
                    subtitle: _('Click to capture keybinding'),
                    subtitle_lines: 0
                });
                hotkeyRow.add_suffix(new ShortcutButton(settings, `layout-hotkey-${lSlot}`));
                expander.add_row(hotkeyRow);

                let colorRow = new Adw.ActionRow({ title: _('Layout Zone Color') });
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
                    let emptyZ = new Adw.ActionRow({ 
                        title: _('No drop zones'), 
                        subtitle: _('Open Zone Designer to create some.'),
                        subtitle_lines: 0
                    });
                    expander.add_row(emptyZ);
                } else {
                    for (let zName of lZoneKeys) {
                        let zRow = new Adw.EntryRow({ title: _('Zone'), text: zName });
                        
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
    
    let namedId = settings.connect('changed::named-layouts', refreshLayoutsAndZones);
    let customId = settings.connect('changed::custom-sections', refreshLayoutsAndZones);

    window.connect('destroy', () => {
        if (namedId) {
            settings.disconnect(namedId);
            namedId = 0;
        }
        if (customId) {
            settings.disconnect(customId);
            customId = 0;
        }
    });

    rowDefaultLayout.connect('notify::selected', () => {
        if (isUpdatingLayouts) return;
        let selectedItem = rowDefaultLayout.model.get_string(rowDefaultLayout.selected);
        if (selectedItem === _('None')) {
            settings.set_string('default-layout', '');
        } else {
            settings.set_string('default-layout', selectedItem);
        }
    });

    const groupAutoTiling = new Adw.PreferencesGroup({ 
        title: _('Alternative: Pure Automatic Tiling'),
        description: _('Dynamically arrange all windows without requiring pre-defined zones. Overrides the zone-based layout logic above.')
    });

    const rowAutoTilingEnabled = new Adw.ActionRow({ 
        title: _('Enable Pure Automatic Tiling'), 
        subtitle: _('Takes over workspace layout entirely (disables Zone Designer)'),
        subtitle_lines: 0
    });
    const switchAutoTilingEnabled = new Gtk.Switch({ 
        active: settings.get_boolean('auto-tiling-enabled'), 
        valign: Gtk.Align.CENTER 
    });
    settings.bind('auto-tiling-enabled', switchAutoTilingEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
    rowAutoTilingEnabled.add_suffix(switchAutoTilingEnabled);
    groupAutoTiling.add(rowAutoTilingEnabled);

    const rowAutoTilingMode = new Adw.ComboRow({
        title: _('Auto-Tiling Algorithm'),
        subtitle: _('The layout strategy for active windows'),
        model: Gtk.StringList.new([_('BSP (Binary Space Partitioning)'), _('Cascading'), _('Master-Stack (Stable)')]),
        subtitle_lines: 0
    });
    let currentMode = settings.get_string('auto-tiling-mode');
    if (currentMode === 'cascade') rowAutoTilingMode.selected = 1;
    else if (currentMode === 'master-stack') rowAutoTilingMode.selected = 2;
    else rowAutoTilingMode.selected = 0;
    
    rowAutoTilingMode.connect('notify::selected', () => {
        if (rowAutoTilingMode.selected === 1) settings.set_string('auto-tiling-mode', 'cascade');
        else if (rowAutoTilingMode.selected === 2) settings.set_string('auto-tiling-mode', 'master-stack');
        else settings.set_string('auto-tiling-mode', 'bsp');
    });
    groupAutoTiling.add(rowAutoTilingMode);

    const gapAdjustment = new Gtk.Adjustment({ lower: 0, upper: 64, step_increment: 2, value: settings.get_int('auto-tiling-gap') });
    const rowGap = new Adw.SpinRow({ 
        title: _('Window Gap (px)'), 
        adjustment: gapAdjustment, 
        digits: 0 
    });
    settings.bind('auto-tiling-gap', rowGap, 'value', Gio.SettingsBindFlags.DEFAULT);
    groupAutoTiling.add(rowGap);

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