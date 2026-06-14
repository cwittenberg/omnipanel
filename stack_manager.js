// omnipanel/stack_manager.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { getSectionRect, Sections, isWindowIgnored } from './layout_definitions.js';
import { applyWindowTransform } from './window_manager_adapter.js';
import { applyStackLayout, getViableStackModes } from './layout_algorithms.js';

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
            this._viableModes = { stack: true, grid: true, columns: true, rows: true };
            
            this._timeouts = new Set();
            this._hideTimeoutId = 0;
            this.keyPressId = 0;
            this.btnStyle = 'padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; background-color: transparent; transition-duration: 100ms; margin: 0 2px;';
            this.btnHoverStyle = 'background-color: rgba(255,255,255,0.2);';
            this.btnActiveStyle = 'background-color: rgba(46, 204, 113, 0.25); color: #2ecc71;';
            this._buildUI();
            this._bindEvents();
        }
        _addTimeout(delay, cb) {
            let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                this._timeouts.delete(id);
                return cb();
            });
            this._timeouts.add(id);
            return id;
        }
        _clearTimeout(id) {
            if (this._timeouts.has(id)) {
                GLib.source_remove(id);
                this._timeouts.delete(id);
            }
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
            this.connectObject('button-press-event', () => Clutter.EVENT_STOP, this);
            this.connectObject('button-release-event', () => Clutter.EVENT_STOP, this);
            this.connectObject('notify::hover', this._onHoverChanged.bind(this), this);
            
            this.modeBox.connectObject('button-press-event', () => Clutter.EVENT_STOP, this);
            this.modeBox.connectObject('button-release-event', () => Clutter.EVENT_STOP, this);
            
            this.prevBtn.connectObject('button-press-event', (actor, event) => {
                if (event.get_button() === 1) { this.doPrev(); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            }, this);
            
            this.nextBtn.connectObject('button-press-event', (actor, event) => {
                if (event.get_button() === 1) { this.doNext(); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            }, this);
            
            this.toggleMenuBtn.connectObject('button-press-event', (actor, event) => {
                if (event.get_button() === 1) {
                    this.toggleMenuBtn.hide();
                    this.modeBox.show();
                    this.syncModeStyles();
                    this.reposition();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }, this);
            
            let bindStandardHover = (btn) => {
                btn.connectObject('notify::hover', () => {
                    if (btn.reactive) btn.set_style(btn.hover ? this.btnStyle + this.btnHoverStyle : this.btnStyle);
                }, this);
            };
            
            bindStandardHover(this.prevBtn);
            bindStandardHover(this.nextBtn);
            bindStandardHover(this.toggleMenuBtn);
            this._bindModePreviewAndClick(this.modeStackBtn, 'stack');
            this._bindModePreviewAndClick(this.modeColsBtn, 'columns');
            this._bindModePreviewAndClick(this.modeRowsBtn, 'rows');
            this._bindModePreviewAndClick(this.modeGridBtn, 'grid');
            this.connectObject('destroy', this._cleanup.bind(this), this);
        }
        _cleanup() {
            if (this.keyPressId) {
                this.stackManager.manager.mediator.disconnectSignal(global.stage, this.keyPressId);
                this.keyPressId = 0;
            }
            for (let id of this._timeouts) {
                GLib.source_remove(id);
            }
            this._timeouts.clear();
        }
        _bindModePreviewAndClick(btn, modeName) {
            btn.connectObject('notify::hover', () => {
                this.syncModeStyles();
            }, this);
            
            btn.connectObject('button-press-event', (actor, event) => {
                if (event.get_button() === 1) { 
                    if (!this._viableModes[modeName]) {
                        this.stackManager.manager._log(`[StackManager] Mode ${modeName} clicked but is not currently physically viable.`);
                        return Clutter.EVENT_STOP;
                    }
                    this.stackManager.manager._log(`[StackManager] Stack mode explicitly clicked: ${modeName} for zone: ${this.zone}`);
                    
                    let cs = this.stackManager.manager.storage.getCustomSections();
                    if (!cs[this.zone]) cs[this.zone] = {}; 
                    cs[this.zone].stackMode = modeName;
                    this.stackManager.manager.storage.setCustomSectionsAndSave(cs);
                    
                    for (let w of this.windows) {
                        w._omnipanel_last_req = '';
                    }
                    this.lastActualMode = modeName;
                    this.syncModeStyles();
                    
                    if (this.lastActualMode === 'stack') {
                        this.prevBtn.show();
                        this.nextBtn.show();
                    } else {
                        this.prevBtn.hide();
                        this.nextBtn.hide();
                    }
                    
                    this.stackManager.invalidateSignature(this.zone);
                    this.stackManager.updateOverlays();
                    this._addTimeout(200, () => {
                        if (btn) this.syncModeStyles();
                        return GLib.SOURCE_REMOVE;
                    });
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }, this);
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
        updateViableModes(modes) {
            this._viableModes = modes;
            this.syncModeStyles();
        }
        syncModeStyles() {
            let actualMode = this.lastActualMode || 'stack';
            let viable = this._viableModes;
            
            let applyStyle = (btn, modeName, isViable) => {
                btn.reactive = isViable;
                
                if (!isViable) {
                    btn.set_style(this.btnStyle + 'opacity: 0.25; color: #666;');
                    return;
                }
                if (modeName === actualMode) {
                    btn.set_style(this.btnStyle + this.btnActiveStyle);
                } else {
                    btn.set_style(btn.hover ? this.btnStyle + this.btnHoverStyle : this.btnStyle);
                }
            };
            applyStyle(this.modeStackBtn, 'stack', viable.stack);
            applyStyle(this.modeColsBtn, 'columns', viable.columns);
            applyStyle(this.modeRowsBtn, 'rows', viable.rows);
            applyStyle(this.modeGridBtn, 'grid', viable.grid);
        }
        _onHoverChanged() {
            let isHovered = this.hover;
            
            if (isHovered) {
                if (this._hideTimeoutId) {
                    this._clearTimeout(this._hideTimeoutId);
                    this._hideTimeoutId = 0;
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
                this.reposition();
                
                this.set_style('background-color: rgba(20, 20, 20, 0.95); border: 1px solid #2ecc71; border-radius: 8px; padding: 4px; box-shadow: 0 4px 12px rgba(46, 204, 113, 0.3); transition-duration: 150ms;');
                
                if (!this.keyPressId) {
                    this.keyPressId = this.stackManager.manager.mediator.connectSignal(global.stage, 'captured-event', (actor, event) => {
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
                if (!this._hideTimeoutId) {
                    this._hideTimeoutId = this._addTimeout(250, () => {
                        this._hideTimeoutId = 0;
                        if (this.hover) return GLib.SOURCE_REMOVE;
                        this.prevBtn.hide();
                        this.nextBtn.hide();
                        
                        this.toggleMenuBtn.show();
                        this.modeBox.hide();
                        
                        this.set_style('background-color: rgba(20, 20, 20, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; transition-duration: 150ms;');
                        
                        if (this.keyPressId) {
                            this.stackManager.manager.mediator.disconnectSignal(global.stage, this.keyPressId);
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
            this.updateOverlays(); 
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
    _getStackZoneForWindow(win, customSections) {
        if (!win._omnipanel_zone || win._omnipanel_zone === 'maximized' || win._omnipanel_zone === 'Maximize') {
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
            if (isWindowIgnored(w, this.settings)) return false;
            if (!w._omnipanel_zone) return false;
            let actor = typeof w.get_compositor_private === 'function' ? w.get_compositor_private() : null;
            if (!actor || actor.is_destroyed()) return false;
            
            let wType = typeof w.get_window_type === 'function' ? w.get_window_type() : Meta.WindowType.NORMAL;
            let isSkipTaskbar = typeof w.is_skip_taskbar === 'function' ? w.is_skip_taskbar() : false;
            let role = typeof w.get_role === 'function' ? w.get_role() : '';
            let isDialog = (wType === Meta.WindowType.DIALOG || wType === Meta.WindowType.MODAL_DIALOG || wType === Meta.WindowType.UTILITY || isSkipTaskbar || role === 'pop-up' || w.get_transient_for() !== null);

            if (isDialog) return false;

            let isOverride = typeof w.is_override_redirect === 'function' ? w.is_override_redirect() : false;
            if (isOverride || wType !== Meta.WindowType.NORMAL) return false;
            
            let ws = typeof w.get_workspace === 'function' ? w.get_workspace() : null;
            let onAll = typeof w.is_on_all_workspaces === 'function' ? w.is_on_all_workspaces() : false;
            return ws === activeWs || onAll || !ws;
        });
        
        let focusWindow = global.display.get_focus_window();
        let customSections = this.manager.storage.getCustomSections();
        let stacks = {};
        
        for (let win of windows) {
            if (typeof win.get_id !== 'function') continue;
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
        }
        
        let currentStackKeys = new Set();
        for (let [key, stackData] of Object.entries(stacks)) {
            if (stackData.windows.length > 1) {
                currentStackKeys.add(key);
                
                stackData.windows.sort((a, b) => {
                    let aId = typeof a.get_id === 'function' ? a.get_id() : 0;
                    let bId = typeof b.get_id === 'function' ? b.get_id() : 0;
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
            let viableModes = getViableStackModes(stackWindows, zRect);
            let actualMode = evalMode;
            if (!viableModes[actualMode]) {
                this.manager._log(`[StackManager] Stack layout ${actualMode} is unviable due to bounds. Transforming ENTIRE STACK into on-top (stack) mode until windows are closed.`);
                actualMode = 'stack';
            }
            
            let zRectStr = zRect ? `${zRect.x},${zRect.y},${zRect.width},${zRect.height}` : '';
            let currentSignature = stackWindows.map(w => {
                return typeof w.get_id === 'function' ? w.get_id() : 0;
            }).join(',') + '|' + zRectStr + '|' + actualMode;
            
            if (overlay.lastSignature !== currentSignature) {
                overlay.lastSignature = currentSignature;
                overlay.windows = stackWindows;
                overlay.topWindow = topWindow;
                overlay.monitor = actualMonitor;
                overlay.countLabel.set_text(count.toString());
                
                overlay.lastActualMode = actualMode;
                overlay.updateViableModes(viableModes);
                
                applyStackLayout(stackWindows, actualMonitor, zRect, actualMode, this.manager._log.bind(this.manager));
            } else {
                overlay.topWindow = topWindow;
                overlay.updateViableModes(viableModes);
            }
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