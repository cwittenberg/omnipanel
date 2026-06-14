// omnipanel/snap_engine.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { getSectionRect, hexToRgba, getLayoutColors, isWindowIgnored } from './layout_definitions.js';
import { applyWindowTransform } from './window_manager_adapter.js';

export class SnapEngine {
    constructor(manager) {
        this.manager = manager;
        this.settings = manager.settings;

        this._dragWindow = null;
        this._activeDragZones = [];
        this._dragLoopId = 0;
        this._currentSnapZone = null;
        this._actionTimerIds = new Set();
    }

    _addTimer(delay, callback) {
        let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._actionTimerIds.delete(id);
            callback();
            return GLib.SOURCE_REMOVE;
        });
        this._actionTimerIds.add(id);
        return id;
    }

    _clearTimer(id) {
        if (this._actionTimerIds.has(id)) {
            GLib.source_remove(id);
            this._actionTimerIds.delete(id);
        }
    }

    _clearAllTimers() {
        for (let id of this._actionTimerIds) {
            GLib.source_remove(id);
        }
        this._actionTimerIds.clear();

        if (this._dragLoopId) {
            GLib.source_remove(this._dragLoopId);
            this._dragLoopId = 0;
        }
    }

    _startBreathing(widget) {
        widget._breathing = true;

        let pulseOut = () => {
            if (!widget._breathing) return;
            widget.ease({
                opacity: 100, 
                duration: 600,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
                onComplete: pulseIn
            });
        };

        let pulseIn = () => {
            if (!widget._breathing) return;
            widget.ease({
                opacity: 255, 
                duration: 600,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
                onComplete: pulseOut
            });
        };

        pulseOut();
    }

    _stopBreathing(widget) {
        widget._breathing = false;
        widget.remove_all_transitions();
        widget.set_opacity(255); 
    }

    onGrabBegin(display, window, op) {
        if (op !== Meta.GrabOp.MOVING || !this.settings.get_boolean('enable-tiling')) return;
        if (isWindowIgnored(window, this.settings)) return;
        
        this._dragWindow = window;
        this._activeDragZones = [];
        let customSections = this.manager.storage.getCustomSections();
        let colors = getLayoutColors(this.manager);

        for (const [name, cs] of Object.entries(customSections)) {
            let mIndex = cs.monitorIndex !== undefined ? cs.monitorIndex : 0;
            let rect = getSectionRect(mIndex, name, customSections);
            
            if (!rect) continue;

            let color = cs.color || colors.border;
            let borderCol = hexToRgba(color, 1.0);

            let zoneBox = new St.Widget({
                x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                style: `background-color: transparent; border: 2px dashed ${borderCol}; border-radius: 8px; transition-duration: 250ms;`,
                visible: true,
                reactive: false
            });

            let label = new St.Label({
                text: name,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'color: white; font-weight: bold; font-size: 24px; text-shadow: 0px 2px 4px rgba(0,0,0,0.8);'
            });

            let layout = new Clutter.BinLayout();
            zoneBox.set_layout_manager(layout);
            zoneBox.add_child(label);
            zoneBox._baseColor = color; 

            Main.layoutManager.uiGroup.add_child(zoneBox);

            this._activeDragZones.push({ 
                name: name, 
                rect: rect, 
                widget: zoneBox, 
                monitorIndex: mIndex, 
                isMaximize: false,
                isHovered: false 
            });
        }

        let monitors = Main.layoutManager.monitors;
        for (let i = 0; i < monitors.length; i++) {
            let m = monitors[i];
            let panelHeight = Main.panel.height;
            let w = 250;
            let h = 48;

            let rect = {
                x: m.x + (m.width / 2) - (w / 2),
                y: m.y + panelHeight,
                width: w,
                height: h
            };

            let color = '#3498db'; 
            let borderCol = hexToRgba(color, 1.0);

            let zoneBox = new St.Widget({
                x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                style: `background-color: transparent; border: 2px dashed ${borderCol}; border-top: none; border-radius: 0 0 12px 12px; transition-duration: 250ms;`,
                visible: true,
                reactive: false
            });

            let label = new St.Label({
                text: '  Maximize',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${color}; font-weight: bold; font-size: 16px; text-shadow: 0px 2px 4px rgba(0,0,0,0.8);`
            });

            let layout = new Clutter.BinLayout();
            zoneBox.set_layout_manager(layout);
            zoneBox.add_child(label);
            zoneBox._baseColor = color; 

            Main.layoutManager.uiGroup.add_child(zoneBox);

            this._activeDragZones.push({ 
                name: 'Maximize', 
                rect: rect, 
                widget: zoneBox, 
                monitorIndex: i, 
                isMaximize: true,
                isHovered: false 
            });
        }

        if (this._dragLoopId) {
            GLib.source_remove(this._dragLoopId);
        }
        this._dragLoopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this.updateDrag();
            return GLib.SOURCE_CONTINUE;
        });
    }

    updateDrag() {
        let pointer = global.get_pointer();
        let x = pointer[0];
        let y = pointer[1];
        let mods = pointer[2] || 0;
        
        let isAltPressed = (mods & (Clutter.ModifierType.MOD1_MASK | Clutter.ModifierType.MOD5_MASK)) !== 0;

        this._currentSnapZone = null;

        for (let zone of this._activeDragZones) {
            if (isAltPressed) {
                if (zone.widget.visible) zone.widget.hide();
            } else {
                if (!zone.widget.visible) zone.widget.show();
            }

            let r = zone.rect;
            let isHovered = !isAltPressed && (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
            
            if (isHovered) {
                this._currentSnapZone = zone;
            }

            if (zone.isHovered !== isHovered) {
                zone.isHovered = isHovered;
                let borderCol = hexToRgba(zone.widget._baseColor, 1.0);
                let fillCol = hexToRgba(zone.widget._baseColor, 0.2);

                let brRadius = zone.isMaximize ? '0 0 12px 12px' : '8px';
                let bTop = zone.isMaximize ? 'border-top: none;' : '';

                if (isHovered) {
                    zone.widget.set_style(`background-color: ${fillCol}; border: 4px solid ${borderCol}; ${bTop} border-radius: ${brRadius}; transition-duration: 250ms;`);
                    this._startBreathing(zone.widget);
                } else {
                    this._stopBreathing(zone.widget);
                    zone.widget.set_style(`background-color: transparent; border: 2px dashed ${borderCol}; ${bTop} border-radius: ${brRadius}; transition-duration: 250ms;`);
                }
            }
        }
    }

    onGrabEnd(display, window, op) {
        if (op !== Meta.GrabOp.MOVING || !this._dragWindow) return;
        
        if (this._dragLoopId) {
            GLib.source_remove(this._dragLoopId);
            this._dragLoopId = 0;
        }

        for (let zone of this._activeDragZones) {
            this._stopBreathing(zone.widget);
            Main.layoutManager.uiGroup.remove_child(zone.widget);
            zone.widget.destroy();
        }
        this._activeDragZones = [];

        if (this._currentSnapZone) {
            let zone = this._currentSnapZone;
            let targetWindow = this._dragWindow;

            targetWindow._omnipanel_zone = zone.name;
            targetWindow._omnipanel_monitor = zone.monitorIndex;
            
            this.manager._log(`[Snap] Dropped window onto zone [${zone.name}]`);

            if (this._grabTransformTimer) this._clearTimer(this._grabTransformTimer);
            this._grabTransformTimer = this._addTimer(250, () => {
                let customSections = this.manager.storage.getCustomSections();
                let updatedRect = getSectionRect(zone.monitorIndex, zone.name, customSections) || zone.rect;

                if (zone.isMaximize) {
                    let fullRect = getSectionRect(zone.monitorIndex, 'maximized');
                    applyWindowTransform(targetWindow, zone.monitorIndex, fullRect, true, this.manager._log.bind(this.manager));
                } else {
                    applyWindowTransform(targetWindow, zone.monitorIndex, updatedRect, false, this.manager._log.bind(this.manager));
                }

                if (this.manager.stackManager) {
                    this.manager.stackManager.invalidateSignature();
                }
            });
            
            if (this._grabSaveTimer) this._clearTimer(this._grabSaveTimer);
            this._grabSaveTimer = this._addTimer(500, () => {
                this.manager.storage.saveCurrentLayoutStates();
            });

        } else {
            delete this._dragWindow._omnipanel_zone;
            delete this._dragWindow._omnipanel_monitor;
        }
        
        this._dragWindow = null;
        this._currentSnapZone = null;
    }

    snapToZoneSlot(slotId) {
        let window = global.display.get_focus_window();
        
        if (!window || !window.get_display()) return;
        if (typeof window.get_window_type !== 'function') return;
        
        let wType = window.get_window_type();
        if (wType !== Meta.WindowType.NORMAL && wType !== Meta.WindowType.DIALOG && wType !== Meta.WindowType.MODAL_DIALOG) return;
        if (isWindowIgnored(window, this.settings)) return;

        let customSections = this.manager.storage.getCustomSections();
        let targetZoneName = Object.keys(customSections).find(k => customSections[k].hotkeySlot === slotId);

        if (targetZoneName) {
            let cs = customSections[targetZoneName];
            let mIndex = cs.monitorIndex !== undefined ? cs.monitorIndex : 0;
            let zRect = getSectionRect(mIndex, targetZoneName, customSections);

            if (zRect) {
                window._omnipanel_zone = targetZoneName;
                window._omnipanel_monitor = mIndex;
                
                this.manager._log(`[Snap] Hotkey snapped window to zone [${targetZoneName}]`);
                applyWindowTransform(window, mIndex, zRect, false, this.manager._log.bind(this.manager));
                if (this.manager.stackManager) this.manager.stackManager.invalidateSignature();
                
                if (this._slotSaveTimer) this._clearTimer(this._slotSaveTimer);
                this._slotSaveTimer = this._addTimer(500, () => {
                    this.manager.storage.saveCurrentLayoutStates();
                });
            }
        }
    }

    snapDirection(dir) {
        let window = global.display.get_focus_window();
        
        if (!window || !window.get_display()) return;
        if (typeof window.get_window_type !== 'function') return;
        
        let wType = window.get_window_type();
        if (wType !== Meta.WindowType.NORMAL && wType !== Meta.WindowType.DIALOG && wType !== Meta.WindowType.MODAL_DIALOG) return;
        if (isWindowIgnored(window, this.settings)) return;

        let rect = window.get_frame_rect();
        let cx = rect.x + rect.width / 2;
        let cy = rect.y + rect.height / 2;

        let customSections = this.manager.storage.getCustomSections();

        let bestZone = null;
        let bestZoneName = null;
        let bestMonitorIndex = null;
        let minDist = Infinity;

        for (const [name, cs] of Object.entries(customSections)) {
            let mIndex = cs.monitorIndex !== undefined ? cs.monitorIndex : 0;
            let zRect = getSectionRect(mIndex, name, customSections);
            if (!zRect) continue;

            let zx = zRect.x + zRect.width / 2;
            let zy = zRect.y + zRect.height / 2;

            let dx = zx - cx;
            let dy = zy - cy;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let valid = false;
            
            if (dir === 'left' && dx < -10 && Math.abs(dy) <= Math.abs(dx)) valid = true;
            if (dir === 'right' && dx > 10 && Math.abs(dy) <= Math.abs(dx)) valid = true;
            if (dir === 'up' && dy < -10 && Math.abs(dx) <= Math.abs(dy)) valid = true;
            if (dir === 'down' && dy > 10 && Math.abs(dx) <= Math.abs(dy)) valid = true;

            if (!valid) {
                 if (dir === 'left' && dx < -10) valid = true;
                 if (dir === 'right' && dx > 10) valid = true;
                 if (dir === 'up' && dy < -10) valid = true;
                 if (dir === 'down' && dy > 10) valid = true;
            }

            if (valid && dist < minDist) {
                minDist = dist;
                bestZone = zRect;
                bestZoneName = name;
                bestMonitorIndex = mIndex;
            }
        }

        if (bestZone && bestZoneName) {
            window._omnipanel_zone = bestZoneName;
            window._omnipanel_monitor = bestMonitorIndex;
            
            this.manager._log(`[Snap] Directional snap (${dir}) applied window to zone [${bestZoneName}]`);
            applyWindowTransform(window, bestMonitorIndex, bestZone, false, this.manager._log.bind(this.manager));
            if (this.manager.stackManager) this.manager.stackManager.invalidateSignature();
            
            if (this._dirSaveTimer) this._clearTimer(this._dirSaveTimer);
            this._dirSaveTimer = this._addTimer(500, () => {
                this.manager.storage.saveCurrentLayoutStates();
            });
        }
    }

    disable() {
        this._clearAllTimers();

        for (let zone of this._activeDragZones) {
            this._stopBreathing(zone.widget);
            if (zone.widget.get_parent()) {
                Main.layoutManager.uiGroup.remove_child(zone.widget);
            }
            zone.widget.destroy();
        }

        this._activeDragZones = [];
        this._dragWindow = null;
        this._currentSnapZone = null;
    }
}