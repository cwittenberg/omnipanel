// omnipanel/zone_designer.js
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { hexToRgba, getLayoutColors } from './layout_definitions.js';

export const ZoneDesignerRoot = GObject.registerClass(
    class ZoneDesignerRoot extends St.Widget {
        _init(manager) {
            super._init({
                name: 'ZoneDesignerOverlay',
                reactive: true,
                style: 'background-color: rgba(0, 0, 0, 0.6);'
            });
            
            this._manager = manager;
            this._monitors = Main.layoutManager.monitors;
            this._dragAction = null; 
            this._activeZoneName = null;
            this._zoneWidgets = {};
            this._zonesModified = false;
            this._currentDrawMonitorIndex = -1;
            this._isClosed = false;
            this._pushedModal = false;
            this._captureId = 0;
            
            this.set_position(0, 0);
            this.set_size(global.stage.width, global.stage.height);
            
            this._zonesContainer = new St.Widget();
            this._zonesContainer.set_position(0, 0);
            this._zonesContainer.set_size(global.stage.width, global.stage.height);
            this.add_child(this._zonesContainer);

            let colors = getLayoutColors(manager);
            this._selection = new St.Widget({
                style: `background-color: transparent; border: 2px solid ${colors.border};`,
                visible: false
            });
            this.add_child(this._selection);

            this._warningLabel = new St.Label({
                text: 'Minimum size enforced: 200x150',
                style: 'color: #ff7979; font-weight: bold; font-size: 14px; background-color: rgba(0,0,0,0.85); padding: 6px 12px; border-radius: 6px; border: 1px solid #ff7979; box-shadow: 0 2px 4px rgba(0,0,0,0.5);',
                visible: false
            });
            this.add_child(this._warningLabel);

            this._promptBox = new St.BoxLayout({ 
                vertical: false, 
                visible: false, 
                reactive: true,
                style: 'background-color: #242424; padding: 8px; border-radius: 8px; border: 1px solid #555; box-shadow: 0 4px 8px rgba(0,0,0,0.5);' 
            });
            this._entry = new St.Entry({ hint_text: 'Name this Zone...', style: 'min-width: 180px; margin-right: 8px;', can_focus: true, reactive: true });
            this._saveBtn = new St.Button({ label: 'Save', style: 'background-color: #0078d4; color: white; border-radius: 4px; padding: 4px 16px; font-weight: bold;', reactive: true, track_hover: true, can_focus: true });
            
            let saveAction = () => {
                let name = this._entry.get_text().trim();
                if (name && this._lastRect && this._currentDrawMonitorIndex >= 0) {
                    this._manager.storage.saveCustomZoneRect(name, this._lastRect, this._currentDrawMonitorIndex);
                    this._zonesModified = true;
                    this._hidePromptSafe();
                    this._refreshZones(); 
                }
            };
            this._saveBtn.connect('clicked', saveAction);
            this._entry.clutter_text.connect('activate', saveAction);
            
            this._promptBox.add_child(this._entry);
            this._promptBox.add_child(this._saveBtn);
            this.add_child(this._promptBox);

            this._monitors.forEach((m, i) => {
                let toolbar = new St.BoxLayout({
                    vertical: false,
                    style: 'background-color: rgba(30, 30, 30, 0.95); padding: 0px 16px; border-bottom: 2px solid #444;',
                    reactive: true
                });
                
                toolbar.set_position(m.x, m.y);
                toolbar.set_size(m.width, 70);
                
                let titleLabel = new St.Label({
                    text: `Zone Designer Mode  |  Monitor ${i + 1}  |  Active Layout: ${manager.activeLayoutName || 'None'}  |  Draw, Move, or Resize zones`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'font-weight: bold; font-size: 16px; color: white;'
                });
                
                let spacer = new St.Widget({ x_expand: true, y_expand: true });
                
                let quitBtn = new St.Button({
                    label: 'Quit Designer',
                    style_class: 'button',
                    style: 'background-color: #c01c28; color: white; border-radius: 6px; padding: 8px 16px; font-weight: bold; margin: 0px;',
                    y_align: Clutter.ActorAlign.CENTER,
                    x_align: Clutter.ActorAlign.CENTER,
                    reactive: true,
                    can_focus: true,
                    track_hover: true
                });
                quitBtn.connect('clicked', () => this.close());
                
                toolbar.add_child(titleLabel);
                toolbar.add_child(spacer);
                toolbar.add_child(quitBtn);
                
                this.add_child(toolbar);
            });

            this.connect('button-press-event', (_, event) => {
                let [x, y] = event.get_coords();
                
                if (this._promptBox.visible && 
                    x >= this._promptBox.x && x <= this._promptBox.x + this._promptBox.width &&
                    y >= this._promptBox.y && y <= this._promptBox.y + this._promptBox.height) {
                    return Clutter.EVENT_PROPAGATE; 
                }
                
                this._currentDrawMonitorIndex = this._monitors.findIndex(m => 
                    x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height
                );
                
                if (this._currentDrawMonitorIndex === -1) return Clutter.EVENT_PROPAGATE;
                
                let m = this._monitors[this._currentDrawMonitorIndex];
                
                if (y <= m.y + 70) return Clutter.EVENT_PROPAGATE; 

                if (this._promptBox.visible) {
                    this._hidePromptSafe();
                }

                this._startX = x;
                this._startY = y;
                this._dragAction = 'draw';
                
                this._selection.set_position(x, y);
                this._selection.set_size(0, 0);
                this._selection.show();
                
                return Clutter.EVENT_STOP;
            });

            this.connect('motion-event', (_, event) => {
                if (!this._dragAction || this._currentDrawMonitorIndex === -1) return Clutter.EVENT_PROPAGATE;
                let [x, y] = event.get_coords();
                let m = this._monitors[this._currentDrawMonitorIndex];
                let showWarning = false;
                
                if (this._dragAction === 'draw') {
                    let rawW = Math.abs(x - this._startX);
                    let rawH = Math.abs(y - this._startY);
                    
                    if (rawW < 200 || rawH < 150) {
                        showWarning = true;
                    }
                    
                    // Relaxed design constraint to match stack subdivisions
                    let rectW = Math.max(200, rawW);
                    let rectH = Math.max(150, rawH);
                    
                    let rectX = x < this._startX ? this._startX - rectW : this._startX;
                    let rectY = y < this._startY ? this._startY - rectH : this._startY;
                    
                    rectX = Math.max(m.x, Math.min(rectX, m.x + m.width - rectW));
                    rectY = Math.max(m.y + 70, Math.min(rectY, m.y + m.height - rectH));

                    this._selection.set_position(rectX, rectY);
                    this._selection.set_size(rectW, rectH);
                } 
                else if (this._dragAction === 'move' && this._activeZoneName) {
                    let zoneBox = this._zoneWidgets[this._activeZoneName];
                    if (zoneBox) {
                        let newX = x - this._dragOffsetX;
                        let newY = y - this._dragOffsetY;
                        
                        let bxWidth = zoneBox.width !== undefined ? zoneBox.width : zoneBox.get_width();
                        let bxHeight = zoneBox.height !== undefined ? zoneBox.height : zoneBox.get_height();
                        
                        newX = Math.max(0, Math.min(newX, global.stage.width - bxWidth));
                        newY = Math.max(0, Math.min(newY, global.stage.height - bxHeight));
                        
                        zoneBox.set_position(newX, newY);
                    }
                } 
                else if (this._dragAction === 'resize' && this._activeZoneName) {
                    let zoneBox = this._zoneWidgets[this._activeZoneName];
                    if (zoneBox) {
                        let bxX = zoneBox.x !== undefined ? zoneBox.x : zoneBox.get_x();
                        let bxY = zoneBox.y !== undefined ? zoneBox.y : zoneBox.get_y();
                        
                        let rawW = x - bxX;
                        let rawH = y - bxY;
                        
                        if (rawW < 200 || rawH < 150) {
                            showWarning = true;
                        }
                        
                        let newW = Math.max(200, rawW);
                        let newH = Math.max(150, rawH);
                        
                        newW = Math.min(newW, m.x + m.width - bxX);
                        newH = Math.min(newH, m.y + m.height - bxY);
                        
                        zoneBox.set_size(newW, newH);
                    }
                }

                if (showWarning) {
                    this._warningLabel.set_position(x + 15, y + 15);
                    if (!this._warningLabel.visible) this._warningLabel.show();
                } else {
                    if (this._warningLabel.visible) this._warningLabel.hide();
                }
                
                return Clutter.EVENT_STOP;
            });

            this.connect('button-release-event', () => {
                if (!this._dragAction) return Clutter.EVENT_PROPAGATE;
                
                if (this._warningLabel && this._warningLabel.visible) {
                    this._warningLabel.hide();
                }
                
                if (this._dragAction === 'draw') {
                    let sW = this._selection.width !== undefined ? this._selection.width : this._selection.get_width();
                    let sH = this._selection.height !== undefined ? this._selection.height : this._selection.get_height();
                    let sX = this._selection.x !== undefined ? this._selection.x : this._selection.get_x();
                    let sY = this._selection.y !== undefined ? this._selection.y : this._selection.get_y();

                    let m = this._monitors[this._currentDrawMonitorIndex];
                    let panelH = Main.panel.height;
                    
                    sW = Math.max(200, sW);
                    sH = Math.max(150, sH);

                    if (sX + sW > m.x + m.width) sX = m.x + m.width - sW;
                    if (sY + sH > m.y + m.height) sY = m.y + m.height - sH;

                    // EDGE SNAPPING (Maximally leverage the zone size)
                    if (Math.abs(sX - m.x) < 30) {
                        sW += (sX - m.x);
                        sX = m.x;
                    }
                    if (Math.abs(sY - (m.y + panelH)) < 30) {
                        sH += (sY - (m.y + panelH));
                        sY = m.y + panelH;
                    }
                    if (Math.abs((sX + sW) - (m.x + m.width)) < 30) {
                        sW = (m.x + m.width) - sX;
                    }
                    if (Math.abs((sY + sH) - (m.y + m.height)) < 30) {
                        sH = (m.y + m.height) - sY;
                    }
                    
                    this._selection.set_position(sX, sY);
                    this._selection.set_size(sW, sH);

                    this._lastRect = {
                        x: sX,
                        y: sY,
                        width: sW,
                        height: sH
                    };

                    let px = sX;
                    let py = sY + sH + 10;
                    
                    if (py + 60 > m.y + m.height) py = sY - 60; 
                    if (px + 280 > m.x + m.width) px = m.x + m.width - 280; 

                    this._entry.set_text('');
                    this._promptBox.set_position(px, py);
                    this._promptBox.show();
                    this._entry.grab_key_focus();
                } 
                else if ((this._dragAction === 'move' || this._dragAction === 'resize') && this._activeZoneName) {
                    let zoneBox = this._zoneWidgets[this._activeZoneName];
                    if (zoneBox) {
                        let targetMonitorIndex = this._currentDrawMonitorIndex;
                        let bxX = zoneBox.x !== undefined ? zoneBox.x : zoneBox.get_x();
                        let bxY = zoneBox.y !== undefined ? zoneBox.y : zoneBox.get_y();
                        let bxW = zoneBox.width !== undefined ? zoneBox.width : zoneBox.get_width();
                        let bxH = zoneBox.height !== undefined ? zoneBox.height : zoneBox.get_height();
                        
                        if (this._dragAction === 'move') {
                            let cx = bxX + bxW / 2;
                            let cy = bxY + bxH / 2;
                            
                            let foundIndex = this._monitors.findIndex(mon => 
                                cx >= mon.x && cx < mon.x + mon.width && cy >= mon.y && cy < mon.y + mon.height
                            );
                            
                            if (foundIndex !== -1) {
                                targetMonitorIndex = foundIndex;
                            }
                        }

                        let m = this._monitors[targetMonitorIndex];
                        let panelH = Main.panel.height;

                        // EDGE SNAPPING (Maximally leverage the zone size on move/resize)
                        if (Math.abs(bxX - m.x) < 30) {
                            bxW += (bxX - m.x);
                            bxX = m.x;
                        }
                        if (Math.abs(bxY - (m.y + panelH)) < 30) {
                            bxH += (bxY - (m.y + panelH));
                            bxY = m.y + panelH;
                        }
                        if (Math.abs((bxX + bxW) - (m.x + m.width)) < 30) {
                            bxW = (m.x + m.width) - bxX;
                        }
                        if (Math.abs((bxY + bxH) - (m.y + m.height)) < 30) {
                            bxH = (m.y + m.height) - bxY;
                        }

                        this._manager.storage.saveCustomZoneRect(
                            this._activeZoneName,
                            { x: bxX, y: bxY, width: bxW, height: bxH },
                            targetMonitorIndex
                        );
                        this._zonesModified = true;
                        this._refreshZones(); 
                    }
                }

                this._dragAction = null;
                this._activeZoneName = null;
                return Clutter.EVENT_STOP;
            });

            this._refreshZones();
        }

        _hidePromptSafe() {
            if (this._entry && this._entry.clutter_text) {
                this._entry.clutter_text.set_cursor_visible(false);
            }
            global.stage.set_key_focus(this);
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this._promptBox) {
                    this._promptBox.hide();
                    this._selection.hide();
                    this._entry.set_text('');
                }
                return GLib.SOURCE_REMOVE;
            });
        }
        
        _refreshZones() {
            global.stage.set_key_focus(this);
            
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (!this._zonesContainer) return GLib.SOURCE_REMOVE;
                this._zonesContainer.destroy_all_children();
                this._zoneWidgets = {};
                
                let customSections = this._manager.storage.getCustomSections();

                for (const [name, cs] of Object.entries(customSections)) {
                    let mIndex = cs.monitorIndex !== undefined ? cs.monitorIndex : 0;
                    let mCount = Main.layoutManager.monitors.length;
                    let safeIndex = Math.max(0, Math.min(mIndex, mCount - 1));
                    let monitor = this._monitors[safeIndex];
                    
                    if (!monitor) continue; 

                    let panelHeight = Main.panel.height;
                    let workAreaHeight = monitor.height - panelHeight;

                    // Ensure safe math reads to prevent Wayland corruption locally
                    let crx = Number(cs.rx) || 0;
                    let cry = Number(cs.ry) || 0;
                    let crw = Number(cs.rw) || 0.2;
                    let crh = Number(cs.rh) || 0.2;

                    let rx = monitor.x + Math.round(monitor.width * crx);
                    let ry = monitor.y + panelHeight + Math.round(workAreaHeight * cry);
                    
                    let rw = Math.max(200, Math.round(monitor.width * crw));
                    let rh = Math.max(150, Math.round(workAreaHeight * crh));
                    
                    let color = cs.color || '#2ecc71';
                    let borderCol = hexToRgba(color, 1.0);

                    let zoneBox = new St.Widget({
                        reactive: true,
                        x: rx, y: ry, width: rw, height: rh,
                        style: `background-color: rgba(0,0,0,0.15); border: 2px dashed ${borderCol};`
                    });
                    zoneBox.set_layout_manager(new Clutter.BinLayout());

                    let labelBox = new St.BoxLayout({
                        vertical: false,
                        style: 'background-color: rgba(0,0,0,0.85); border-radius: 6px; padding: 6px 10px;',
                        x_align: Clutter.ActorAlign.CENTER,
                        y_align: Clutter.ActorAlign.CENTER
                    });
                    
                    let nameEntry = new St.Entry({
                        text: name,
                        style: 'background-color: transparent; border: none; color: white; font-weight: bold;',
                        can_focus: true, reactive: true
                    });
                    
                    nameEntry.clutter_text.connect('activate', () => {
                        let newName = nameEntry.get_text().trim();
                        if (newName && newName !== name) {
                            let zones = this._manager.storage.getCustomSections();
                            zones[newName] = zones[name];
                            delete zones[name];
                            this._manager.storage.setCustomSectionsAndSave(zones);
                            this._zonesModified = true;
                            this._refreshZones();
                        }
                    });

                    let delBtn = new St.Button({
                        child: new St.Icon({ icon_name: 'user-trash-symbolic', icon_size: 16 }),
                        style: 'padding: 6px; margin-left: 12px; background-color: #c01c28; border-radius: 4px;',
                        reactive: true, can_focus: true, track_hover: true
                    });
                    delBtn.connect('clicked', () => {
                        let zones = this._manager.storage.getCustomSections();
                        delete zones[name];
                        this._manager.storage.setCustomSectionsAndSave(zones);
                        this._zonesModified = true;
                        this._refreshZones();
                    });

                    let resizeHandle = new St.BoxLayout({
                        reactive: true,
                        style: `background-color: ${color}; border: 2px solid white; border-radius: 12px 0 8px 0; padding: 6px;`,
                        x_align: Clutter.ActorAlign.END,
                        y_align: Clutter.ActorAlign.END,
                        x_expand: true, 
                        y_expand: true,
                        vertical: false
                    });
                    resizeHandle.add_child(new St.Icon({ icon_name: 'view-fullscreen-symbolic', icon_size: 16, style: 'color: white;' }));

                    labelBox.add_child(nameEntry);
                    labelBox.add_child(delBtn);
                    zoneBox.add_child(labelBox);
                    zoneBox.add_child(resizeHandle);
                    
                    zoneBox.connect('button-press-event', (_, event) => {
                        if (this._promptBox.visible) this._hidePromptSafe();
                        let [x, y] = event.get_coords();
                        this._dragAction = 'move';
                        this._activeZoneName = name;
                        let bxX = zoneBox.x !== undefined ? zoneBox.x : zoneBox.get_x();
                        let bxY = zoneBox.y !== undefined ? zoneBox.y : zoneBox.get_y();
                        this._dragOffsetX = x - bxX;
                        this._dragOffsetY = y - bxY;
                        this._currentDrawMonitorIndex = safeIndex;
                        return Clutter.EVENT_STOP;
                    });

                    resizeHandle.connect('button-press-event', () => {
                        if (this._promptBox.visible) this._hidePromptSafe();
                        this._dragAction = 'resize';
                        this._activeZoneName = name;
                        this._currentDrawMonitorIndex = safeIndex;
                        return Clutter.EVENT_STOP;
                    });

                    delBtn.connect('button-press-event', () => Clutter.EVENT_STOP);
                    nameEntry.connect('button-press-event', () => Clutter.EVENT_STOP);

                    this._zoneWidgets[name] = zoneBox;
                    this._zonesContainer.add_child(zoneBox);
                }
                return GLib.SOURCE_REMOVE;
            });
        }

        open() {
            Main.layoutManager.uiGroup.add_child(this);
            this._pushedModal = Main.pushModal(this);
            
            this._captureId = global.stage.connect('captured-event', (_, event) => {
                if (event.type() === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
                    if (this._promptBox && this._promptBox.visible) {
                        this._hidePromptSafe();
                    } else {
                        this.close();
                    }
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            this.grab_key_focus();
        }

        close() {
            if (this._isClosed) return;
            this._isClosed = true;

            if (this._captureId) {
                global.stage.disconnect(this._captureId);
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
            
            let didModify = this._zonesModified;

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this.get_parent()) {
                    Main.layoutManager.uiGroup.remove_child(this);
                }
                this.destroy();
                this._manager.onDesignerClosed(didModify);
                return GLib.SOURCE_REMOVE;
            });
        }
    }
);