// omnipanel/zone_designer.js
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { hexToRgba, getLayoutColors } from './layout_definitions.js';

// --- USER ADJUSTABLE UI VARIABLES ---
const TOPBAR_HEIGHT = 110; // Adjust the height of the top toolbar
const BUTTON_PADDING = '4px 8px'; // Adjust button inner padding (top/bottom left/right)
const ENTRY_PADDING = '4px'; // Adjust text entry inner padding
const QUIT_BUTTON_HEIGHT = 55; // Adjust the total height of the Quit Designer button
// ------------------------------------

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
            this._cycleBtns = [];
            this._lastRect = null;
            
            this.set_position(0, 0);
            this.set_size(global.stage.width, global.stage.height);
            
            this._zonesContainer = new St.Widget();
            this._zonesContainer.set_position(0, 0);
            this._zonesContainer.set_size(global.stage.width, global.stage.height);
            this.add_child(this._zonesContainer);

            let colors = getLayoutColors(manager);

            this._selection = new St.Widget({
                style: `background-color: rgba(255,255,255,0.1); border: 2px solid ${colors.border}; border-radius: 12px;`,
                visible: false
            });
            this.add_child(this._selection);

            this._warningLabel = new St.Label({
                text: 'Hold and drag to draw and expand zone (Min: 450x400)',
                style: 'color: #ff7a7a; font-weight: bold; font-size: 14px; background-color: rgba(30,30,30,0.95); padding: 8px 16px; border-radius: 99px; border: 1px solid rgba(255,122,122,0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.5);',
                visible: false
            });
            this.add_child(this._warningLabel);

            this._promptBox = new St.BoxLayout({ 
                 vertical: false, 
                 visible: false, 
                 reactive: true,
                 style: 'background-color: rgba(40,40,40,0.95); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 24px rgba(0,0,0,0.5);' 
             });
            
            this._entry = new St.Entry({ 
                 hint_text: 'Name this Zone...', 
                 style: `min-width: 220px; margin-right: 12px; padding: ${ENTRY_PADDING};`, 
                 can_focus: true, 
                 reactive: true 
             });

            let cancelBox = new St.BoxLayout({ vertical: false });
            let cancelIcon = new St.Icon({ icon_name: 'window-close-symbolic', icon_size: 16, style: 'margin-right: 8px;' });
            let cancelLabel = new St.Label({ text: 'Cancel', y_align: Clutter.ActorAlign.CENTER });
            cancelBox.add_child(cancelIcon);
            cancelBox.add_child(cancelLabel);

            this._cancelBtn = new St.Button({
                child: cancelBox,
                style_class: 'button',
                style: `padding: ${BUTTON_PADDING}; margin-right: 8px;`,
                reactive: true,
                track_hover: true,
                can_focus: true
            });
            
            this._cancelBtn.connect('clicked', () => {
                this._hidePromptSafe();
                this._dragAction = null;
            });

            let saveBox = new St.BoxLayout({ vertical: false });
            let saveIcon = new St.Icon({ icon_name: 'emblem-ok-symbolic', icon_size: 16, style: 'margin-right: 8px;' });
            let saveLabel = new St.Label({ text: 'Save', y_align: Clutter.ActorAlign.CENTER });
            saveBox.add_child(saveIcon);
            saveBox.add_child(saveLabel);

            this._saveBtn = new St.Button({
                 child: saveBox,
                 style_class: 'button suggested-action',
                 style: `padding: ${BUTTON_PADDING};`,
                 reactive: true,
                 track_hover: true,
                 can_focus: true
             });
            
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
            this._promptBox.add_child(this._cancelBtn);
            this._promptBox.add_child(this._saveBtn);
            this.add_child(this._promptBox);

            this._monitors.forEach((m, i) => {
                let toolbar = new St.BoxLayout({
                    vertical: false,
                    style: 'background-color: rgba(30, 30, 30, 0.95); padding: 12px 24px; border-bottom: 1px solid rgba(255,255,255,0.1); box-shadow: 0 2px 4px rgba(0,0,0,0.2);',
                    reactive: true
                });
                
                toolbar.set_position(m.x, m.y);
                toolbar.set_size(m.width, TOPBAR_HEIGHT);
                
                let titleLabel = new St.Label({
                    text: `Zone Designer Mode  |  Monitor ${i + 1}`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'font-weight: bold; font-size: 16px; color: white; margin-right: 24px;'
                });

                let cycleBtn = new St.Button({
                    label: `Layout: ${manager.activeLayoutName || 'None'} (Click to Cycle)`,
                    style_class: 'button',
                    style: `margin-right: 24px; padding: ${BUTTON_PADDING};`,
                    y_align: Clutter.ActorAlign.CENTER,
                    reactive: true, track_hover: true, can_focus: true
                });
                cycleBtn.connect('clicked', () => {
                    manager.cycleLayouts();
                    this._refreshToolbars();
                    this._refreshZones();
                });
                this._cycleBtns.push(cycleBtn);

                let newLayoutBox = new St.BoxLayout({ vertical: false, style: 'margin-right: 24px;', y_align: Clutter.ActorAlign.CENTER });
                
                let newLayoutEntry = new St.Entry({
                    hint_text: 'New Layout Name...',
                    style: `min-width: 180px; margin-right: 8px; padding: ${ENTRY_PADDING};`,
                    can_focus: true, reactive: true
                });
                newLayoutEntry.add_style_class_name('new-layout-entry');

                let newLayoutBtn = new St.Button({
                    label: 'Create',
                    style_class: 'button',
                    style: `padding: ${BUTTON_PADDING};`,
                    reactive: true, track_hover: true, can_focus: true
                });
                
                let handleCreateLayout = () => {
                    let name = newLayoutEntry.get_text().trim();
                    if (name) {
                        let allLayouts = {};
                        try { allLayouts = JSON.parse(manager.settings.get_string('named-layouts') || '{}'); } catch { }
                        
                        if (!allLayouts[name]) {
                            let usedSlots = Object.values(allLayouts).map(l => l.hotkeySlot).filter(s => s);
                            let freeSlot = [1,2,3,4,5,6,7,8,9].find(s => !usedSlots.includes(s)) || 1;
                            
                            allLayouts[name] = { windows: {}, zones: {}, color: '#2ecc71', hotkeySlot: freeSlot };
                            manager.settings.set_string('named-layouts', JSON.stringify(allLayouts));
                        }
                        
                        manager.storage.restoreNamedLayout(name);
                        
                        newLayoutEntry.set_text('');
                        this._refreshToolbars();
                        this._refreshZones(); 
                    }
                };
                newLayoutBtn.connect('clicked', handleCreateLayout);
                newLayoutEntry.clutter_text.connect('activate', handleCreateLayout);

                newLayoutBox.add_child(newLayoutEntry);
                newLayoutBox.add_child(newLayoutBtn);
                
                let spacer = new St.Widget({ x_expand: true, y_expand: true });
                
                let quitBox = new St.BoxLayout({ vertical: false });
                let quitIcon = new St.Icon({ icon_name: 'window-close-symbolic', icon_size: 16, style: 'margin-right: 8px; color: white;' });
                let quitLabel = new St.Label({ text: 'Quit Designer', y_align: Clutter.ActorAlign.CENTER, style: 'color: white; font-weight: bold;' });
                quitBox.add_child(quitIcon);
                quitBox.add_child(quitLabel);

                let quitBtn = new St.Button({
                    child: quitBox,
                    style_class: 'button',
                    style: `padding: ${BUTTON_PADDING}; height: ${QUIT_BUTTON_HEIGHT}px; background-color: #E95420; border: 1px solid #C84617; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);`,
                    y_align: Clutter.ActorAlign.CENTER,
                    x_align: Clutter.ActorAlign.CENTER,
                    reactive: true,
                    can_focus: true,
                    track_hover: true
                });
                
                quitBtn.connect('notify::hover', () => {
                    if (quitBtn.hover) {
                        quitBtn.set_style(`padding: ${BUTTON_PADDING}; height: ${QUIT_BUTTON_HEIGHT}px; background-color: #F37343; border: 1px solid #E95420; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);`);
                    } else {
                        quitBtn.set_style(`padding: ${BUTTON_PADDING}; height: ${QUIT_BUTTON_HEIGHT}px; background-color: #E95420; border: 1px solid #C84617; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);`);
                    }
                });
                quitBtn.connect('clicked', () => this.close());
                
                toolbar.add_child(titleLabel);
                toolbar.add_child(cycleBtn);
                toolbar.add_child(newLayoutBox);
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
                
                this._currentDrawMonitorIndex = this._monitors.findIndex(mon => 
                    x >= mon.x && x < mon.x + mon.width && y >= mon.y && y < mon.y + mon.height
                );
                
                if (this._currentDrawMonitorIndex === -1) return Clutter.EVENT_PROPAGATE;
                
                let mon = this._monitors[this._currentDrawMonitorIndex];
                
                if (y <= mon.y + TOPBAR_HEIGHT) return Clutter.EVENT_PROPAGATE; 

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
                let showWarning = false;
                
                if (this._dragAction === 'draw') {
                    let rawW = Math.abs(x - this._startX);
                    let rawH = Math.abs(y - this._startY);
                    
                    if (rawW < 450 || rawH < 400) {
                        showWarning = true;
                    }
                    
                    let rectW = Math.max(450, rawW);
                    let rectH = Math.max(400, rawH);
                    
                    let rectX = x < this._startX ? this._startX - rectW : this._startX;
                    let rectY = y < this._startY ? this._startY - rectH : this._startY;
                    
                    rectX = Math.max(0, Math.min(rectX, global.stage.width - rectW));
                    rectY = Math.max(TOPBAR_HEIGHT, Math.min(rectY, global.stage.height - rectH));

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
                        
                        if (rawW < 450 || rawH < 400) {
                            showWarning = true;
                        }
                        
                        let newW = Math.max(450, rawW);
                        let newH = Math.max(400, rawH);
                        
                        newW = Math.min(newW, global.stage.width - bxX);
                        newH = Math.min(newH, global.stage.height - bxY);
                        
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
                    let panelH = Main.panel.height;
                    
                    sW = Math.max(450, sW);
                    sH = Math.max(400, sH);

                    if (sX + sW > global.stage.width) sX = global.stage.width - sW;
                    if (sY + sH > global.stage.height) sY = global.stage.height - sH;

                    let snapX = sX, snapY = sY, snapR = sX + sW, snapB = sY + sH;
                    for (let mon of this._monitors) {
                        if (Math.abs(snapX - mon.x) < 30) snapX = mon.x;
                        if (Math.abs(snapY - (mon.y + panelH)) < 30) snapY = mon.y + panelH;
                        if (Math.abs(snapR - (mon.x + mon.width)) < 30) snapR = mon.x + mon.width;
                        if (Math.abs(snapB - (mon.y + mon.height)) < 30) snapB = mon.y + mon.height;
                    }
                    sX = snapX;
                    sY = snapY;
                    sW = snapR - sX;
                    sH = snapB - sY;
                    
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
                    
                    let currMon = this._monitors[this._currentDrawMonitorIndex];
                    if (py + 60 > currMon.y + currMon.height) py = sY - 60; 
                    if (px + 360 > currMon.x + currMon.width) px = currMon.x + currMon.width - 360; 

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

                        let panelH = Main.panel.height;
                        let snapBxX = bxX, snapBxY = bxY, snapBxR = bxX + bxW, snapBxB = bxY + bxH;
                        
                        for (let mon of this._monitors) {
                            if (Math.abs(snapBxX - mon.x) < 30) snapBxX = mon.x;
                            if (Math.abs(snapBxY - (mon.y + panelH)) < 30) snapBxY = mon.y + panelH;
                            if (Math.abs(snapBxR - (mon.x + mon.width)) < 30) snapBxR = mon.x + mon.width;
                            if (Math.abs(snapBxB - (mon.y + mon.height)) < 30) snapBxB = mon.y + mon.height;
                        }
                        
                        bxX = snapBxX;
                        bxY = snapBxY;
                        bxW = snapBxR - bxX;
                        bxH = snapBxB - bxY;

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

        _refreshToolbars() {
            let name = this._manager.activeLayoutName || 'None';
            for (let btn of this._cycleBtns) {
                btn.set_label(`Layout: ${name} (Click to Cycle)`);
            }
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

                    let crx = Number(cs.rx) || 0;
                    let cry = Number(cs.ry) || 0;
                    let crw = Number(cs.rw) || 0.2;
                    let crh = Number(cs.rh) || 0.2;

                    let rx = monitor.x + Math.round(monitor.width * crx);
                    let ry = monitor.y + panelHeight + Math.round(workAreaHeight * cry);
                    
                    let rw = Math.max(450, Math.round(monitor.width * crw));
                    let rh = Math.max(400, Math.round(workAreaHeight * crh));
                    
                    let color = cs.color || '#2ecc71';
                    let borderCol = hexToRgba(color, 1.0);

                    let zoneBox = new St.Widget({
                        reactive: true,
                        x: rx, y: ry, width: rw, height: rh,
                        style: `background-color: rgba(0,0,0,0.15); border: 2px dashed ${borderCol}; border-radius: 12px;`
                    });

                    zoneBox.set_layout_manager(new Clutter.BinLayout());

                    let labelBox = new St.BoxLayout({
                        vertical: false,
                        style: 'background-color: rgba(40,40,40,0.95); border-radius: 8px; padding: 6px 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 8px rgba(0,0,0,0.3);',
                        x_align: Clutter.ActorAlign.CENTER,
                        y_align: Clutter.ActorAlign.CENTER
                    });
                    
                    let nameEntry = new St.Entry({
                        text: name,
                        style: `min-width: 120px; background-color: rgba(0,0,0,0.2); border-radius: 4px; color: white; font-weight: bold; margin-right: 8px; padding: ${ENTRY_PADDING};`,
                        can_focus: true, reactive: true
                    });
                    
                    let handleZoneRename = () => {
                        let newName = nameEntry.get_text().trim();
                        if (newName && newName !== name) {
                            let zones = this._manager.storage.getCustomSections();
                            zones[newName] = zones[name];
                            delete zones[name];
                            this._manager.storage.setCustomSectionsAndSave(zones);
                            this._zonesModified = true;
                            this._refreshZones();
                        }
                    };
                    
                    nameEntry.clutter_text.connect('activate', handleZoneRename);

                    let zSaveBtn = new St.Button({
                        child: new St.Icon({ icon_name: 'emblem-ok-symbolic', icon_size: 16 }),
                        style_class: 'button suggested-action',
                        style: `padding: 6px; margin-right: 8px;`,
                        reactive: true, can_focus: true, track_hover: true,
                        visible: false
                    });
                    zSaveBtn.connect('clicked', handleZoneRename);

                    nameEntry.clutter_text.connect('text-changed', () => {
                        if (nameEntry.get_text().trim() !== name) {
                            if (!zSaveBtn.visible) zSaveBtn.show();
                        } else {
                            if (zSaveBtn.visible) zSaveBtn.hide();
                        }
                    });

                    let delBtn = new St.Button({
                        child: new St.Icon({ icon_name: 'user-trash-symbolic', icon_size: 16 }),
                        style_class: 'button destructive-action',
                        style: `padding: 6px;`,
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
                        style: `background-color: rgba(40,40,40,0.8); border-top: 1px solid rgba(255,255,255,0.2); border-left: 1px solid rgba(255,255,255,0.2); border-radius: 8px 0 12px 0; padding: 8px;`,
                        x_align: Clutter.ActorAlign.END,
                        y_align: Clutter.ActorAlign.END,
                        x_expand: true, 
                        y_expand: true,
                        vertical: false
                    });
                    resizeHandle.add_child(new St.Icon({ icon_name: 'view-fullscreen-symbolic', icon_size: 16, style: 'color: white;' }));

                    labelBox.add_child(nameEntry);
                    labelBox.add_child(zSaveBtn);
                    labelBox.add_child(delBtn);
                    zoneBox.add_child(labelBox);
                    zoneBox.add_child(resizeHandle);
                    
                    zoneBox.connect('button-press-event', (_, event) => {
                        let source = event.get_source();
                        let temp = source;
                        let isInteractive = false;
                        while (temp && temp !== zoneBox) {
                            if (temp instanceof St.Button || temp instanceof St.Entry) {
                                isInteractive = true;
                                break;
                            }
                            temp = temp.get_parent();
                        }
                        if (isInteractive) return Clutter.EVENT_PROPAGATE;

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
                    if (this._dragAction) {
                        this._dragAction = null;
                        this._activeZoneName = null;
                        if (this._selection) this._selection.hide();
                        if (this._warningLabel) this._warningLabel.hide();
                        this._refreshZones(); 
                        return Clutter.EVENT_STOP;
                    }
                    if (this._promptBox && this._promptBox.visible) {
                        this._hidePromptSafe();
                        return Clutter.EVENT_STOP;
                    }
                    let focus = global.stage.get_key_focus();
                    if (focus && focus.has_style_class_name && focus.has_style_class_name('new-layout-entry')) {
                        global.stage.set_key_focus(this);
                        return Clutter.EVENT_STOP;
                    }
                    this.close();
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
                
                this._cycleBtns = [];
                this._zoneWidgets = {};
                this._lastRect = null;
                
                this.destroy();
                this._manager.onDesignerClosed(didModify);
                return GLib.SOURCE_REMOVE;
            });
        }
    }
);