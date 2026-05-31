import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const LayoutIndicator = GObject.registerClass(
    class LayoutIndicator extends PanelMenu.Button {
        _init(settings, tilingManager) {
            super._init(0.0, 'OmniPanel Command Center', false);
            this.settings = settings;
            this._tilingManager = tilingManager;

            let icon = new St.Icon({
                icon_name: 'view-grid-symbolic',
                style_class: 'system-status-icon'
            });
            this.add_child(icon);

            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) this._rebuildMenu();
            });
            this._rebuildMenu();
            
            Main.panel.addToStatusArea('omnipanel-layouts', this, 1, 'right');
        }

        _escapeMarkup(text) {
            if (!text) return '';
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        _rebuildMenu() {
            this.menu.removeAll();

            let panelToggle = new PopupMenu.PopupSwitchMenuItem('Multi-Monitor Top Panel', this.settings.get_boolean('movement-enabled'));
            panelToggle.connect('toggled', (_, state) => {
                this.settings.set_boolean('movement-enabled', state);
            });
            this.menu.addMenuItem(panelToggle);

            let isTilingEnabled = this.settings.get_boolean('enable-tiling');

            let tilingToggle = new PopupMenu.PopupSwitchMenuItem('Window Layouts', isTilingEnabled);
            tilingToggle.connect('toggled', (_, state) => {
                this.settings.set_boolean('enable-tiling', state);
                this._rebuildMenu(); // Instantly show/hide the layout items below
            });
            this.menu.addMenuItem(tilingToggle);

            if (isTilingEnabled) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                let designerToggle = new PopupMenu.PopupSwitchMenuItem('Zone Designer Mode', this._tilingManager.isDesignerActive);
                designerToggle.connect('toggled', (_, state) => {
                    if (state) {
                        this._tilingManager.startZoneDesigner();
                    } else {
                        this._tilingManager.stopZoneDesigner();
                    }
                });
                this.menu.addMenuItem(designerToggle);

                let layoutsStr = this.settings.get_string('named-layouts');
                let layouts = {};
                try { layouts = JSON.parse(layoutsStr); } catch { }
                
                let keys = Object.keys(layouts);

                // FIX: Auto-select if there is exactly 1 layout available and none is currently active
                if (keys.length === 1 && (!this._tilingManager.activeLayoutName || !layouts[this._tilingManager.activeLayoutName])) {
                    this._tilingManager.activeLayoutName = keys[0];
                    if (!this.settings.get_string('default-layout')) {
                        this.settings.set_string('default-layout', keys[0]);
                    }
                }

                if (keys.length > 0) {
                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    for (let name of keys) {
                        let isActive = (this._tilingManager.activeLayoutName === name);
                        let hotkey = layouts[name].hotkeyText ? `(${layouts[name].hotkeyText})` : '';
                        let escapedName = this._escapeMarkup(name);
                        let escapedHotkey = this._escapeMarkup(hotkey);

                        let item = new PopupMenu.PopupMenuItem('');
                        
                        if (isActive) {
                            item.label.get_clutter_text().set_markup(`<b><span color="#2ecc71">✔</span> ${escapedName}</b> <span size="small" color="gray">${escapedHotkey}</span>`);
                        } else {
                            item.label.get_clutter_text().set_markup(`   ${escapedName} <span size="small" color="gray">${escapedHotkey}</span>`);
                        }

                        item.connect('activate', () => {
                            this._tilingManager.storage.restoreNamedLayout(name);
                            this._rebuildMenu();
                        });
                        this.menu.addMenuItem(item);
                    }
                }
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let prefsItem = new PopupMenu.PopupMenuItem('OmniPanel Settings');
            prefsItem.connect('activate', () => {
                try {
                    let app = Gio.AppInfo.create_from_commandline(
                        'gnome-extensions prefs omnipanel@christian', 
                        'OmniPanel Prefs', 
                        Gio.AppInfoCreateFlags.NONE
                    );
                    app.launch([], null);
                } catch { }
            });
            this.menu.addMenuItem(prefsItem);
        }
    }
);