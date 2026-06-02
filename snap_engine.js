// omnipanel/snap_engine.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { getSectionRect, hexToRgba, getLayoutColors, applyWindowTransform, isWindowIgnored } from './layout_definitions.js';

export class SnapEngine {
    constructor(manager) {
        this.manager = manager;
        this.settings = manager.settings;

        this._dragWindow = null;
        this._activeDragZones = [];
        this._dragLoopId = 0;
        this._currentSnapZone = null;
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

        this._dragLoopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            try {
                this.updateDrag();
            } catch { }
            return GLib.SOURCE_CONTINUE;
        });
    }

    updateDrag() {
        let [x, y] = global.get_pointer();
        this._currentSnapZone = null;

        for (let zone of this._activeDragZones) {
            let r = zone.rect;
            let isHovered = (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
            
            if (isHovered) {
                this._currentSnapZone = zone;
            }

            if (zone.isHovered !== isHovered) {
                zone.isHovered = isHovered;
                let borderCol = hexToRgba(zone.widget._baseColor, 1.0);

                let brRadius = zone.isMaximize ? '0 0 12px 12px' : '8px';
                let bTop = zone.isMaximize ? 'border-top: none;' : '';

                if (isHovered) {
                    zone.widget.set_style(`background-color: transparent; border: 4px solid ${borderCol}; ${bTop} border-radius: ${brRadius}; transition-duration: 250ms;`);
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

            try {
                targetWindow._omnipanel_zone = zone.name;
                targetWindow._omnipanel_monitor = zone.monitorIndex;
                
                this.manager._log(`[Snap] Dropped window onto zone [${zone.name}]`);

                // ENHANCED GTK4 WAYLAND DELAY:
                // Elevated to 250ms to ensure Wayland clients (especially GNOME Files) 
                // fully yield their grab locks to Mutter before we push programmatic resizes.
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                    try {
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
                    } catch (e) {
                        this.manager._log(`[Snap Error] Transform execution failed: ${e}`);
                    }
                    return GLib.SOURCE_REMOVE;
                });

            } catch {}
            
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this.manager.storage.saveCurrentLayoutStates();
                return GLib.SOURCE_REMOVE;
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
        try {
            if (!window || !window.get_display() || window.get_window_type() !== Meta.WindowType.NORMAL) return;
            if (isWindowIgnored(window, this.settings)) return;
        } catch { return; }

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
                
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                    this.manager.storage.saveCurrentLayoutStates();
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }

    snapDirection(dir) {
        let window = global.display.get_focus_window();
        try {
            if (!window || !window.get_display() || window.get_window_type() !== Meta.WindowType.NORMAL) return;
            if (isWindowIgnored(window, this.settings)) return;
        } catch { return; }

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
            
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this.manager.storage.saveCurrentLayoutStates();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    disable() {
        if (this._dragLoopId) {
            GLib.source_remove(this._dragLoopId);
            this._dragLoopId = 0;
        }

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