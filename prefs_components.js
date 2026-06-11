// omnipanel/prefs_components.js
import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GObject from 'gi://GObject';
import { DEFAULT_APP_DICTIONARY, DEFAULT_CATEGORY_MAP } from './defaults.js';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function wrap(row) {
    if (row && row.set_subtitle_lines) {
        row.set_subtitle_lines(0);
    }
    return row;
}

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
                this.set_label(_('Press keys... (Esc to cancel, Backspace to clear)'));
            });

            this._settingsId = this._settings.connect(`changed::${this._settingsKey}`, this._refresh.bind(this));
            
            this.connect('destroy', () => {
                if (this._settingsId) {
                    this._settings.disconnect(this._settingsId);
                    this._settingsId = 0;
                }
            });
        }

        _refresh() {
            this._listening = false;
            let val = this._settings.get_strv(this._settingsKey)[0];
            this.set_label(val ? val : _('Disabled'));
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
            super._init({ title: `Zones: ${ruleData.zoneKeys.join(', ') || _('New Rule')}` });
            this.set_subtitle_lines(0);
            this.ruleData = ruleData;

            let zoneRow = new Adw.EntryRow({ 
                title: _('Target Zones (comma separated)'), 
                text: ruleData.zoneKeys.join(', ') 
            });
            zoneRow.connect('notify::text', () => {
                this.ruleData.zoneKeys = zoneRow.get_text().split(',').map(s => s.trim()).filter(s => s);
                this.set_title(`Zones: ${this.ruleData.zoneKeys.join(', ') || _('New Rule')}`);
            });

            let kwRow = new Adw.EntryRow({ 
                title: _('App Keywords (comma separated)'), 
                text: ruleData.keywords.join(', ') 
            });
            kwRow.connect('notify::text', () => {
                this.ruleData.keywords = kwRow.get_text().split(',').map(s => s.trim()).filter(s => s);
            });

            let delRow = new Adw.ActionRow({ title: _('Remove this routing rule') });
            let delBtn = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER });
            delBtn.add_css_class('destructive-action');
            delBtn.connect('clicked', onDelete);
            delRow.add_suffix(delBtn);

            this.add_row(wrap(zoneRow));
            this.add_row(wrap(kwRow));
            this.add_row(wrap(delRow));
        }
    }
);

const CatMapRow = GObject.registerClass(
    class CatMapRow extends Adw.ExpanderRow {
        _init(ruleData, onDelete) {
            super._init({ title: `Category: ${ruleData.cat || _('New Category')}` });
            this.set_subtitle_lines(0);
            this.ruleData = ruleData;

            let catRow = new Adw.EntryRow({ 
                title: _('GNOME Desktop Category'), 
                text: ruleData.cat || '' 
            });
            catRow.connect('notify::text', () => {
                this.ruleData.cat = catRow.get_text().trim();
                this.set_title(`Category: ${this.ruleData.cat || _('New Category')}`);
            });

            let hintsRow = new Adw.EntryRow({ 
                title: _('Target Zones (comma separated)'), 
                text: ruleData.hints.join(', ') 
            });
            hintsRow.connect('notify::text', () => {
                this.ruleData.hints = hintsRow.get_text().split(',').map(s => s.trim()).filter(s => s);
            });

            let delRow = new Adw.ActionRow({ title: _('Remove this category rule') });
            let delBtn = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER });
            delBtn.add_css_class('destructive-action');
            delBtn.connect('clicked', onDelete);
            delRow.add_suffix(delBtn);

            this.add_row(wrap(catRow));
            this.add_row(wrap(hintsRow));
            this.add_row(wrap(delRow));
        }
    }
);

const DictionaryConfigWindow = GObject.registerClass(
    class DictionaryConfigWindow extends Adw.Window {
        _init(settings, parent) {
            super._init({
                title: _('Smart Placement Routing Rules'),
                transient_for: parent,
                modal: true,
                default_width: 700,
                default_height: 600,
                hide_on_close: true
            });
            this.settings = settings;

            let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
            
            let headerBar = new Adw.HeaderBar();
            
            let saveBtn = new Gtk.Button({ label: _('Save & Close') });
            saveBtn.add_css_class('suggested-action');
            headerBar.pack_end(saveBtn);

            let resetBtn = new Gtk.Button({ label: _('Reset to Defaults') });
            headerBar.pack_start(resetBtn);
            
            box.append(headerBar);

            let notebook = new Gtk.Notebook();
            notebook.set_vexpand(true);

            let appScroll = new Gtk.ScrolledWindow({ hexpand: true, vexpand: true, hscrollbar_policy: Gtk.PolicyType.NEVER });
            let appClamp = new Adw.Clamp({ maximum_size: 800, margin_top: 24, margin_bottom: 24, margin_start: 12, margin_end: 12 });
            this.appGroup = new Adw.PreferencesGroup({ 
                title: _('Application Keyword Routing'), 
                description: _('Route applications to specific drop zones if their window title or application name matches a keyword.') 
            });
            appClamp.set_child(this.appGroup);
            appScroll.set_child(appClamp);
            notebook.append_page(appScroll, new Gtk.Label({ label: _('App Keywords') }));

            let catScroll = new Gtk.ScrolledWindow({ hexpand: true, vexpand: true, hscrollbar_policy: Gtk.PolicyType.NEVER });
            let catClamp = new Adw.Clamp({ maximum_size: 800, margin_top: 24, margin_bottom: 24, margin_start: 12, margin_end: 12 });
            this.catGroup = new Adw.PreferencesGroup({ 
                title: _('Category Routing'), 
                description: _('Route applications to specific drop zones based on their underlying GNOME desktop metadata category.') 
            });
            catClamp.set_child(this.catGroup);
            catScroll.set_child(catClamp);
            notebook.append_page(catScroll, new Gtk.Label({ label: _('Categories') }));

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

            let addRow = new Adw.ActionRow({ title: _('Add New App Routing Rule') });
            addRow.set_subtitle_lines(0);
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

            let addRow = new Adw.ActionRow({ title: _('Add New Category Routing Rule') });
            addRow.set_subtitle_lines(0);
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

export { ShortcutButton, DictionaryConfigWindow };