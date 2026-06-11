// omnipanel/layout_indicator.js
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

export const LayoutIndicator = GObject.registerClass(
    class LayoutIndicator extends PanelMenu.Button {
        _init(settings, tilingManager, extensionObj) {
            super._init(0.0, _('OmniPanel Command Center'), false);
            this.settings = settings;
            this._tilingManager = tilingManager;
            this._extensionObj = extensionObj;

            let icon = new St.Icon({
                icon_name: 'view-grid-symbolic',
                style_class: 'system-status-icon'
            });
            this.add_child(icon);

            this.menu.connectObject('open-state-changed', (menu, open) => {
                if (open) this._rebuildMenu();
            }, this);

            this._rebuildMenu();
            
            Main.panel.addToStatusArea('omnipanel-layouts', this, 1, 'right');

            this._syncVisibility = () => {
                let isTilingOn = this.settings.get_boolean('enable-tiling');
                let isAutoOn = this.settings.get_boolean('auto-tiling-enabled');
                
                this.visible = !(isTilingOn && isAutoOn);
            };

            this._settingsChangedId1 = this.settings.connect('changed::enable-tiling', this._syncVisibility.bind(this));
            this._settingsChangedId2 = this.settings.connect('changed::auto-tiling-enabled', this._syncVisibility.bind(this));

            this._syncVisibility();
        }

        _escapeMarkup(text) {
            if (!text) return '';
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        _rebuildMenu() {
            this.menu.removeAll();

            let panelToggle = new PopupMenu.PopupSwitchMenuItem(_('Multi-Monitor Top Panel'), this.settings.get_boolean('movement-enabled'));
            panelToggle.connectObject('toggled', (_, state) => {
                this.settings.set_boolean('movement-enabled', state);
            }, this);
            this.menu.addMenuItem(panelToggle);

            let isTilingEnabled = this.settings.get_boolean('enable-tiling');
            let isAutoTilingEnabled = this.settings.get_boolean('auto-tiling-enabled');
            
            let tilingToggle = new PopupMenu.PopupSwitchMenuItem(_('Window Management'), isTilingEnabled);
            tilingToggle.connectObject('toggled', (_, state) => {
                this.settings.set_boolean('enable-tiling', state);
                this._rebuildMenu(); 
            }, this);
            this.menu.addMenuItem(tilingToggle);

            if (isTilingEnabled && !isAutoTilingEnabled) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                let designerToggle = new PopupMenu.PopupSwitchMenuItem(_('Zone Designer Mode'), this._tilingManager.isDesignerActive);
                designerToggle.connectObject('toggled', (_, state) => {
                    if (state) {
                        this._tilingManager.startZoneDesigner();
                    } else {
                        this._tilingManager.stopZoneDesigner();
                    }
                }, this);
                this.menu.addMenuItem(designerToggle);

                let hotkeyRaw = this.settings.get_strv('quick-tiler-hotkey');
                let hotkeyTxt = (hotkeyRaw && hotkeyRaw.length > 0) ? hotkeyRaw[0] : '<Super>g';
                let quickTilerItem = new PopupMenu.PopupMenuItem(`${_('Quick Tiler Grid')} (${hotkeyTxt})`);
                quickTilerItem.connectObject('activate', () => {
                    this._tilingManager.showQuickTiler();
                }, this);
                this.menu.addMenuItem(quickTilerItem);

                let layoutsStr = this.settings.get_string('named-layouts');
                let layouts = {};
                try { layouts = JSON.parse(layoutsStr); } catch { }
                
                let keys = Object.keys(layouts);
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
                            item.label.get_clutter_text().set_markup(`<b><span color="#2ecc71"> </span> ${escapedName}</b> <span size="small" color="gray">${escapedHotkey}</span>`);
                        } else {
                            item.label.get_clutter_text().set_markup(`   ${escapedName} <span size="small" color="gray">${escapedHotkey}</span>`);
                        }

                        item.connectObject('activate', () => {
                            this._tilingManager.storage.restoreNamedLayout(name);
                            this._rebuildMenu();
                        }, this);
                        this.menu.addMenuItem(item);
                    }
                }
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let prefsItem = new PopupMenu.PopupImageMenuItem(_('Settings'), 'preferences-system-symbolic');
            prefsItem.connectObject('activate', () => {
                if (this._extensionObj && typeof this._extensionObj.openPreferences === 'function') {
                    this._extensionObj.openPreferences();
                } else {
                    try {
                        let app = Gio.AppInfo.create_from_commandline(
                            'gnome-extensions prefs omnipanel@christian', 
                            'OmniPanel Prefs', 
                            Gio.AppInfoCreateFlags.NONE
                        );
                        app.launch([], null);
                    } catch { }
                }
            }, this);
            this.menu.addMenuItem(prefsItem);
        }

        destroy() {
            if (this._settingsChangedId1) {
                this.settings.disconnect(this._settingsChangedId1);
                this._settingsChangedId1 = 0;
            }
            if (this._settingsChangedId2) {
                this.settings.disconnect(this._settingsChangedId2);
                this._settingsChangedId2 = 0;
            }
            super.destroy();
        }
    }
);