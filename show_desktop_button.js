// omnipanel/show_desktop_button.js
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { t } from './i18n.js';

export const ShowDesktopButton = GObject.registerClass(
    class ShowDesktopButton extends PanelMenu.Button {
        _init(settings) {
            super._init(0.0, t(settings, 'Show Desktop'), false);
            this.settings = settings;
            this._minimizedMap = new Map();

            let icon = new St.Icon({
                icon_name: 'computer-symbolic',
                style_class: 'system-status-icon'
            });
            this.add_child(icon);

            this.connect('button-release-event', () => {
                this._onClicked();
                return Clutter.EVENT_STOP;
            });
            
            this._settingsChangedId = this.settings.connect('changed::show-desktop-enabled', this._syncVisibility.bind(this));
            this._syncVisibility();
        }

        _syncVisibility() {
            this.visible = this.settings.get_boolean('show-desktop-enabled');
        }

        _onClicked() {
            let monitorIndex = global.display.get_current_monitor();
            let workspace = global.workspace_manager.get_active_workspace();
            let windows = global.display.get_tab_list(Meta.TabList.NORMAL, workspace);
            
            let targetWindows = windows.filter(w => w.get_monitor() === monitorIndex);
            let savedState = this._minimizedMap.get(monitorIndex) || [];

            let allCurrentlyMinimized = true;
            for (let win of targetWindows) {
                if (!win.minimized && typeof win.can_minimize === 'function' && win.can_minimize()) {
                    allCurrentlyMinimized = false;
                    break;
                }
            }

            if (savedState.length > 0 && allCurrentlyMinimized) {
                for (let win of savedState) {
                    try {
                        if (win && win.get_compositor_private() && !win.get_compositor_private().is_destroyed()) {
                            win.unminimize();
                        }
                    } catch { }
                }
                this._minimizedMap.delete(monitorIndex);
            } else {
                let toMinimize = targetWindows.filter(w => !w.minimized && typeof w.can_minimize === 'function' && w.can_minimize());
                if (toMinimize.length > 0) {
                    this._minimizedMap.set(monitorIndex, toMinimize);
                    for (let win of toMinimize) {
                        win.minimize();
                    }
                }
            }
        }

        destroy() {
            if (this._settingsChangedId) {
                this.settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = 0;
            }
            this._minimizedMap.clear();
            super.destroy();
        }
    }
);