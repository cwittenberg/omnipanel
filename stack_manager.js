// omnipanel/stack_manager.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { getSectionRect, Sections, isWindowIgnored } from './layout_definitions.js';
import { applyWindowTransform } from './window_manager_adapter.js';

// --- VIEW LAYER (MVC) ---
const StackOverlayView = GObject.registerClass(
    class StackOverlayView extends St.BoxLayout {
        _init(zone, actualMonitor, stackManager) {
            super._init({
                vertical: false,
                style: 'background-color: rgba(20, 20, 20, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; transition-duration: 150ms;',
                reactive: true,
                track_hover: true 
            });

            this.zone = zone;
            this.monitor = actualMonitor;
            this.stackManager = stackManager;
            this.windows = [];
            this.topWindow = null;
            this.lastSignature = '';
            this.lastActualMode = 'stack';
            this.currentIndex = 0;
            
            this.hideTimeoutId = 0;
            this.keyPressId = 0;

            this.btnStyle = 'padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; background-color: transparent; transition-duration: 100ms; margin: 0 2px;';
            this.btnHoverStyle = 'background-color: rgba(255,255,255,0.2);';
            this.btnActiveStyle = 'background-color: rgba(46, 204, 113, 0.25); color: #2ecc71;';

            this._buildUI();
            this._bindEvents();
        }

        _buildUI() {
            this.countLabel = new St.Label({
                text: '2',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'color: white; font-weight: bold; margin: 0 8px;'
            });

            this.prevBtn = new St.Button({ child: new St.Icon({icon_name: 'go-previous-symbolic', icon_size: 16}), style: this.btnStyle, reactive: true, track_hover: true, can_focus: true });
            this.nextBtn = new St.Button({ child: new St.Icon({icon_name: 'go-next-symbolic', icon_size: 16}), style: this.btnStyle, reactive: true, track_hover: true, can_focus: true });
            this.toggleMenuBtn = new St.Button({ child: new St.Icon({icon_name: 'view-grid-symbolic', icon_size: 16}), style: this.btnStyle, reactive: true, track_hover: true, can_focus: true });

            this.modeBox = new St.BoxLayout({ vertical: false, visible: false, reactive: true });
            
            let separator = new St.Widget({ style: 'width: 1px; background-color: rgba(255,255,255,0.2); margin: 0 6px;' });
            this.modeGridBtn = new St.Button({ child: new St.Icon({icon_name: 'view-grid-symbolic', icon_size: 16}), style: this.btnStyle, reactive: true, track_hover: true, can_focus: true });
            this.modeColsBtn = new St.Button({ child: new St.Icon({icon_name: 'view-dual-symbolic', icon_size: 16}), style: this.btnStyle, reactive: true, track_hover: true, can_focus: true });
            this.modeRowsBtn = new St.Button({ child: new St.Icon({icon_name: 'view-list-symbolic', icon_size: 16}), style: this.btnStyle, reactive: true, track_hover: true, can_focus: true });
            this.modeStackBtn = new St.Button({ child: new St.Icon({icon_name: 'window-restore-symbolic', icon_size: 16}), style: this.btnStyle, reactive: true, track_hover: true, can_focus: true });

            this.modeBox.add_child(separator);
            this.modeBox.add_child(this.modeGridBtn);
            this.modeBox.add_child(this.modeColsBtn);
            this.modeBox.add_child(this.modeRowsBtn);
            this.modeBox.add_child(this.modeStackBtn);

            this.prevBtn.hide();
            this.nextBtn.hide();
            this.toggleMenuBtn.hide();

            this.add_child(this.countLabel);
            this.add_child(this.toggleMenuBtn);
            this.add_child(this.modeBox);
            this.add_child(this.prevBtn);
            this.add_child(this.nextBtn);
        }

        _bindEvents() {
            this.connect('button-press-event', () => Clutter.EVENT_STOP);
            this.connect('button-release-event', () => Clutter.EVENT_STOP);
            this.modeBox.connect('button-press-event', () => Clutter.EVENT_STOP);
            this.modeBox.connect('button-release-event', () => Clutter.EVENT_STOP);
            this.connect('notify::hover', this._onHoverChanged.bind(this));
            
            this.prevBtn.connect('button-press-event', (actor, event) => {
                if (event.get_button() === 1) { this.doPrev(); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            });
            
            this.nextBtn.connect('button-press-event', (actor, event) => {
                if (event.get_button() === 1) { this.doNext(); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            });

            this.toggleMenuBtn.connect('button-press-event', (actor, event) => {
                if (event.get_button() === 1) {
                    this.toggleMenuBtn.hide();
                    this.modeBox.show();
                    this.syncModeStyles();
                    this.reposition();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            let bindStandardHover = (btn) => {
                btn.connect('notify::hover', () => btn.set_style(btn.hover ? this.btnStyle + this.btnHoverStyle : this.btnStyle));
            };
            
            bindStandardHover(this.prevBtn);
            bindStandardHover(this.nextBtn);
            bindStandardHover(this.toggleMenuBtn);

            this._bindModePreviewAndClick(this.modeStackBtn, 'stack');
            this._bindModePreviewAndClick(this.modeColsBtn, 'columns');
            this._bindModePreviewAndClick(this.modeRowsBtn, 'rows');
            this._bindModePreviewAndClick(this.modeGridBtn, 'grid');

            this.connect('destroy', this._cleanup.bind(this));
        }

        _cleanup() {
            if (this.keyPressId) {
                global.stage.disconnect(this.keyPressId);
                this.keyPressId = 0;
            }
            if (this.hideTimeoutId) {
                GLib.source_remove(this.hideTimeoutId);
                this.hideTimeoutId = 0;
            }
        }

        _bindModePreviewAndClick(btn, modeName) {
            btn.connect('notify::hover', () => {
                this.syncModeStyles();
            });

            btn.connect('button-press-event', (actor, event) => {
                if (event.get_button() === 1) { 
                    this.stackManager.manager._log(`[StackManager] Stack mode explicitly clicked: ${modeName} for zone: ${this.zone}`);
                    if (!btn.reactive) return Clutter.EVENT_PROPAGATE;

                    let cs = this.stackManager.manager.storage.getCustomSections();
                    if (!cs[this.zone]) cs[this.zone] = {}; 
                    cs[this.zone].stackMode = modeName;
                    this.stackManager.manager.storage.setCustomSectionsAndSave(cs);
                    
                    this.lastActualMode = modeName;
                    this.syncModeStyles();
                    
                    if (this.lastActualMode === 'stack') {
                        this.prevBtn.show();
                        this.nextBtn.show();
                    } else {
                        this.prevBtn.hide();
                        this.nextBtn.hide();
                    }
                    
                    btn.set_style(this.btnStyle + 'background-color: #2ecc71; color: #111;');

                    for (let w of this.windows) {
                        w._omnipanel_last_req = '';
                    }

                    this.stackManager.applyStackLayout(this.zone, this.windows, this.monitor, modeName);
                    this.stackManager.invalidateSignature(this.zone);

                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                        if (btn) this.syncModeStyles();
                        return GLib.SOURCE_REMOVE;
                    });

                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
        }

        doPrev() {
            if (this.windows.length === 0) return;
            this.currentIndex = (this.currentIndex - 1 + this.windows.length) % this.windows.length;
            Main.activateWindow(this.windows[this.currentIndex]);
        }

        doNext() {
            if (this.windows.length === 0) return;
            this.currentIndex = (this.currentIndex + 1) % this.windows.length;
            Main.activateWindow(this.windows[this.currentIndex]);
        }

        syncModeStyles() {
            let actualMode = this.lastActualMode || 'stack';
            
            let applyStyle = (btn, modeName) => {
                btn.reactive = true;
                if (modeName === actualMode) {
                    btn.set_style(this.btnStyle + this.btnActiveStyle);
                } else {
                    btn.set_style(btn.hover ? this.btnStyle + this.btnHoverStyle : this.btnStyle);
                }
            };

            applyStyle(this.modeStackBtn, 'stack');
            applyStyle(this.modeColsBtn, 'columns');
            applyStyle(this.modeRowsBtn, 'rows');
            applyStyle(this.modeGridBtn, 'grid');
        }

        _onHoverChanged() {
            let isHovered = this.hover;
            
            if (isHovered) {
                if (this.hideTimeoutId) {
                    GLib.source_remove(this.hideTimeoutId);
                    this.hideTimeoutId = 0;
                }

                if (this.lastActualMode === 'stack') {
                    this.prevBtn.show();
                    this.nextBtn.show();
                } else {
                    this.prevBtn.hide();
                    this.nextBtn.hide();
                }
                
                this.toggleMenuBtn.hide();
                this.modeBox.show();

                this.syncModeStyles();
                this.set_style('background-color: rgba(20, 20, 20, 0.95); border: 1px solid #2ecc71; border-radius: 8px; padding: 4px; box-shadow: 0 4px 12px rgba(46, 204, 113, 0.3); transition-duration: 150ms;');
                
                if (!this.keyPressId) {
                    this.keyPressId = global.stage.connect('captured-event', (actor, event) => {
                        if (event.type() === Clutter.EventType.KEY_PRESS) {
                            let sym = event.get_key_symbol();
                            if (sym === Clutter.KEY_Left) {
                                this.doPrev();
                                return Clutter.EVENT_STOP;
                            } else if (sym === Clutter.KEY_Right) {
                                this.doNext();
                                return Clutter.EVENT_STOP;
                            }
                        }
                        return Clutter.EVENT_PROPAGATE;
                    });
                }

            } else {
                if (!this.hideTimeoutId) {
                    this.hideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                        this.hideTimeoutId = 0;
                        if (this.hover) return GLib.SOURCE_REMOVE;

                        this.prevBtn.hide();
                        this.nextBtn.hide();
                        
                        this.toggleMenuBtn.show();
                        this.modeBox.hide();
                        
                        this.set_style('background-color: rgba(20, 20, 20, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; transition-duration: 150ms;');
                        
                        if (this.keyPressId) {
                            global.stage.disconnect(this.keyPressId);
                            this.keyPressId = 0;
                        }

                        this.reposition();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }

            if (isHovered) {
                this.reposition();
            }
        }

        reposition() {
            let cs = this.stackManager.manager.storage.getCustomSections();
            let zRect = getSectionRect(this.monitor, this.zone, cs);
            if (zRect) {
                let padding = 16;
                let prefWidth = this.get_preferred_width(-1)[1];
                let prefHeight = this.get_preferred_height(-1)[1];
                let pos = this.stackManager.settings.get_string('stack-indicator-position') || 'bottom-right';
                let ox = pos === 'bottom-right' ? zRect.x + zRect.width - prefWidth - padding : zRect.x + padding;
                let oy = zRect.y + zRect.height - prefHeight - padding;
                this.set_position(ox, oy);
            }
        }
    }
);

// --- CONTROLLER LAYER (MVC) ---
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
            Main.layoutManager.removeChrome(overlay);
            overlay.destroy();
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

                Main.layoutManager.removeChrome(overlay);
                overlay.destroy();
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
                let newOverlay = new StackOverlayView(zone, actualMonitor, this);
                Main.layoutManager.addChrome(newOverlay);
                this._overlays.set(key, newOverlay);
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
            overlay.reposition();
            
            let isActiveStack = focusWindow && stackWindows.includes(focusWindow);
            if (isActiveStack) {
                if (!overlay.visible) overlay.show();
                overlay.currentIndex = stackWindows.indexOf(focusWindow);
            } else {
                if (overlay.visible) overlay.hide();
            }
        }
    }
}