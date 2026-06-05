// omnipanel/tiling_manager.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { ZoneDesignerRoot } from './zone_designer.js';
import { LayoutStorage } from './layout_storage.js';
import { SnapEngine } from './snap_engine.js';
import { StackManager } from './stack_manager.js';
import { getSectionRect, fuzzyMatchAppToZone, Sections, calculateTitleSimilarity, isWindowValid, isWindowIgnored } from './layout_definitions.js';
import { applyWindowTransform } from './window_manager_adapter.js';
import { t } from './i18n.js';

const QuickTilerOverlay = GObject.registerClass(
    class QuickTilerOverlay extends St.Widget {
        _init(tilingManager) {
            super._init({
                name: 'QuickTilerOverlay',
                reactive: true,
                style: 'background-color: rgba(0, 0, 0, 0.5);'
            });
            this.manager = tilingManager;
            this.set_position(0, 0);
            this.set_size(global.stage.width, global.stage.height);

            this._targetWindow = global.display.get_focus_window();
            
            if (!this._targetWindow || this._targetWindow.get_window_type() !== Meta.WindowType.NORMAL) {
                let workspace = global.workspace_manager.get_active_workspace();
                let windows = global.display.get_tab_list(Meta.TabList.NORMAL, workspace);
                if (windows.length > 0) {
                    this._targetWindow = windows[0];
                } else {
                    this.destroy();
                    return;
                }
            }

            let [px, py] = global.get_pointer();
            let pointerRect = new Meta.Rectangle({ x: Math.round(px), y: Math.round(py), width: 1, height: 1 });
            this._monitorIndex = global.display.get_monitor_index_for_rect(pointerRect);
            this._monitor = Main.layoutManager.monitors[this._monitorIndex];
            
            let panelH = Main.panel.height;
            this._workX = this._monitor.x;
            this._workY = this._monitor.y + panelH;
            this._workW = this._monitor.width;
            this._workH = this._monitor.height - panelH;

            this._gridContainer = new St.Widget({
                reactive: true,
                style: 'background-color: rgba(20, 20, 20, 0.9); border: 2px solid #2ecc71; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.8);'
            });
            
            let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
            let gridW = 400 * scaleFactor;
            let gridH = 400 * scaleFactor;
            let padding = 16 * scaleFactor;
            let cellPadding = 4 * scaleFactor;
            let gridOffset = 8 * scaleFactor;

            this._gridContainer.set_size(gridW, gridH);
            this._gridContainer.set_position(
                this._monitor.x + (this._monitor.width - gridW)/2,
                this._monitor.y + (this._monitor.height - gridH)/2
            );
            
            this.add_child(this._gridContainer);

            this._cells = [];
            this._gridSize = 8;
            this._startIndex = -1;
            this._endIndex = -1;
            this._isDragging = false;

            let cellW = (gridW - padding) / this._gridSize;
            let cellH = (gridH - padding) / this._gridSize;

            for (let row = 0; row < this._gridSize; row++) {
                for (let col = 0; col < this._gridSize; col++) {
                    let cell = new St.Widget({
                        reactive: true,
                        style: 'background-color: rgba(255,255,255,0.1); border-radius: 4px; transition-duration: 100ms;'
                    });
                    cell.set_position(gridOffset + col * cellW, gridOffset + row * cellH);
                    cell.set_size(cellW - cellPadding, cellH - cellPadding);
                    
                    cell._gridRow = row;
                    cell._gridCol = col;
                    cell._index = row * this._gridSize + col;
                    
                    this._cells.push(cell);
                    this._gridContainer.add_child(cell);
                }
            }

            this._promptBox = new St.BoxLayout({
                vertical: false, visible: false, reactive: true,
                style: 'background-color: rgba(40,40,40,0.95); padding: 12px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.8); border: 1px solid #555;'
            });
            
            this._entry = new St.Entry({
                hint_text: t(this.manager.settings, 'Name this Zone (or leave blank to just resize)...'),
                style: 'min-width: 340px; padding: 8px; margin-right: 12px; border-radius: 6px;',
                can_focus: true, reactive: true
            });
            
            let saveBtn = new St.Button({ 
                label: t(this.manager.settings, 'Apply'), 
                style: 'background-color: #2ecc71; color: #111; font-weight: bold; padding: 6px 20px; border-radius: 6px;',
                reactive: true, can_focus: true, track_hover: true
            });
            
            saveBtn.connect('clicked', () => this._submitPrompt());
            this._entry.clutter_text.connect('activate', () => this._submitPrompt());
            
            this._promptBox.add_child(this._entry);
            this._promptBox.add_child(saveBtn);
            this.add_child(this._promptBox);

            this.connect('button-press-event', (actor, event) => {
                let [x, y] = event.get_coords();
                
                if (this._promptBox.visible) {
                    let pX = this._promptBox.x !== undefined ? this._promptBox.x : this._promptBox.get_x();
                    let pY = this._promptBox.y !== undefined ? this._promptBox.y : this._promptBox.get_y();
                    let pW = this._promptBox.width !== undefined ? this._promptBox.width : this._promptBox.get_width();
                    let pH = this._promptBox.height !== undefined ? this._promptBox.height : this._promptBox.get_height();
                    
                    if (x >= pX && x <= pX + pW && y >= pY && y <= pY + pH) {
                        return Clutter.EVENT_PROPAGATE; 
                    }
                }

                let cell = this._getCellAt(x, y);
                if (cell) {
                    this._isDragging = true;
                    this._startIndex = cell._index;
                    this._endIndex = cell._index;
                    this._updateHighlight();
                } else {
                    this.close(); 
                }
                return Clutter.EVENT_STOP;
            });

            this.connect('motion-event', (actor, event) => {
                if (!this._isDragging) return Clutter.EVENT_PROPAGATE;
                let [x, y] = event.get_coords();
                let cell = this._getCellAt(x, y);
                if (cell && cell._index !== this._endIndex) {
                    this._endIndex = cell._index;
                    this._updateHighlight();
                }
                return Clutter.EVENT_STOP;
            });

            this.connect('button-release-event', () => {
                if (this._isDragging) {
                    this._isDragging = false;
                    this._applyTiling();
                }
                return Clutter.EVENT_STOP;
            });

            Main.layoutManager.uiGroup.add_child(this);
            this._pushedModal = Main.pushModal(this);

            this._captureId = this.manager.mediator.connectSignal(global.stage, 'captured-event', (_, event) => {
                if (event.type() === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
                    this.close();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
        }

        _getCellAt(x, y) {
            let gX = this._gridContainer.x;
            let gY = this._gridContainer.y;
            let gW = this._gridContainer.width;
            let gH = this._gridContainer.height;
            if (x < gX || x > gX + gW || y < gY || y > gY + gH) return null;
            
            let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
            let padding = 16 * scaleFactor;
            let gridOffset = 8 * scaleFactor;

            let relX = x - gX - gridOffset;
            let relY = y - gY - gridOffset;
            let cellW = (gW - padding) / this._gridSize;
            let cellH = (gH - padding) / this._gridSize;
            
            let col = Math.floor(relX / cellW);
            let row = Math.floor(relY / cellH);
            
            col = Math.max(0, Math.min(col, this._gridSize - 1));
            row = Math.max(0, Math.min(row, this._gridSize - 1));
            
            return this._cells[row * this._gridSize + col];
        }

        _updateHighlight() {
            if (this._startIndex === -1 || this._endIndex === -1) return;
            let sr = Math.floor(this._startIndex / this._gridSize);
            let sc = this._startIndex % this._gridSize;
            let er = Math.floor(this._endIndex / this._gridSize);
            let ec = this._endIndex % this._gridSize;

            let minR = Math.min(sr, er), maxR = Math.max(sr, er);
            let minC = Math.min(sc, ec), maxC = Math.max(sc, ec);

            for (let cell of this._cells) {
                let isHighlighted = cell._gridRow >= minR && cell._gridRow <= maxR && cell._gridCol >= minC && cell._gridCol <= maxC;
                if (isHighlighted) {
                    cell.set_style('background-color: rgba(46, 204, 113, 0.7); border: 1px solid #2ecc71; border-radius: 4px; transition-duration: 50ms;');
                } else {
                    cell.set_style('background-color: rgba(255,255,255,0.1); border-radius: 4px; transition-duration: 100ms;');
                }
            }
        }

        _applyTiling() {
            if (this._startIndex === -1 || this._endIndex === -1) {
                this.close();
                return;
            }
            
            let sr = Math.floor(this._startIndex / this._gridSize);
            let sc = this._startIndex % this._gridSize;
            let er = Math.floor(this._endIndex / this._gridSize);
            let ec = this._endIndex % this._gridSize;

            let minR = Math.min(sr, er), maxR = Math.max(sr, er);
            let minC = Math.min(sc, ec), maxC = Math.max(sc, ec);

            let rx = minC / this._gridSize;
            let ry = minR / this._gridSize;
            let rw = (maxC - minC + 1) / this._gridSize;
            let rh = (maxR - minR + 1) / this._gridSize;

            this._targetRect = {
                x: Math.round(this._workX + (this._workW * rx)),
                y: Math.round(this._workY + (this._workH * ry)),
                width: Math.round(this._workW * rw),
                height: Math.round(this._workH * rh)
            };
            
            this._targetRx = rx;
            this._targetRy = ry;
            this._targetRw = rw;
            this._targetRh = rh;

            this._gridContainer.hide();
            
            if (this.manager.isDesignerActive) {
                let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
                let pW = 440 * scaleFactor; 
                let pH = 60 * scaleFactor;
                this._promptBox.set_position(
                    this._monitor.x + (this._monitor.width - pW) / 2,
                    this._monitor.y + (this._monitor.height - pH) / 2
                );
                this._promptBox.show();
                this._entry.grab_key_focus();
            } else {
                let unnamedKey = `__unnamed_${Date.now()}`;
                let cs = this.manager.storage.getCustomSections();
                cs[unnamedKey] = {
                    rx: rx, ry: ry, rw: rw, rh: rh,
                    monitorIndex: this._monitorIndex,
                    color: '#7f8c8d', 
                    isTemporary: true
                };
                this.manager.storage.setCustomSectionsAndSave(cs);

                this._targetWindow._omnipanel_zone = unnamedKey;
                this._targetWindow._omnipanel_monitor = this._monitorIndex;

                let targetRect = this._targetRect;
                let win = this._targetWindow;
                let mon = this._monitorIndex;
                let logger = this.manager._log.bind(this.manager);
                
                this.close(); 

                this.manager.mediator.addIdle(() => {
                    applyWindowTransform(win, mon, targetRect, false, logger);
                    return GLib.SOURCE_REMOVE;
                });

                this.manager.mediator.addTimer(500, () => {
                    this.manager.storage.saveCurrentLayoutStates();
                    return GLib.SOURCE_REMOVE;
                });
            }
        }

        _submitPrompt() {
            let name = this._entry.get_text().trim();
            
            if (name) {
                let cs = this.manager.storage.getCustomSections();
                cs[name] = {
                    rx: this._targetRx, ry: this._targetRy, rw: this._targetRw, rh: this._targetRh,
                    monitorIndex: this._monitorIndex,
                    color: '#3498db',
                    hotkeySlot: 0
                };
                this.manager.storage.setCustomSectionsAndSave(cs);
                this._targetWindow._omnipanel_zone = name;
                this._targetWindow._omnipanel_monitor = this._monitorIndex;
            } else {
                delete this._targetWindow._omnipanel_zone;
                delete this._targetWindow._omnipanel_monitor;
            }
            
            let targetRect = this._targetRect;
            let win = this._targetWindow;
            let mon = this._monitorIndex;
            let logger = this.manager._log.bind(this.manager);
            
            this.close(); 

            this.manager.mediator.addIdle(() => {
                applyWindowTransform(win, mon, targetRect, false, logger);
                return GLib.SOURCE_REMOVE;
            });

            this.manager.mediator.addTimer(500, () => {
                this.manager.storage.saveCurrentLayoutStates();
                return GLib.SOURCE_REMOVE;
            });
        }

        close() {
            if (this._captureId) {
                this.manager.mediator.disconnectSignal(global.stage, this._captureId);
                this._captureId = 0;
            }
            if (this._entry && this._entry.clutter_text) {
                this._entry.clutter_text.set_cursor_visible(false);
            }
            global.stage.set_key_focus(null);

            if (this._pushedModal) {
                try { Main.popModal(this); } catch { }
                this._pushedModal = false;
            }
            if (this.get_parent()) {
                Main.layoutManager.uiGroup.remove_child(this);
            }
            this.destroy();
        }
    }
);


class LifecycleMediator {
    constructor(logger) {
        this._signals = [];
        this._bindings = [];
        this._timers = new Set();
        this._logger = logger;
    }

    connectSignal(obj, signal, handler) {
        let id = obj.connect(signal, handler);
        this._signals.push({ obj, id });
        return id;
    }

    disconnectSignal(obj, id) {
        try { obj.disconnect(id); } catch {}
        this._signals = this._signals.filter(s => s.id !== id);
    }

    bindShortcut(name, settings, handler) {
        try { Main.wm.removeKeybinding(name); } catch {}
        Main.wm.addKeybinding(name, settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, Shell.ActionMode.NORMAL, handler);
        this._bindings.push(name);
    }

    addTimer(delayMs, handler) {
        let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            let res = handler();
            if (res === GLib.SOURCE_REMOVE) this._timers.delete(id);
            return res;
        });
        this._timers.add(id);
        return id;
    }

    addTimerSeconds(delaySec, handler) {
        let id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delaySec, () => {
            let res = handler();
            if (res === GLib.SOURCE_REMOVE) this._timers.delete(id);
            return res;
        });
        this._timers.add(id);
        return id;
    }

    addIdle(handler) {
        let id = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            let res = handler();
            if (res === GLib.SOURCE_REMOVE) this._timers.delete(id);
            return res;
        });
        this._timers.add(id);
        return id;
    }

    clearTimer(id) {
        if (this._timers.has(id)) {
            GLib.source_remove(id);
            this._timers.delete(id);
        }
    }

    destroy() {
        for (let {obj, id} of this._signals) {
            try { obj.disconnect(id); } catch {}
        }
        this._signals = [];

        for (let name of this._bindings) {
            try { Main.wm.removeKeybinding(name); } catch {}
        }
        this._bindings = [];

        for (let id of this._timers) {
            GLib.source_remove(id);
        }
        this._timers.clear();
    }
}

class WindowBootstrapper {
    constructor(window, mediator, settings, logger, placementCallback, tilingManager) {
        this.window = window;
        this.mediator = mediator;
        this.settings = settings;
        this.logger = logger;
        this.placementCallback = placementCallback;
        this.tilingManager = tilingManager;
        
        this.winId = 'unknown';
        try { this.winId = window.get_id ? window.get_id() : 'unknown'; } catch {}
        
        this.attempts = 0;
        this.maxAttempts = 15;
        this.timerId = 0;

        this._bootstrap();
    }

    _bootstrap() {
        let title = 'unknown', wmClass = 'unknown';
        try { title = this.window.get_title() || 'unknown'; wmClass = this.window.get_wm_class() || 'unknown'; } catch {}

        this.logger(`[${this.winId}] ------------------------------------------------`);
        this.logger(`[${this.winId}] 🪲 EXTREME DEBUG: NEW WINDOW DETECTED`);
        this.logger(`[${this.winId}] 🪲 APP: ${wmClass} | TITLE: ${title}`);

        try {
            let rect = this.window.get_frame_rect();
            this.logger(`[${this.winId}] 🪲 INITIAL COMPOSITOR SPAWN GEOMETRY: X:${rect.x} Y:${rect.y} W:${rect.width} H:${rect.height}`);
            if (rect.width < 100 || rect.height < 100) {
                this.logger(`[${this.winId}] 🚨 COMPOSITOR HEALER: Rescuing 0x0 window. Instantly applying safe float.`);
                this.mediator.addTimer(10, () => {
                    if (isWindowValid(this.window)) {
                        let m = Main.layoutManager.monitors[this.window.get_monitor() || 0] || Main.layoutManager.monitors[0];
                        if (this.window.get_maximized() > 0) {
                            this.window.unmaximize(Meta.MaximizeFlags.BOTH);
                        }
                        this.window.move_resize_frame(false, m.x + 100, m.y + 100, 800, 600);
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        } catch {}

        try {
            this.window._omnipanel_is_dead = false;

            if (this.window._omnipanel_unmanaged_id === undefined) {
                let sigId = this.mediator.connectSignal(this.window, 'unmanaged', () => {
                    this.window._omnipanel_is_dead = true;
                    if (this.timerId) {
                        this.mediator.clearTimer(this.timerId);
                        this.timerId = 0;
                    }
                    this.mediator.disconnectSignal(this.window, sigId);
                    if (this.tilingManager) this.tilingManager.queueAutoTiling(); 
                });
                this.window._omnipanel_unmanaged_id = sigId;
            }

            let isSkipTaskbar = typeof this.window.is_skip_taskbar === 'function' ? this.window.is_skip_taskbar() : false;
            let isSkipPager = typeof this.window.is_skip_pager === 'function' ? this.window.is_skip_pager() : false;

            if (this.window.is_override_redirect() || isSkipTaskbar || isSkipPager) {
                this.logger(`[${this.winId}] Ignoring override-redirect or skip-taskbar (browser tab) window.`);
                return;
            }

            let role = typeof this.window.get_role === 'function' ? this.window.get_role() : '';
            if (role === 'browser-tab' || role === 'pop-up') {
                this.logger(`[${this.winId}] Ignoring browser tab or popup.`);
                return;
            }

            let transient = this.window.get_transient_for();
            if (transient !== null) {
                this.logger(`[${this.winId}] Window is transient (dialog). Aborting entirely.`);
                return; 
            }

            let wType = this.window.get_window_type();
            if (wType !== Meta.WindowType.NORMAL) {
                this.logger(`[${this.winId}] Window is not NORMAL. Aborting entirely.`);
                return;
            }
        } catch {}

        this.logger(`[${this.winId}] >> Starting rapid DBus metadata polling (50ms intervals)...`);
        
        this.timerId = this.mediator.addTimer(50, this._pollMetadata.bind(this));
        
        try {
            this.mediator.connectSignal(this.window, 'size-changed', () => {});
        } catch {}
    }

    _pollMetadata() {
        if (this.window._omnipanel_is_dead || !isWindowValid(this.window)) {
            this.timerId = 0;
            this.logger(`[${this.winId}] Window died or actor destroyed before yield completed. Safely aborted.`);
            return GLib.SOURCE_REMOVE;
        }

        try {
            let isSkipTaskbarNow = typeof this.window.is_skip_taskbar === 'function' ? this.window.is_skip_taskbar() : false;
            let isSkipPagerNow = typeof this.window.is_skip_pager === 'function' ? this.window.is_skip_pager() : false;

            if (isSkipTaskbarNow || isSkipPagerNow) {
                this.logger(`[${this.winId}] Window became skip_taskbar during yield. Aborting.`);
                return GLib.SOURCE_REMOVE;
            }

            let finalWmClass = this.window.get_wm_class() || '';
            
            if (!finalWmClass && this.attempts < this.maxAttempts) {
                this.attempts++;
                return GLib.SOURCE_CONTINUE;
            }

            this.timerId = 0;

            if (!finalWmClass) {
                this.logger(`[${this.winId}] Window has no wm_class after max attempts. Aborting.`);
                return GLib.SOURCE_REMOVE;
            }
            
            this.logger(`[${this.winId}] Metadata retrieved safely on attempt ${this.attempts + 1}. Moving to execution phase.`);
            this.placementCallback(this.window, finalWmClass, this.window.get_title() || '', this.winId);
            
        } catch {
            this.timerId = 0;
            this.logger(`[${this.winId}] FATAL CATCH in Timer`);
        }

        return GLib.SOURCE_REMOVE;
    }
}


export default class TilingManager {
    constructor(settings) {
        this.settings = settings;
        this._enabled = false;
        this._activeOverlay = null;

        this.activeLayoutName = null;
        this.isDesignerActive = false;
        this._designerRoot = null;
        this._indicator = null;
        this._quickTiler = null;
        this._autoTilingTimerId = 0;

        this.storage = new LayoutStorage(this);
        this.snapEngine = new SnapEngine(this);
        this.stackManager = new StackManager(this);
        
        this.mediator = new LifecycleMediator(this._log.bind(this));
    }

    _log(msg) {
        if (!this.settings.get_boolean('enable-debug-logs')) return;
        let now = GLib.DateTime.new_now_local();
        let ms = now.get_microsecond().toString().padStart(6, '0').substring(0, 3);
        console.log(`[OmniPanel-Debug] [${now.format('%H:%M:%S')}.${ms}] ${msg}`);
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;
        this._log("Extension ENABLED. Registering listeners via Mediator.");

        this.settings.set_boolean('designer-active', false);
        
        this.mediator.connectSignal(this.settings, 'changed::designer-active', () => {
            let isActive = this.settings.get_boolean('designer-active');
            if (isActive && !this.isDesignerActive) {
                this.startZoneDesigner();
            } else if (!isActive && this.isDesignerActive) {
                this.stopZoneDesigner();
            }
        });

        this.mediator.connectSignal(this.settings, 'changed::named-layouts', () => {
            let layouts = {};
            try { layouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch {}
            if (this.activeLayoutName && !layouts[this.activeLayoutName]) {
                this._log(`Active layout [${this.activeLayoutName}] was deleted. Purging unmanaged zones.`);
                this.activeLayoutName = null;
                this.settings.set_string('custom-sections', '{}');
                this.stackManager.clearOverlays();
                if (this.isDesignerActive) {
                    this.settings.set_boolean('designer-active', false);
                }
            }
        });

        this.mediator.connectSignal(Main.layoutManager, 'monitors-changed', () => this.storage.onMonitorsChanged());
        this.mediator.connectSignal(global.display, 'window-created', (d, w) => {
            new WindowBootstrapper(w, this.mediator, this.settings, this._log.bind(this), this._executePlacement.bind(this), this);
        });
        this.mediator.connectSignal(global.workspace_manager, 'workspace-switched', () => this.queueAutoTiling());
        
        this.mediator.connectSignal(global.display, 'grab-op-begin', (d, w, o) => this.snapEngine.onGrabBegin(d, w, o));
        this.mediator.connectSignal(global.display, 'grab-op-end', (d, w, o) => this.snapEngine.onGrabEnd(d, w, o));
        
        this.mediator.bindShortcut('snap-left', this.settings, () => this.snapEngine.snapDirection('left'));
        this.mediator.bindShortcut('snap-right', this.settings, () => this.snapEngine.snapDirection('right'));
        this.mediator.bindShortcut('snap-up', this.settings, () => this.snapEngine.snapDirection('up'));
        this.mediator.bindShortcut('snap-down', this.settings, () => this.snapEngine.snapDirection('down'));
        this.mediator.bindShortcut('switch-layout', this.settings, () => this.cycleLayouts());
        this.mediator.bindShortcut('quick-tiler-hotkey', this.settings, () => this.showQuickTiler());

        for (let i = 1; i <= 9; i++) {
            this.mediator.bindShortcut(`layout-hotkey-${i}`, this.settings, () => this.activateLayoutBySlot(i));
        }

        let defaultLayout = this.settings.get_string('default-layout');
        if (defaultLayout) {
            this.mediator.addTimer(0, () => {
                this.storage.restoreNamedLayout(defaultLayout);
                return GLib.SOURCE_REMOVE;
            });
        }

        this.stackManager.enable();
        
        this.mediator.addTimerSeconds(5, () => {
            if (!this._enabled) return GLib.SOURCE_REMOVE;
            try { this.storage.saveCurrentLayoutStates(); } catch { }
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (!this._enabled) return;
        this._enabled = false;
        this._log("Extension DISABLED.");

        this.stackManager.disable();
        this.snapEngine.disable();

        this.mediator.destroy();

        if (this._quickTiler) {
            this._quickTiler.close();
            this._quickTiler = null;
        }

        if (this._activeOverlay) {
            try { Main.popModal(this._activeOverlay); } catch {}
            if (this._activeOverlay.get_parent()) {
                Main.layoutManager.uiGroup.remove_child(this._activeOverlay);
            }
            this._activeOverlay.destroy();
            this._activeOverlay = null;
        }

        this.stopZoneDesigner();
    }

    showQuickTiler() {
        if (!this._enabled) return;
        if (this._quickTiler) this._quickTiler.close();
        this._quickTiler = new QuickTilerOverlay(this);
    }

    queueAutoTiling() {
        if (!this.settings.get_boolean('auto-tiling-enabled')) return;
        if (this._autoTilingTimerId) {
            this.mediator.clearTimer(this._autoTilingTimerId);
        }
        this._autoTilingTimerId = this.mediator.addTimer(100, () => {
            this._autoTilingTimerId = 0;
            this.doAutoTiling();
            return GLib.SOURCE_REMOVE;
        });
    }

    doAutoTiling() {
        if (!this.settings.get_boolean('auto-tiling-enabled')) return;
        let mode = this.settings.get_string('auto-tiling-mode');
        let gap = this.settings.get_int('auto-tiling-gap');
        let workspace = global.workspace_manager.get_active_workspace();
        let allWindows = global.display.get_tab_list(Meta.TabList.NORMAL, workspace);

        let monitors = Main.layoutManager.monitors;
        for (let i = 0; i < monitors.length; i++) {
            let monWindows = allWindows.filter(w => {
                if (w.get_monitor() !== i) return false;
                if (isWindowIgnored(w, this.settings)) return false;
                let actor = w.get_compositor_private();
                if (!actor || actor.is_destroyed()) return false;
                if (w.is_override_redirect() || w.get_transient_for() !== null) return false;
                let isSkipTaskbar = typeof w.is_skip_taskbar === 'function' ? w.is_skip_taskbar() : false;
                if (isSkipTaskbar) return false;
                return true;
            });
            
            if (monWindows.length === 0) continue;

            monWindows.sort((a, b) => {
                let ida = 0, idb = 0;
                try { ida = a.get_id(); idb = b.get_id(); } catch {}
                return ida - idb;
            });

            let mon = monitors[i];
            let panelHeight = Main.panel.height;
            let wx = mon.x;
            let wy = mon.y + panelHeight;
            let ww = mon.width;
            let wh = mon.height - panelHeight;

            if (mode === 'bsp') {
                this._applyBSP(monWindows, wx, wy, ww, wh, gap, i);
            } else if (mode === 'cascade') {
                this._applyCascade(monWindows, wx, wy, ww, wh, i);
            }
        }
    }

    _applyBSP(windows, x, y, w, h, gap, monitorIndex) {
        if (windows.length === 0) return;
        if (windows.length === 1) {
            let rect = {
                x: Math.round(x + gap),
                y: Math.round(y + gap),
                width: Math.round(w - 2 * gap),
                height: Math.round(h - 2 * gap)
            };
            applyWindowTransform(windows[0], monitorIndex, rect, false, this._log.bind(this));
            return;
        }

        let splitVertical = w > h;
        let mid = Math.ceil(windows.length / 2);
        if (splitVertical) {
            let w1 = w / 2;
            this._applyBSP(windows.slice(0, mid), x, y, w1, h, gap, monitorIndex);
            this._applyBSP(windows.slice(mid), x + w1, y, w - w1, h, gap, monitorIndex);
        } else {
            let h1 = h / 2;
            this._applyBSP(windows.slice(0, mid), x, y, w, h1, gap, monitorIndex);
            this._applyBSP(windows.slice(mid), x, y + h1, w, h - h1, gap, monitorIndex);
        }
    }

    _applyCascade(windows, x, y, w, h, monitorIndex) {
        let offset = 40;
        let tw = w * 0.7;
        let th = h * 0.7;
        for (let i = 0; i < windows.length; i++) {
            let cx = x + ((i * offset) % Math.max(1, w - tw));
            let cy = y + ((i * offset) % Math.max(1, h - th));
            applyWindowTransform(windows[i], monitorIndex, {
                x: Math.round(cx), y: Math.round(cy), width: Math.round(tw), height: Math.round(th)
            }, false, this._log.bind(this));
            
            try { windows[i].raise(); } catch {}
        }
    }

    activateLayoutBySlot(slotId) {
        let layouts = {};
        try { layouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { return; }

        let targetName = Object.keys(layouts).find(k => layouts[k].hotkeySlot === slotId);
        if (targetName) {
            this.storage.restoreNamedLayout(targetName);
        }
    }

    cycleLayouts() {
        let layoutsStr = this.settings.get_string('named-layouts');
        let layouts = {};
        try { layouts = JSON.parse(layoutsStr); } catch { return; }

        let keys = Object.keys(layouts);
        if (keys.length === 0) return;
        
        let idx = keys.indexOf(this.activeLayoutName);
        let nextIdx = (idx + 1) % keys.length;
        
        this.storage.restoreNamedLayout(keys[nextIdx]);
    }

    getMonitorSignature() {
        let monitors = Main.layoutManager.monitors;
        let sigData = monitors.map(m => `${m.width}x${m.height}@${m.x},${m.y}`);
        let fuzzyData = monitors.length.toString();
        return { exact: sigData.join('|'), fuzzy: fuzzyData };
    }

    _showPromptOverlay(title, callback) {
        let m = Main.layoutManager.monitors[global.display.get_current_monitor()];
        
        let overlay = new St.Widget({
            reactive: true,
            style: 'background-color: rgba(0, 0, 0, 0.75);',
            x: 0, y: 0, width: global.stage.width, height: global.stage.height
        });

        let monitorContainer = new St.BoxLayout({
            vertical: true,
            x: m.x, y: m.y, width: m.width, height: m.height,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        let dialogBox = new St.BoxLayout({
            vertical: true,
            style: 'background-color: #242424; padding: 24px; border-radius: 12px; border: 1px solid #555; box-shadow: 0 8px 16px rgba(0,0,0,0.8);'
        });

        let label = new St.Label({ text: title, style: 'font-weight: bold; font-size: 18px; margin-bottom: 16px; color: white;' });
        let entry = new St.Entry({ style: 'min-width: 300px; padding: 10px; border-radius: 6px; margin-bottom: 24px;', can_focus: true, reactive: true });
        
        let btnBox = new St.BoxLayout({ vertical: false, style: 'spacing: 16px;' });
        let cancelBtn = new St.Button({ label: t(this.settings, 'Cancel'), style: 'background-color: #444; color: white; padding: 8px 24px; border-radius: 6px;', reactive: true, can_focus: true, track_hover: true });
        let saveBtn = new St.Button({ label: t(this.settings, 'Save'), style: 'background-color: #0078d4; color: white; padding: 8px 24px; border-radius: 6px; font-weight: bold;', reactive: true, can_focus: true, track_hover: true });

        btnBox.add_child(cancelBtn);
        btnBox.add_child(saveBtn);
        dialogBox.add_child(label);
        dialogBox.add_child(entry);
        dialogBox.add_child(btnBox);
        monitorContainer.add_child(dialogBox);
        overlay.add_child(monitorContainer);

        Main.layoutManager.uiGroup.add_child(overlay);
        this._activeOverlay = overlay;

        let pushedModal = Main.pushModal(overlay);
        entry.grab_key_focus();

        let isClosed = false;
        let closeOverlay = (runCallback, text) => {
            if (isClosed) return;
            isClosed = true;

            if (entry && entry.clutter_text) {
                entry.clutter_text.set_cursor_visible(false);
            }
            global.stage.set_key_focus(overlay);

            if (pushedModal) {
                try { Main.popModal(overlay); } catch { }
                pushedModal = false;
            }

            this.mediator.addIdle(() => {
                if (overlay.get_parent()) {
                    Main.layoutManager.uiGroup.remove_child(overlay);
                }
                overlay.destroy();
                this._activeOverlay = null;

                if (runCallback && callback) {
                    callback(text);
                }
                return GLib.SOURCE_REMOVE;
            });
        };

        cancelBtn.connect('clicked', () => closeOverlay(false, null));
        saveBtn.connect('clicked', () => closeOverlay(true, entry.get_text().trim()));
        entry.clutter_text.connect('activate', () => closeOverlay(true, entry.get_text().trim()));
        
        overlay.connect('button-press-event', () => Clutter.EVENT_STOP);
        overlay.connect('key-press-event', (_, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                closeOverlay(false, null);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    promptForLayoutName() {
        this._showPromptOverlay(t(this.settings, 'Enter a name for the current layout:'), (name) => {
            if (name) this.storage.saveNamedLayout(name);
        });
    }

    startZoneDesigner() {
        if (this.isDesignerActive) return;
        
        if (!this.activeLayoutName) {
            this._showPromptOverlay(t(this.settings, 'No active layout. Name this layout first:'), (name) => {
                if (name) {
                    this.storage.saveNamedLayout(name);
                    this.isDesignerActive = true;
                    this._designerRoot = new ZoneDesignerRoot(this);
                    this._designerRoot.open();
                } else {
                    this.settings.set_boolean('designer-active', false);
                }
            });
        } else {
            this.isDesignerActive = true;
            this._designerRoot = new ZoneDesignerRoot(this);
            this._designerRoot.open();
        }
    }

    stopZoneDesigner() {
        if (this._designerRoot) {
            this._designerRoot.close();
        }
    }

    onDesignerClosed(zonesModified) {
        this.isDesignerActive = false;
        this._designerRoot = null;
        this.settings.set_boolean('designer-active', false);

        if (zonesModified) {
            let customSections = this.storage.getCustomSections();
            let windows = global.display.list_all_windows();
            
            for (let win of windows) {
                try {
                    if (win._omnipanel_zone && customSections[win._omnipanel_zone]) {
                        let mIndex = win._omnipanel_monitor !== undefined ? win._omnipanel_monitor : 0;
                        if (customSections[win._omnipanel_zone].monitorIndex !== undefined) {
                            mIndex = customSections[win._omnipanel_zone].monitorIndex;
                        }

                        let rect = getSectionRect(mIndex, win._omnipanel_zone, customSections);
                        if (rect) {
                            this._log(`[Designer Sync] Repositioning window into [${win._omnipanel_zone}]`);
                            applyWindowTransform(win, mIndex, rect, false, this._log.bind(this));
                        }
                    }
                } catch {}
            }
            
            if (this.stackManager) {
                this.stackManager.invalidateSignature();
                this.stackManager.updateOverlays();
            }
        }
    }

    _executePlacement(window, wmClass, winTitle, winId) {
        this._log(`[${winId}] Starting Layout Evaluation. Class=${wmClass} Title=${winTitle}`);
        try {
            if (isWindowIgnored(window, this.settings)) {
                this._log(`[${winId}] Ignoring WM_CLASS/Title [${wmClass} / ${winTitle}] due to user ignore-list configuration.`);
                return;
            }

            if (this.settings.get_boolean('auto-tiling-enabled')) {
                this._log(`[${winId}] Auto-tiling is enabled. Triggering full workspace layout recalculation.`);
                this.queueAutoTiling();
                return;
            }

            let categories = '';
            try {
                let tracker = Shell.WindowTracker.get_default();
                let app = tracker.get_window_app(window);
                if (app && app.get_app_info()) {
                    categories = app.get_app_info().get_categories() || '';
                }
            } catch { }

            let savedData = null;

            if (this.activeLayoutName) {
                let allLayouts = {};
                try { allLayouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { }
                savedData = allLayouts[this.activeLayoutName];
            } else if (this.settings.get_boolean('auto-restore-layouts')) {
                let signatures = this.getMonitorSignature();
                let allLayouts = {};
                try { allLayouts = JSON.parse(this.settings.get_string('saved-tiling-layouts') || '{}'); } catch { }

                savedData = allLayouts[signatures.exact];
                if (!savedData && this.settings.get_boolean('fuzzy-restore-monitors')) {
                    let possibleSignatures = Object.keys(allLayouts);
                    let fuzzyMatch = possibleSignatures.find(sig => sig.split('|').length.toString() === signatures.fuzzy);
                    if (fuzzyMatch) savedData = allLayouts[fuzzyMatch];
                }
            }

            let liveZonesState = this.storage.getCustomSections();
            let windowsState = savedData ? (savedData.windows || savedData) : {};

            let layoutList = [];
            if (this.settings.get_boolean('remember-app-affinity')) {
                layoutList = windowsState[wmClass] ? (Array.isArray(windowsState[wmClass]) ? windowsState[wmClass] : [windowsState[wmClass]]) : [];
            }
            
            let layout = null;
            let bestScore = -1;
            
            if (layoutList.length > 0) {
                for (let l of layoutList) {
                    let score = calculateTitleSimilarity(winTitle, l.title);
                    if (score > bestScore) {
                        bestScore = score;
                        layout = l;
                    }
                }
            }

            let matchedZone = null;
            if (this.settings.get_boolean('enable-smart-placement')) {
                let appDictStr = this.settings.get_string('app-dictionary');
                let catMapStr = this.settings.get_string('category-map');
                
                let appDict = undefined;
                if (appDictStr && appDictStr.trim() !== '') {
                    try { appDict = JSON.parse(appDictStr); } catch {}
                }
                
                let catMap = undefined;
                if (catMapStr && catMapStr.trim() !== '') {
                    try { catMap = JSON.parse(catMapStr); } catch {}
                }

                let fuzzyData = fuzzyMatchAppToZone(wmClass, winTitle, categories, Object.keys(liveZonesState), appDict, catMap);
                if (fuzzyData) {
                    matchedZone = fuzzyData.zone;
                }
            }

            let targetRect = null;
            let targetMonitor = 0;
            let isMax = false;
            let targetZoneName = null;

            let hasExplicitSection = layout && layout.section && (liveZonesState[layout.section] || Object.values(Sections).includes(layout.section));

            if (hasExplicitSection) {
                targetZoneName = layout.section;
            } else if (matchedZone) {
                targetZoneName = matchedZone;
            }

            if (targetZoneName) {
                this._log(`[${winId}] MATCH FOUND: Zone [${targetZoneName}]`);
                targetMonitor = liveZonesState[targetZoneName] && liveZonesState[targetZoneName].monitorIndex !== undefined ? liveZonesState[targetZoneName].monitorIndex : (layout ? layout.monitor : 0);
                targetRect = getSectionRect(targetMonitor, targetZoneName, liveZonesState);
                isMax = (targetZoneName === 'maximized' || (hasExplicitSection && layout.section === 'maximized'));

                if (targetRect) {
                    window._omnipanel_zone = targetZoneName;
                    window._omnipanel_monitor = targetMonitor;
                    
                    this._log(`[${winId}] Target zone resolved. Triggering applyWindowTransform on monitor ${targetMonitor}`);
                    applyWindowTransform(window, targetMonitor, targetRect, isMax, this._log.bind(this));
                    
                    this.mediator.addTimer(200, () => {
                        if (this.stackManager) {
                            this.stackManager.invalidateSignature(targetZoneName);
                            try { this.stackManager.updateOverlays(); } catch {}
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                } else {
                     this._log(`[${winId}] ERROR: getSectionRect returned null for [${targetZoneName}]`);
                }
            } else {
                this._log(`[${winId}] NO MATCH: Ignoring window. Letting GNOME handle natively.`);
            }

        } catch {
            this._log(`[${winId}] FATAL CATCH in _executePlacement`);
        }
    }
}