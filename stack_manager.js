// omnipanel/stack_manager.js
/*
 * COMPARISON TO PREVIOUS:
 * - CRITICAL BUG FIX (X11): Replaced `Main.layoutManager.uiGroup.add_child()` with `Main.layoutManager.addChrome()`.
 * This explicitly registers the overlay with Mutter's input tracker, forcing the X server to dynamically 
 * recalculate the input shape (XShape) when the menu expands on hover, preventing clicks from falling through to the client window.
 * - Updated cleanup functions to use `removeChrome()` respectively.
 */
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { getSectionRect, Sections, isWindowIgnored } from './layout_definitions.js';
import { applyWindowTransform } from './window_manager_adapter.js';

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
            Main.layoutManager.removeChrome(overlay.widget);
            overlay.widget.destroy();
        }
        this._overlays.clear();
    }

    _startLoop() {
        this._loopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (!this._enabled) return GLib.SOURCE_REMOVE;
            try { this.updateOverlays(); } catch (e) { this.manager._log(`[StackManager Error] ${e}`); }
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

        for (let i = 0; i < count; i++) {
            let win = validWindows[i];
            
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
                rw = zRect.width;
                rx = zRect.x;

            } else if (mode === 'columns' || mode === 'vertical') {
                rw = zRect.width / count;
                rx = zRect.x + (i * rw);
                rh = zRect.height;
                ry = zRect.y;
            }
            
            let finalRect = {
                x: Math.round(rx),
                y: Math.round(ry),
                width: Math.round(rw),
                height: Math.round(rh)
            };

            applyWindowTransform(win, actualMonitor, finalRect, false, this.manager._log.bind(this.manager));
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

        widget.connect('button-press-event', () => Clutter.EVENT_STOP);
        widget.connect('button-release-event', () => Clutter.EVENT_STOP);

        let countLabel = new St.Label({
            text: '2',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'color: white; font-weight: bold; margin: 0 8px;'
        });

        let btnStyle = 'padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; background-color: transparent; transition-duration: 100ms; margin: 0 2px;';
        let btnHoverStyle = 'background-color: rgba(255,255,255,0.2);';
        let btnActiveStyle = 'background-color: rgba(46, 204, 113, 0.25); color: #2ecc71;';
        
        let prevBtn = new St.Button({ child: new St.Icon({icon_name: 'go-previous-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true, can_focus: true });
        let nextBtn = new St.Button({ child: new St.Icon({icon_name: 'go-next-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true, can_focus: true });
        let toggleMenuBtn = new St.Button({ child: new St.Icon({icon_name: 'view-grid-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true, can_focus: true });

        let modeBox = new St.BoxLayout({ vertical: false, visible: false, reactive: true });
        modeBox.connect('button-press-event', () => Clutter.EVENT_STOP);
        modeBox.connect('button-release-event', () => Clutter.EVENT_STOP);

        let separator = new St.Widget({ style: 'width: 1px; background-color: rgba(255,255,255,0.2); margin: 0 6px;' });
        let modeGridBtn = new St.Button({ child: new St.Icon({icon_name: 'view-grid-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true, can_focus: true });
        let modeColsBtn = new St.Button({ child: new St.Icon({icon_name: 'view-dual-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true, can_focus: true });
        let modeRowsBtn = new St.Button({ child: new St.Icon({icon_name: 'view-list-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true, can_focus: true });
        let modeStackBtn = new St.Button({ child: new St.Icon({icon_name: 'window-restore-symbolic', icon_size: 16}), style: btnStyle, reactive: true, track_hover: true, can_focus: true });

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
            lastActualMode: 'stack',
            currentIndex: 0
        };

        data.syncModeStyles = () => {
            let actualMode = data.lastActualMode || 'stack';
            
            let applyStyle = (btn, modeName) => {
                btn.reactive = true;
                
                if (modeName === actualMode) {
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

        prevBtn.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) { doPrev(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });
        nextBtn.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) { doNext(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });

        let hideTimeoutId = 0;
        let keyPressId = 0;

        widget.connect('destroy', () => {
            if (keyPressId) {
                global.stage.disconnect(keyPressId);
                keyPressId = 0;
            }
            if (hideTimeoutId) {
                GLib.source_remove(hideTimeoutId);
                hideTimeoutId = 0;
            }
        });

        let updateUIState = () => {
            let isHovered = widget.hover;
            
            if (isHovered) {
                if (hideTimeoutId) {
                    GLib.source_remove(hideTimeoutId);
                    hideTimeoutId = 0;
                }

                if (data.lastActualMode === 'stack') {
                    prevBtn.show();
                    nextBtn.show();
                } else {
                    prevBtn.hide();
                    nextBtn.hide();
                }
                
                toggleMenuBtn.hide();
                modeBox.show();

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
                if (!hideTimeoutId) {
                    hideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                        hideTimeoutId = 0;
                        if (widget.hover) return GLib.SOURCE_REMOVE;

                        prevBtn.hide();
                        nextBtn.hide();
                        
                        toggleMenuBtn.show();
                        modeBox.hide();
                        
                        widget.set_style('background-color: rgba(20, 20, 20, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; transition-duration: 150ms;');
                        
                        if (keyPressId) {
                            global.stage.disconnect(keyPressId);
                            keyPressId = 0;
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
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }

            let cs = this.manager.storage.getCustomSections();
            let zRect = getSectionRect(data.monitor, zone, cs);
            if (zRect && isHovered) {
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

        toggleMenuBtn.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                toggleMenuBtn.hide();
                modeBox.show();
                data.syncModeStyles();
                
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
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        let bindModePreviewAndClick = (btn, modeName) => {
            btn.connect('notify::hover', () => {
                data.syncModeStyles();
            });

            let executeActivation = () => {
                this.manager._log(`[StackManager] Stack mode explicitly clicked: ${modeName} for zone: ${zone}`);
                if (!btn.reactive) return;

                let cs = this.manager.storage.getCustomSections();
                if (!cs[zone]) cs[zone] = {}; 
                cs[zone].stackMode = modeName;
                this.manager.storage.setCustomSectionsAndSave(cs);
                
                data.lastActualMode = modeName;
                data.syncModeStyles();
                
                if (data.lastActualMode === 'stack') {
                    prevBtn.show();
                    nextBtn.show();
                } else {
                    prevBtn.hide();
                    nextBtn.hide();
                }
                
                btn.set_style(btnStyle + 'background-color: #2ecc71; color: #111;');

                for (let w of data.windows) {
                    w._omnipanel_last_req = '';
                }

                this.applyStackLayout(zone, data.windows, data.monitor, modeName);
                this.invalidateSignature(zone);

                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                    if (btn) data.syncModeStyles();
                    return GLib.SOURCE_REMOVE;
                });
            };

            btn.connect('button-press-event', (actor, event) => {
                if (event.get_button() === 1) { 
                    executeActivation();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
        };

        bindModePreviewAndClick(modeStackBtn, 'stack');
        bindModePreviewAndClick(modeColsBtn, 'columns');
        bindModePreviewAndClick(modeRowsBtn, 'rows');
        bindModePreviewAndClick(modeGridBtn, 'grid');

        // FORCE MUTTER TO TRACK THE X11 INPUT SHAPE
        Main.layoutManager.addChrome(widget);

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
                if (isWindowIgnored(w, this.settings)) return false;
                if (!w._omnipanel_zone) return false;
                let actor = w.get_compositor_private();
                if (!actor || actor.is_destroyed()) return false;
                
                let isSkipTaskbar = typeof w.is_skip_taskbar === 'function' ? w.is_skip_taskbar() : false;
                let isSkipPager = typeof w.is_skip_pager === 'function' ? w.is_skip_pager() : false;
                if (isSkipTaskbar || isSkipPager) return false;

                let wType = w.get_window_type();
                if (w.is_override_redirect() || wType !== Meta.WindowType.NORMAL) return false;
                if (w.get_transient_for() !== null) return false;
                
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
                    
                    if (zRect) {
                        applyWindowTransform(topWin, stacks[key].monitor, zRect, false, this.manager._log.bind(this.manager));
                    }
                }

                Main.layoutManager.removeChrome(overlay.widget);
                overlay.widget.destroy();
                this._overlays.delete(key);
            }
        }

        for (let key of currentStackKeys) {
            let stackData = stacks[key];
            let zone = stackData.zone;
            let actualMonitor = stackData.monitor;
            let stackWindows = stackData.windows;
            let count = stackWindows.length;
            
            let topWindow = [...stackWindows].sort((a, b) => {
                return windows.indexOf(a) - windows.indexOf(b);
            })[0];

            if (!this._overlays.has(key)) {
                this._overlays.set(key, this._createOverlay(zone, actualMonitor));
            }
            let overlay = this._overlays.get(key);
            let zRect = getSectionRect(actualMonitor, zone, customSections);
            
            let pMode = (customSections[zone] && customSections[zone].stackMode) ? customSections[zone].stackMode : (this.settings.get_string('default-stack-mode') || 'stack');
            
            let evalMode = pMode;
            if (evalMode === 'horizontal') evalMode = 'rows';
            if (evalMode === 'vertical') evalMode = 'columns';
            
            let actualMode = evalMode;
            overlay.lastActualMode = actualMode;
            
            let zRectStr = zRect ? `${zRect.x},${zRect.y},${zRect.width},${zRect.height}` : '';
            let currentSignature = stackWindows.map(w => {
                try { return w.get_id(); } catch { return 0; }
            }).join(',') + '|' + zRectStr + '|' + actualMode;

            if (overlay.lastSignature !== currentSignature) {
                overlay.lastSignature = currentSignature;
                overlay.windows = stackWindows;
                overlay.topWindow = topWindow;
                overlay.monitor = actualMonitor;
                overlay.countLabel.set_text(count.toString());
                
                this.applyStackLayout(zone, stackWindows, actualMonitor, actualMode);
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