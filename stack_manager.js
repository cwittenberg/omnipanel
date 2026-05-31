import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { applyWindowTransform, getSectionRect, Sections, isWindowValid } from './layout_definitions.js';

export class StackManager {
    constructor(tilingManager) {
        this.manager = tilingManager;
        this.settings = tilingManager.settings;
        this._enabled = false;
        this._overlays = new Map();
        this._loopId = 0;
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;
        this._startLoop();
    }

    disable() {
        if (!this._enabled) return;
        this._enabled = false;

        if (this._loopId) {
            GLib.source_remove(this._loopId);
            this._loopId = 0;
        }
        this.clearOverlays();
    }

    clearOverlays() {
        for (let overlay of this._overlays.values()) {
            Main.layoutManager.uiGroup.remove_child(overlay.widget);
            overlay.widget.destroy();
        }
        this._overlays.clear();
    }

    _startLoop() {
        this._loopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            try { this.updateOverlays(); } catch {}
            return GLib.SOURCE_CONTINUE;
        });
    }
    
    invalidateSignature(zoneName) {
        if (zoneName && this._overlays.has(zoneName)) {
            this._overlays.get(zoneName).lastSignature = '';
        } else {
            for (let overlay of this._overlays.values()) {
                overlay.lastSignature = '';
            }
        }
    }

    applyStackLayout(zoneName, windows, monitorIndex, mode) {
        let customSections = this.manager.storage.getCustomSections();
        
        let actualMonitor = monitorIndex;
        if (customSections[zoneName] && customSections[zoneName].monitorIndex !== undefined) {
            actualMonitor = customSections[zoneName].monitorIndex;
        }

        let zRect = getSectionRect(actualMonitor, zoneName, customSections);
        if (!zRect || windows.length === 0) return;

        let validWindows = windows.filter(w => w && w.get_workspace());
        let count = validWindows.length;
        if (count === 0) return;

        let staggerStep = count > 10 ? 10 : 100;
        let delay = 0;

        for (let i = 0; i < count; i++) {
            let win = validWindows[i];
            let winId = 0;
            try { winId = win.get_id(); } catch { continue; }
            
            let rx = zRect.x;
            let ry = zRect.y;
            let rw = zRect.width;
            let rh = zRect.height;

            if (mode === 'grid') {
                let cols = Math.ceil(Math.sqrt(count));
                let rows = Math.ceil(count / cols);
                let row = Math.floor(i / cols);
                let col = i % cols;
                
                let itemsInThisRow = (row === rows - 1) ? (count - (row * cols)) : cols;
                rw = zRect.width / itemsInThisRow;
                rh = zRect.height / rows;
                
                rx = zRect.x + (col * rw);
                ry = zRect.y + (row * rh);
            } else if (mode === 'rows' || mode === 'horizontal') {
                rh = zRect.height / count;
                ry = zRect.y + (i * rh);
            } else if (mode === 'columns' || mode === 'vertical') {
                rw = zRect.width / count;
                rx = zRect.x + (i * rw);
            }
            
            let finalRect = {
                x: Math.round(rx),
                y: Math.round(ry),
                width: Math.max(10, Math.round(rw)),
                height: Math.max(10, Math.round(rh))
            };

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                let aliveWindows = global.display.list_all_windows();
                let aliveWin = aliveWindows.find(w => {
                    try { return w.get_id() === winId; } catch { return false; }
                });

                if (aliveWin && isWindowValid(aliveWin)) {
                    applyWindowTransform(aliveWin, actualMonitor, finalRect, false);
                }
                return GLib.SOURCE_REMOVE;
            });
            delay += staggerStep;
        }
    }

    _getStackZoneForWindow(win, customSections) {
        if (!win._omnipanel_zone) {
            return null;
        }

        let isStandard = Object.values(Sections).includes(win._omnipanel_zone);
        if (customSections[win._omnipanel_zone] || isStandard) {
            return win._omnipanel_zone;
        }

        return null;
    }

    _createOverlay(zone, actualMonitor) {
        let widget = new St.BoxLayout({
            vertical: false,
            style: 'background-color: rgba(20, 20, 20, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; transition-duration: 150ms;',
            reactive: true,
            track_hover: true 
        });

        let countLabel = new St.Label({
            text: '2',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'color: white; font-weight: bold; margin: 0 8px;'
        });

        let btnStyle = 'padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; background-color: transparent; transition-duration: 100ms; margin: 0 2px;';
        let btnHoverStyle = 'background-color: rgba(255,255,255,0.2);';
        let btnActiveStyle = 'background-color: rgba(46, 204, 113, 0.25); color: #2ecc71;';
        
        let prevBtn = new St.Button({ child: new St.Icon({icon_name: 'go-previous-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true });
        let nextBtn = new St.Button({ child: new St.Icon({icon_name: 'go-next-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true });
        let toggleMenuBtn = new St.Button({ child: new St.Icon({icon_name: 'view-grid-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true });

        let modeBox = new St.BoxLayout({ vertical: false, visible: false });
        let separator = new St.Widget({ style: 'width: 1px; background-color: rgba(255,255,255,0.2); margin: 0 6px;' });

        let modeGridBtn = new St.Button({ child: new St.Icon({icon_name: 'view-grid-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true });
        let modeColsBtn = new St.Button({ child: new St.Icon({icon_name: 'view-dual-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true });
        let modeRowsBtn = new St.Button({ child: new St.Icon({icon_name: 'view-list-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true });
        let modeStackBtn = new St.Button({ child: new St.Icon({icon_name: 'window-restore-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true });

        modeBox.add_child(separator);
        modeBox.add_child(modeGridBtn);
        modeBox.add_child(modeColsBtn);
        modeBox.add_child(modeRowsBtn);
        modeBox.add_child(modeStackBtn);

        prevBtn.hide();
        nextBtn.hide();
        toggleMenuBtn.hide();

        widget.add_child(countLabel);
        widget.add_child(toggleMenuBtn);
        widget.add_child(modeBox);
        widget.add_child(prevBtn);
        widget.add_child(nextBtn);

        let data = { 
            widget, 
            countLabel, 
            windows: [], 
            topWindow: null, 
            monitor: actualMonitor, 
            lastSignature: '', 
            activeMode: this.settings.get_string('default-stack-mode') || 'stack',
            currentIndex: 0
        };

        data.syncModeStyles = () => {
            let cs = this.manager.storage.getCustomSections();
            data.activeMode = (cs[zone] && cs[zone].stackMode) ? cs[zone].stackMode : (this.settings.get_string('default-stack-mode') || 'stack');
            
            let evalMode = data.activeMode;
            if (evalMode === 'horizontal') evalMode = 'rows';
            if (evalMode === 'vertical') evalMode = 'columns';
            
            let applyStyle = (btn, mode) => {
                if (mode === evalMode) {
                    btn.set_style(btnStyle + btnActiveStyle);
                } else {
                    btn.set_style(btn.hover ? btnStyle + btnHoverStyle : btnStyle);
                }
            };

            applyStyle(modeStackBtn, 'stack');
            applyStyle(modeColsBtn, 'columns');
            applyStyle(modeRowsBtn, 'rows');
            applyStyle(modeGridBtn, 'grid');
        };

        let doPrev = () => {
            if (data.windows.length === 0) return;
            data.currentIndex = (data.currentIndex - 1 + data.windows.length) % data.windows.length;
            Main.activateWindow(data.windows[data.currentIndex]);
        };

        let doNext = () => {
            if (data.windows.length === 0) return;
            data.currentIndex = (data.currentIndex + 1) % data.windows.length;
            Main.activateWindow(data.windows[data.currentIndex]);
        };

        let keyPressId = 0;

        widget.connect('destroy', () => {
            if (keyPressId) {
                global.stage.disconnect(keyPressId);
                keyPressId = 0;
            }
        });

        let updateUIState = () => {
            let isHovered = widget.hover;
            
            if (isHovered) {
                if (data.activeMode === 'stack') {
                    prevBtn.show();
                    nextBtn.show();
                } else {
                    prevBtn.hide();
                    nextBtn.hide();
                }
                
                if (!modeBox.visible) {
                    toggleMenuBtn.show();
                }
                data.syncModeStyles();
                widget.set_style('background-color: rgba(20, 20, 20, 0.95); border: 1px solid #2ecc71; border-radius: 8px; padding: 4px; box-shadow: 0 4px 12px rgba(46, 204, 113, 0.3); transition-duration: 150ms;');
                
                if (!keyPressId) {
                    keyPressId = global.stage.connect('captured-event', (actor, event) => {
                        if (event.type() === Clutter.EventType.KEY_PRESS) {
                            let sym = event.get_key_symbol();
                            if (sym === Clutter.KEY_Left) {
                                doPrev();
                                return Clutter.EVENT_STOP;
                            } else if (sym === Clutter.KEY_Right) {
                                doNext();
                                return Clutter.EVENT_STOP;
                            }
                        }
                        return Clutter.EVENT_PROPAGATE;
                    });
                }
            } else {
                prevBtn.hide();
                nextBtn.hide();
                toggleMenuBtn.hide();
                modeBox.hide();
                
                let cs = this.manager.storage.getCustomSections();
                let savedMode = (cs[zone] && cs[zone].stackMode) ? cs[zone].stackMode : (this.settings.get_string('default-stack-mode') || 'stack');
                this.applyStackLayout(zone, data.windows, data.monitor, savedMode);
                
                widget.set_style('background-color: rgba(20, 20, 20, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; transition-duration: 150ms;');
                
                if (keyPressId) {
                    global.stage.disconnect(keyPressId);
                    keyPressId = 0;
                }
            }

            let cs = this.manager.storage.getCustomSections();
            let zRect = getSectionRect(data.monitor, zone, cs);
            if (zRect) {
                let padding = 16;
                let prefWidth = widget.get_preferred_width(-1)[1];
                let prefHeight = widget.get_preferred_height(-1)[1];
                let pos = this.settings.get_string('stack-indicator-position') || 'bottom-right';
                let ox = pos === 'bottom-right' ? zRect.x + zRect.width - prefWidth - padding : zRect.x + padding;
                let oy = zRect.y + zRect.height - prefHeight - padding;
                widget.set_position(ox, oy);
            }
        };

        widget.connect('notify::hover', updateUIState);

        let bindStandardHover = (btn) => {
            btn.connect('notify::hover', () => btn.set_style(btn.hover ? btnStyle + btnHoverStyle : btnStyle));
        };
        
        bindStandardHover(prevBtn);
        bindStandardHover(nextBtn);
        bindStandardHover(toggleMenuBtn);

        toggleMenuBtn.connect('clicked', () => {
            toggleMenuBtn.hide();
            modeBox.show();
            updateUIState();
        });

        let bindModePreviewAndClick = (btn, modeName) => {
            btn.connect('notify::hover', () => {
                if (btn.hover) {
                    this.applyStackLayout(zone, data.windows, data.monitor, modeName);
                }
                data.syncModeStyles();
            });
            btn.connect('clicked', () => {
                let cs = this.manager.storage.getCustomSections();
                if (!cs[zone]) cs[zone] = {}; 
                cs[zone].stackMode = modeName;
                this.manager.storage.setCustomSectionsAndSave(cs);
                
                data.syncModeStyles();
                
                if (data.activeMode === 'stack') {
                    prevBtn.show();
                    nextBtn.show();
                } else {
                    prevBtn.hide();
                    nextBtn.hide();
                }
                
                btn.set_style(btnStyle + 'background-color: #2ecc71; color: #111;');
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                    if (btn) data.syncModeStyles();
                    return GLib.SOURCE_REMOVE;
                });
            });
        };

        bindModePreviewAndClick(modeStackBtn, 'stack');
        bindModePreviewAndClick(modeColsBtn, 'columns');
        bindModePreviewAndClick(modeRowsBtn, 'rows');
        bindModePreviewAndClick(modeGridBtn, 'grid');

        prevBtn.connect('clicked', doPrev);
        nextBtn.connect('clicked', doNext);

        Main.layoutManager.uiGroup.add_child(widget);
        return data;
    }

    updateOverlays() {
        if (!this.settings.get_boolean('enable-stack-indicators')) {
            this.clearOverlays();
            return;
        }

        let allWindows = global.display.list_all_windows();
        let activeWs = global.workspace_manager.get_active_workspace();
        
        let windows = allWindows.filter(w => {
            try {
                if (!w._omnipanel_zone) return false;
                let actor = w.get_compositor_private();
                if (!actor || actor.is_destroyed()) return false;

                let ws = w.get_workspace();
                return ws === activeWs || w.is_on_all_workspaces() || !ws;
            } catch { return false; }
        });

        let focusWindow = global.display.get_focus_window();
        let customSections = this.manager.storage.getCustomSections();
        let stacks = {};

        for (let win of windows) {
            try {
                try { win.get_id(); } catch { continue; }
                
                let wType = win.get_window_type();
                if (win.is_override_redirect() || (wType !== Meta.WindowType.NORMAL && wType !== Meta.WindowType.DIALOG)) continue;

                let stackZone = this._getStackZoneForWindow(win, customSections);
                if (stackZone) {
                    let mIndex = win._omnipanel_monitor !== undefined ? win._omnipanel_monitor : win.get_monitor();
                    if (customSections[stackZone] && customSections[stackZone].monitorIndex !== undefined) {
                        mIndex = customSections[stackZone].monitorIndex;
                    }
                    let key = stackZone + '|' + mIndex;
                    if (!stacks[key]) stacks[key] = { zone: stackZone, monitor: mIndex, windows: [] };
                    stacks[key].windows.push(win);
                }
            } catch { continue; }
        }

        let currentStackKeys = new Set();
        for (let [key, stackData] of Object.entries(stacks)) {
            if (stackData.windows.length > 1) {
                currentStackKeys.add(key);
                stackData.windows.sort((a, b) => {
                    let aId = 0, bId = 0;
                    try { aId = a.get_id(); } catch {}
                    try { bId = b.get_id(); } catch {}
                    return aId - bId;
                });
            }
        }

        for (let [key, overlay] of this._overlays.entries()) {
            if (!currentStackKeys.has(key)) {
                if (stacks[key] && stacks[key].windows.length === 1) {
                    let topWin = stacks[key].windows[0];
                    let zRect = getSectionRect(stacks[key].monitor, stacks[key].zone, customSections);
                    if (zRect) applyWindowTransform(topWin, stacks[key].monitor, zRect, false);
                }

                Main.layoutManager.uiGroup.remove_child(overlay.widget);
                overlay.widget.destroy();
                this._overlays.delete(key);
            }
        }

        for (let key of currentStackKeys) {
            let stackData = stacks[key];
            let zone = stackData.zone;
            let actualMonitor = stackData.monitor;
            let stackWindows = stackData.windows;
            
            let topWindow = [...stackWindows].sort((a, b) => {
                return windows.indexOf(a) - windows.indexOf(b);
            })[0];

            if (!this._overlays.has(key)) {
                this._overlays.set(key, this._createOverlay(zone, actualMonitor));
            }

            let overlay = this._overlays.get(key);
            let zRect = getSectionRect(actualMonitor, zone, customSections);
            let zRectStr = zRect ? `${zRect.x},${zRect.y},${zRect.width},${zRect.height}` : '';
            let pMode = (customSections[zone] && customSections[zone].stackMode) ? customSections[zone].stackMode : (this.settings.get_string('default-stack-mode') || 'stack');
            
            let currentSignature = stackWindows.map(w => {
                try { return w.get_id(); } catch { return 0; }
            }).join(',') + '|' + zRectStr + '|' + pMode;

            if (overlay.lastSignature !== currentSignature) {
                overlay.lastSignature = currentSignature;
                overlay.windows = stackWindows;
                overlay.topWindow = topWindow;
                overlay.monitor = actualMonitor;
                overlay.countLabel.set_text(stackWindows.length.toString());
                
                this.applyStackLayout(zone, stackWindows, actualMonitor, pMode);
            } else {
                overlay.topWindow = topWindow;
            }

            overlay.syncModeStyles();

            if (zRect) {
                let padding = 16;
                let prefWidth = overlay.widget.get_preferred_width(-1)[1];
                let prefHeight = overlay.widget.get_preferred_height(-1)[1];
                let pos = this.settings.get_string('stack-indicator-position') || 'bottom-right';
                let ox = pos === 'bottom-right' ? zRect.x + zRect.width - prefWidth - padding : zRect.x + padding;
                let oy = zRect.y + zRect.height - prefHeight - padding;
                overlay.widget.set_position(ox, oy);
            }
            
            let isActiveStack = focusWindow && stackWindows.includes(focusWindow);
            if (isActiveStack) {
                if (!overlay.widget.visible) overlay.widget.show();
                overlay.currentIndex = stackWindows.indexOf(focusWindow);
            } else {
                if (overlay.widget.visible) overlay.widget.hide();
            }
        }
    }
}