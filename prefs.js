import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const ShortcutButton = GObject.registerClass(
    class ShortcutButton extends Gtk.Button {
        _init(settings, settingsKey) {
            super._init({ valign: Gtk.Align.CENTER });
            this._settings = settings;
            this._settingsKey = settingsKey;
            this._listening = false;

            this.add_css_class('flat');
            this._refresh();

            this._controller = new Gtk.EventControllerKey();
            this.add_controller(this._controller);
            this._controller.connect('key-pressed', this._onKeyPressed.bind(this));

            this.connect('clicked', () => {
                this._listening = true;
                this.set_label('Press keys... (Esc to cancel, Backspace to clear)');
            });

            this._changedId = this._settings.connect(`changed::${this._settingsKey}`, this._refresh.bind(this));
            
            this.connect('destroy', () => {
                if (this._changedId) {
                    this._settings.disconnect(this._changedId);
                    this._changedId = 0;
                }
            });
        }

        _refresh() {
            this._listening = false;
            let val = this._settings.get_strv(this._settingsKey)[0];
            this.set_label(val ? val : 'Disabled');
        }

        _onKeyPressed(controller, keyval, keycode, state) {
            if (!this._listening) return false;

            let mask = state & Gtk.accelerator_get_default_mod_mask();
            let keyName = Gdk.keyval_name(keyval);

            if (keyName && (keyName.includes('Control') || keyName.includes('Shift') || keyName.includes('Alt') || keyName.includes('Super') || keyName.includes('Meta'))) {
                return false;
            }

            if (keyName === 'Escape') {
                this._refresh();
                return true;
            }

            if (keyName === 'BackSpace' || keyName === 'Delete') {
                this._settings.set_strv(this._settingsKey, []);
                this._refresh();
                return true;
            }

            let accel = Gtk.accelerator_name(keyval, mask);
            if (accel) {
                this._settings.set_strv(this._settingsKey, [accel]);
            }
            
            this._refresh();
            return true;
        }
    }
);

export default class OmniPanelPreferences extends ExtensionPreferences {
    
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // --- Pages ---
        const pageTopBar = new Adw.PreferencesPage({ 
            title: 'Panel', 
            icon_name: 'view-dual-symbolic' 
        });

        const pageTiling = new Adw.PreferencesPage({ 
            title: 'Layouts', 
            icon_name: 'view-grid-symbolic' 
        });

        const pageGuide = new Adw.PreferencesPage({ 
            title: 'Guide', 
            icon_name: 'system-help-symbolic' 
        });

        const pageAbout = new Adw.PreferencesPage({ 
            title: 'About', 
            icon_name: 'dialog-information-symbolic' 
        });
        
        // --- Guide Group Configuration ---
        const groupConcept = new Adw.PreferencesGroup({ 
            title: '1. The Two-In-One Powerhouse',
            description: 'Native GNOME lacks true multi-monitor capabilities. OmniPanel resolves this by offering two distinct, configurable engines:\n\n• Multi-Monitor Top Panel: Dynamically teleports the native GNOME Top Bar to whichever monitor your mouse is currently active on.\n• Window Layouts & Drop Zones: A persistent workspace engine that remembers exactly where your apps belong across all your screens.'
        });

        const groupDesigner = new Adw.PreferencesGroup({
            title: '2. The Zone Designer',
            description: 'To start organizing windows, you first need to draw Drop Zones:\n\n1. Open the OmniPanel system tray menu (top right of the screen).\n2. Toggle "Zone Designer Mode" on.\n3. Click and drag your mouse on any monitor to draw a rectangular zone.\n4. Type a name (e.g., "Browser", "Terminal", "Code") and hit Save.\n5. Click "Quit Designer" on the toolbar when finished.'
        });

        const groupPlacement = new Adw.PreferencesGroup({
            title: '3. Smart Window Placement',
            description: 'OmniPanel acts as an intelligent assistant using Fuzzy Auto-Placement.\n\n• If you name a zone "Terminals", apps like Alacritty, Console, or GNOME Terminal will automatically snap there when opened.\n• If you name a zone "Web", Firefox and Chrome will route there.\n\nManual Overrides: If you manually drag a window into a different zone using your mouse, OmniPanel permanently learns your preference and assigns it to that new zone.'
        });

        const groupHotkeys = new Adw.PreferencesGroup({
            title: '4. Hotkeys, Snapping & Stacks',
            description: 'Navigate to the "Window Layouts" tab to master your workspace.\n\n• Cycle Layouts: Press your configured hotkey to instantly loop through your saved Layouts.\n• Directional Snapping: Use Alt + Left, Right, Up, or Down to snap the active window into a neighboring Drop Zone.\n• Window Stacks: If multiple windows are dropped into the same zone, a Stack Indicator will appear. Hover over it to cycle between them or instantly expand them into a visual grid.'
        });

        pageGuide.add(groupConcept);
        pageGuide.add(groupDesigner);
        pageGuide.add(groupPlacement);
        pageGuide.add(groupHotkeys);

        // --- Active Toolbar Movement Group ---
        const groupMovement = new Adw.PreferencesGroup({ title: 'Active Toolbar Movement' });
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
        const groupAnimations = new Adw.PreferencesGroup({ title: 'Animation Effects' });
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
        const groupActiveUI = new Adw.PreferencesGroup({ title: 'Active Panel Appearance' });
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
        const groupInactiveUI = new Adw.PreferencesGroup({ title: 'Inactive Panel Appearance' });
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

        // --- Tiling Settings -> Core Features ---
        const groupCoreTiling = new Adw.PreferencesGroup({ title: 'Core Settings' });
        const rowTilingEnabled = new Adw.ActionRow({ 
            title: 'Enable Window Layouts', 
            subtitle: 'Activate drop zones and layout memory' 
        });
        const switchTilingEnabled = new Gtk.Switch({ 
            active: settings.get_boolean('enable-tiling'), 
            valign: Gtk.Align.CENTER 
        });
        settings.bind('enable-tiling', switchTilingEnabled, 'active', Gio.SettingsBindFlags.DEFAULT);
        rowTilingEnabled.add_suffix(switchTilingEnabled);
        groupCoreTiling.add(rowTilingEnabled);

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
        groupCoreTiling.add(rowAutoRestore);

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
        groupCoreTiling.add(rowFuzzyMatch);

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

        let rowDefaultLayout = new Adw.ComboRow({
            title: 'Default Startup Layout',
            subtitle: 'Layout applied automatically when extension loads'
        });
        groupAutomation.add(rowDefaultLayout);

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

        // --- Tiling Settings -> Shortcuts ---
        const groupShortcuts = new Adw.PreferencesGroup({ title: 'Keyboard Shortcuts' });
        let rowShortcut = new Adw.ActionRow({
            title: 'Cycle Layouts Shortcut',
            subtitle: 'Click to capture keybinding'
        });
        rowShortcut.add_suffix(new ShortcutButton(settings, 'switch-layout'));
        groupShortcuts.add(rowShortcut);

        // --- Named Layouts & Zones Management ---
        const groupLayouts = new Adw.PreferencesGroup({ 
            title: 'Saved Layouts & Drop Zones',
            description: 'Click a layout to expand and manage its associated drop zones.' 
        });
        this._layoutRows = [];

        const refreshLayoutsAndZones = () => {
            for (let row of this._layoutRows) {
                groupLayouts.remove(row);
            }
            this._layoutRows = [];

            let rawLayoutsStr = settings.get_string('named-layouts');
            let rawLayouts = {};
            try { rawLayouts = JSON.parse(rawLayoutsStr) || {}; } catch {}
            let rawKeys = Object.keys(rawLayouts).filter(k => k && k !== 'null' && k !== 'undefined');
            
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

            let modelList = ['None', ...rawKeys];
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
            this._layoutRows.push(createNewRow);

            let currentZonesStr = settings.get_string('custom-sections');
            let currentZones = {};
            try { currentZones = JSON.parse(currentZonesStr) || {}; } catch {}
            let currentKeys = Object.keys(currentZones).filter(k => k && k !== 'null' && k !== 'undefined');

            let currentExpander = new Adw.ExpanderRow({ 
                title: 'Unassigned Drop Zones', 
                subtitle: `${currentKeys.length} active zones not tied to a layout` 
            });
            
            if (currentKeys.length === 0) {
                let emptyRow = new Adw.ActionRow({ title: 'No floating zones active.' });
                currentExpander.add_row(emptyRow);
            } else {
                for (let zName of currentKeys) {
                    let zRow = new Adw.EntryRow({ title: 'Zone', text: zName });
                    
                    let handleZoneEdit = () => {
                        let newName = zRow.get_text().trim();
                        if (!newName || newName === zName) return;
                        let fresh = JSON.parse(settings.get_string('custom-sections') || '{}');
                        if (fresh[zName] !== undefined && !fresh[newName]) {
                            fresh[newName] = fresh[zName];
                            delete fresh[zName];
                            settings.set_string('custom-sections', JSON.stringify(fresh));
                        }
                    };
                    zRow.connect('apply', handleZoneEdit);
                    
                    let zEditBtn = new Gtk.Button({ icon_name: 'document-edit-symbolic', valign: Gtk.Align.CENTER });
                    zEditBtn.connect('clicked', handleZoneEdit);

                    let delBtn = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER });
                    delBtn.add_css_class('destructive-action');
                    delBtn.connect('clicked', () => {
                        let fresh = JSON.parse(settings.get_string('custom-sections') || '{}');
                        delete fresh[zName];
                        settings.set_string('custom-sections', JSON.stringify(fresh));
                    });
                    
                    zRow.add_suffix(zEditBtn);
                    zRow.add_suffix(delBtn);
                    currentExpander.add_row(zRow);
                }
            }
            groupLayouts.add(currentExpander);
            this._layoutRows.push(currentExpander);

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
                this._layoutRows.push(expander);
            }
        };
        refreshLayoutsAndZones();
        settings.connect('changed::named-layouts', refreshLayoutsAndZones);
        settings.connect('changed::custom-sections', refreshLayoutsAndZones);

        rowDefaultLayout.connect('notify::selected', () => {
            let selectedItem = rowDefaultLayout.model.get_string(rowDefaultLayout.selected);
            if (selectedItem === 'None') {
                settings.set_string('default-layout', '');
            } else {
                settings.set_string('default-layout', selectedItem);
            }
        });

        // --- About Section Group ---
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
        
        const versionStr = this.metadata.version ? this.metadata.version.toString() : 'Local / Development';
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

        // --- Assemble Pages ---
        pageTopBar.add(groupMovement);
        pageTopBar.add(groupAnimations);
        pageTopBar.add(groupActiveUI);
        pageTopBar.add(groupInactiveUI);

        pageTiling.add(groupCoreTiling);
        pageTiling.add(groupAutomation);
        pageTiling.add(groupStacks);
        pageTiling.add(groupShortcuts);
        pageTiling.add(groupLayouts);

        pageAbout.add(groupAboutInfo);
        pageAbout.add(groupAdvanced);
        
        window.add(pageTopBar);
        window.add(pageTiling);
        window.add(pageGuide);
        window.add(pageAbout);
    }
}