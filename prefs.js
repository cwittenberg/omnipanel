// omnipanel/prefs.js
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { DEFAULT_APP_DICTIONARY, DEFAULT_CATEGORY_MAP } from './defaults.js';

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

const AppDictRow = GObject.registerClass(
    class AppDictRow extends Adw.ExpanderRow {
        _init(ruleData, onDelete) {
            super._init({ title: `Zones: ${ruleData.zoneKeys.join(', ') || 'New Rule'}` });
            this.ruleData = ruleData;

            let zoneRow = new Adw.EntryRow({ 
                title: 'Target Zones (comma separated)', 
                text: ruleData.zoneKeys.join(', ') 
            });
            zoneRow.connect('notify::text', () => {
                this.ruleData.zoneKeys = zoneRow.get_text().split(',').map(s => s.trim()).filter(s => s);
                this.set_title(`Zones: ${this.ruleData.zoneKeys.join(', ') || 'New Rule'}`);
            });

            let kwRow = new Adw.EntryRow({ 
                title: 'App Keywords (comma separated)', 
                text: ruleData.keywords.join(', ') 
            });
            kwRow.connect('notify::text', () => {
                this.ruleData.keywords = kwRow.get_text().split(',').map(s => s.trim()).filter(s => s);
            });

            let delRow = new Adw.ActionRow({ title: 'Remove this routing rule' });
            let delBtn = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER });
            delBtn.add_css_class('destructive-action');
            delBtn.connect('clicked', onDelete);
            delRow.add_suffix(delBtn);

            this.add_row(zoneRow);
            this.add_row(kwRow);
            this.add_row(delRow);
        }
    }
);

const CatMapRow = GObject.registerClass(
    class CatMapRow extends Adw.ExpanderRow {
        _init(ruleData, onDelete) {
            super._init({ title: `Category: ${ruleData.cat || 'New Category'}` });
            this.ruleData = ruleData;

            let catRow = new Adw.EntryRow({ 
                title: 'GNOME Desktop Category', 
                text: ruleData.cat || '' 
            });
            catRow.connect('notify::text', () => {
                this.ruleData.cat = catRow.get_text().trim();
                this.set_title(`Category: ${this.ruleData.cat || 'New Category'}`);
            });

            let hintsRow = new Adw.EntryRow({ 
                title: 'Target Zones (comma separated)', 
                text: ruleData.hints.join(', ') 
            });
            hintsRow.connect('notify::text', () => {
                this.ruleData.hints = hintsRow.get_text().split(',').map(s => s.trim()).filter(s => s);
            });

            let delRow = new Adw.ActionRow({ title: 'Remove this category rule' });
            let delBtn = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER });
            delBtn.add_css_class('destructive-action');
            delBtn.connect('clicked', onDelete);
            delRow.add_suffix(delBtn);

            this.add_row(catRow);
            this.add_row(hintsRow);
            this.add_row(delRow);
        }
    }
);

const DictionaryConfigWindow = GObject.registerClass(
    class DictionaryConfigWindow extends Adw.Window {
        _init(settings, parent) {
            super._init({
                title: 'Smart Placement Routing Rules',
                transient_for: parent,
                modal: true,
                default_width: 700,
                default_height: 600,
                hide_on_close: true
            });
            this.settings = settings;

            let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
            
            let headerBar = new Adw.HeaderBar();
            
            let saveBtn = new Gtk.Button({ label: 'Save & Close' });
            saveBtn.add_css_class('suggested-action');
            headerBar.pack_end(saveBtn);

            let resetBtn = new Gtk.Button({ label: 'Reset to Defaults' });
            headerBar.pack_start(resetBtn);
            
            box.append(headerBar);

            let notebook = new Gtk.Notebook();
            notebook.set_vexpand(true);

            let appScroll = new Gtk.ScrolledWindow({ hexpand: true, vexpand: true, hscrollbar_policy: Gtk.PolicyType.NEVER });
            let appClamp = new Adw.Clamp({ maximum_size: 800, margin_top: 24, margin_bottom: 24, margin_start: 12, margin_end: 12 });
            this.appGroup = new Adw.PreferencesGroup({ 
                title: 'Application Keyword Routing', 
                description: 'Route applications to specific drop zones if their window title or application name matches a keyword.' 
            });
            appClamp.set_child(this.appGroup);
            appScroll.set_child(appClamp);
            notebook.append_page(appScroll, new Gtk.Label({ label: 'App Keywords' }));

            let catScroll = new Gtk.ScrolledWindow({ hexpand: true, vexpand: true, hscrollbar_policy: Gtk.PolicyType.NEVER });
            let catClamp = new Adw.Clamp({ maximum_size: 800, margin_top: 24, margin_bottom: 24, margin_start: 12, margin_end: 12 });
            this.catGroup = new Adw.PreferencesGroup({ 
                title: 'Category Routing', 
                description: 'Route applications to specific drop zones based on their underlying GNOME desktop metadata category.' 
            });
            catClamp.set_child(this.catGroup);
            catScroll.set_child(catClamp);
            notebook.append_page(catScroll, new Gtk.Label({ label: 'Categories' }));

            box.append(notebook);
            this.set_content(box);

            this._appData = [];
            this._catData = [];
            this._appRows = [];
            this._catRows = [];

            this._load();

            saveBtn.connect('clicked', () => this._save());
            resetBtn.connect('clicked', () => this._reset());
        }

        _load() {
            let appDictStr = this.settings.get_string('app-dictionary');
            let catMapStr = this.settings.get_string('category-map');

            try {
                this._appData = (appDictStr && appDictStr.trim() !== '') ? JSON.parse(appDictStr) : JSON.parse(JSON.stringify(DEFAULT_APP_DICTIONARY));
            } catch {
                this._appData = JSON.parse(JSON.stringify(DEFAULT_APP_DICTIONARY));
            }

            try {
                this._catData = (catMapStr && catMapStr.trim() !== '') ? JSON.parse(catMapStr) : JSON.parse(JSON.stringify(DEFAULT_CATEGORY_MAP));
            } catch {
                this._catData = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_MAP));
            }

            this._renderAppDict();
            this._renderCatMap();
        }

        _renderAppDict() {
            if (this._appRows) {
                for (let row of this._appRows) {
                    this.appGroup.remove(row);
                }
            }
            this._appRows = [];

            for (let i = 0; i < this._appData.length; i++) {
                let row = new AppDictRow(this._appData[i], () => {
                    this._appData.splice(i, 1);
                    this._renderAppDict();
                });
                this.appGroup.add(row);
                this._appRows.push(row);
            }

            let addRow = new Adw.ActionRow({ title: 'Add New App Routing Rule' });
            let addBtn = new Gtk.Button({ icon_name: 'list-add-symbolic', valign: Gtk.Align.CENTER });
            addBtn.add_css_class('suggested-action');
            addBtn.connect('clicked', () => {
                this._appData.push({ zoneKeys: [], keywords: [] });
                this._renderAppDict();
            });
            addRow.add_suffix(addBtn);
            this.appGroup.add(addRow);
            this._appRows.push(addRow);
        }

        _renderCatMap() {
            if (this._catRows) {
                for (let row of this._catRows) {
                    this.catGroup.remove(row);
                }
            }
            this._catRows = [];

            for (let i = 0; i < this._catData.length; i++) {
                let row = new CatMapRow(this._catData[i], () => {
                    this._catData.splice(i, 1);
                    this._renderCatMap();
                });
                this.catGroup.add(row);
                this._catRows.push(row);
            }

            let addRow = new Adw.ActionRow({ title: 'Add New Category Routing Rule' });
            let addBtn = new Gtk.Button({ icon_name: 'list-add-symbolic', valign: Gtk.Align.CENTER });
            addBtn.add_css_class('suggested-action');
            addBtn.connect('clicked', () => {
                this._catData.push({ cat: '', hints: [] });
                this._renderCatMap();
            });
            addRow.add_suffix(addBtn);
            this.catGroup.add(addRow);
            this._catRows.push(addRow);
        }

        _save() {
            try {
                this.settings.set_string('app-dictionary', JSON.stringify(this._appData));
                this.settings.set_string('category-map', JSON.stringify(this._catData));
            } catch (e) {
                console.error("OmniPanel: Failed to serialize routing rules during save:", e);
            }
            this.close();
        }

        _reset() {
            this._appData = JSON.parse(JSON.stringify(DEFAULT_APP_DICTIONARY));
            this._catData = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_MAP));
            this._renderAppDict();
            this._renderCatMap();
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
            description: 'Native GNOME lacks true multi-monitor capabilities. OmniPanel resolves this by offering two distinct, configurable engines:\n\n  Multi-Monitor Top Panel: Dynamically teleports the native GNOME Top Bar to whichever monitor your mouse is currently active on.\n  Window Layouts & Drop Zones: A persistent workspace engine that remembers exactly where your apps belong across all your screens.'
        });

        const groupDesigner = new Adw.PreferencesGroup({
            title: '2. The Zone Designer',
            description: 'To start organizing windows, you first need to draw Drop Zones:\n\n1. Open the OmniPanel system tray menu (top right of the screen).\n2. Toggle "Zone Designer Mode" on.\n3. Click and drag your mouse on any monitor to draw a rectangular zone.\n4. Type a name (e.g., "Browser", "Terminal", "Code") and hit Save.\n5. Click "Quit Designer" on the toolbar when finished.'
        });

        const groupPlacement = new Adw.PreferencesGroup({
            title: '3. Smart Window Placement',
            description: 'OmniPanel acts as an intelligent assistant using Fuzzy Auto-Placement.\n\n  If you name a zone "Terminals", apps like Alacritty, Console, or GNOME Terminal will automatically snap there when opened.\n  If you name a zone "Web", Firefox and Chrome will route there.\n\nManual Overrides: If you manually drag a window into a different zone using your mouse, OmniPanel permanently learns your preference and assigns it to that new zone.'
        });

        const groupHotkeys = new Adw.PreferencesGroup({
            title: '4. Hotkeys, Snapping & Stacks',
            description: 'Navigate to the "Window Layouts" tab to master your workspace.\n\n  Cycle Layouts: Press your configured hotkey to instantly loop through your saved Layouts.\n  Directional Snapping: Use Alt + Left, Right, Up, or Down to snap the active window into a neighboring Drop Zone.\n  Window Stacks: If multiple windows are dropped into the same zone, a Stack Indicator will appear. Hover over it to cycle between them or instantly expand them into a visual grid.'
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

        // --- Show Desktop Group ---
        const groupDesktop = new Adw.PreferencesGroup({ title: 'Show Desktop Button' });

        const rowShowDesktop = new Adw.ActionRow({ 
            title: 'Enable Show Desktop Button', 
            subtitle: 'Adds a button to the top bar to minimize/restore windows on the current monitor' 
        });
        const switchShowDesktop = new Gtk.Switch({ 
            active: settings.get_boolean('show-desktop-enabled'), 
            valign: Gtk.Align.CENTER 
        });
        settings.bind('show-desktop-enabled', switchShowDesktop, 'active', Gio.SettingsBindFlags.DEFAULT);
        rowShowDesktop.add_suffix(switchShowDesktop);
        groupDesktop.add(rowShowDesktop);

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
        groupCoreTiling.add(rowDesigner);

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
            let win = new DictionaryConfigWindow(settings, window);
            win.present();
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

        // --- Named Layouts & Zones Management ---
        const groupLayouts = new Adw.PreferencesGroup({ 
            title: 'Saved Layouts & Drop Zones',
            description: 'Click a layout to expand and manage its associated drop zones.' 
        });

        this._layoutRows = [];
        this._isUpdatingLayouts = false;

        const refreshLayoutsAndZones = () => {
            this._isUpdatingLayouts = true;
            try {
                for (let row of this._layoutRows) {
                    groupLayouts.remove(row);
                }
                this._layoutRows = [];

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
                this._layoutRows.push(createNewRow);

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
                    this._layoutRows.push(expander);
                }
            } finally {
                this._isUpdatingLayouts = false;
            }
        };

        refreshLayoutsAndZones();
        settings.connect('changed::named-layouts', refreshLayoutsAndZones);
        settings.connect('changed::custom-sections', refreshLayoutsAndZones);

        rowDefaultLayout.connect('notify::selected', () => {
            if (this._isUpdatingLayouts) return;
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
        pageTopBar.add(groupDesktop);
        pageTopBar.add(groupAnimations);
        pageTopBar.add(groupActiveUI);
        pageTopBar.add(groupInactiveUI);

        pageTiling.add(groupCoreTiling);
        pageTiling.add(groupAutomation);
        pageTiling.add(groupExclusions);
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