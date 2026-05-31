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
            this._drawing = false;
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
                    text: `Zone Designer Mode  |  Monitor ${i + 1}  |  Active Layout: ${manager.activeLayoutName || 'None'}  |  Draw to create a zone`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'font-weight: bold; font-size: 16px; color: white;'
                });
                
                let spacer = new St.Widget({ x_expand: true, y_expand: true });
                
                let quitBtn = new St.Button({
                    label: 'Quit Designer',
                    style_class: 'button',
                    style: 'background-color: #c01c28; color: white; border-radius: 6px; padding: 10px 20px; font-weight: bold;',
                    y_align: Clutter.ActorAlign.CENTER,
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
                this._drawing = true;
                this._selection.set_position(x, y);
                this._selection.set_size(0, 0);
                this._selection.show();
                
                return Clutter.EVENT_STOP;
            });

            this.connect('motion-event', (_, event) => {
                if (!this._drawing || this._currentDrawMonitorIndex === -1) return Clutter.EVENT_PROPAGATE;
                let [x, y] = event.get_coords();
                let m = this._monitors[this._currentDrawMonitorIndex];
                
                x = Math.max(m.x, Math.min(x, m.x + m.width));
                y = Math.max(m.y + 70, Math.min(y, m.y + m.height)); 
                
                let rectX = Math.min(this._startX, x);
                let rectY = Math.min(this._startY, y);
                let rectW = Math.abs(x - this._startX);
                let rectH = Math.abs(y - this._startY);
                
                this._selection.set_position(rectX, rectY);
                this._selection.set_size(rectW, rectH);
                return Clutter.EVENT_STOP;
            });

            this.connect('button-release-event', () => {
                if (!this._drawing) return Clutter.EVENT_PROPAGATE;
                this._drawing = false;
                
                if (this._selection.width < 30 || this._selection.height < 30) {
                    this._selection.hide(); 
                    return Clutter.EVENT_STOP;
                }

                this._lastRect = {
                    x: this._selection.x,
                    y: this._selection.y,
                    width: this._selection.width,
                    height: this._selection.height
                };

                let m = this._monitors[this._currentDrawMonitorIndex];
                let px = this._selection.x;
                let py = this._selection.y + this._selection.height + 10;
                
                if (py + 60 > m.y + m.height) py = this._selection.y - 60; 
                if (px + 280 > m.x + m.width) px = m.x + m.width - 280; 

                this._entry.set_text('');
                this._promptBox.set_position(px, py);
                this._promptBox.show();
                this._entry.grab_key_focus();
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
                
                let customSections = this._manager.storage.getCustomSections();

                for (const [name, cs] of Object.entries(customSections)) {
                    let mIndex = cs.monitorIndex !== undefined ? cs.monitorIndex : 0;
                    let mCount = Main.layoutManager.monitors.length;
                    let safeIndex = Math.max(0, Math.min(mIndex, mCount - 1));
                    let monitor = this._monitors[safeIndex];
                    
                    if (!monitor) continue; 

                    let panelHeight = Main.panel.height;
                    let workAreaHeight = monitor.height - panelHeight;

                    let rx = monitor.x + Math.round(monitor.width * cs.rx);
                    let ry = monitor.y + panelHeight + Math.round(workAreaHeight * cs.ry);
                    let rw = Math.round(monitor.width * cs.rw);
                    let rh = Math.round(workAreaHeight * cs.rh);
                    
                    let color = cs.color || '#2ecc71';
                    let borderCol = hexToRgba(color, 1.0);

                    let zoneBox = new St.Widget({
                        reactive: true,
                        x: rx, y: ry, width: rw, height: rh,
                        style: `background-color: transparent; border: 2px dashed ${borderCol};`
                    });

                    let labelBox = new St.BoxLayout({
                        vertical: false,
                        style: 'background-color: rgba(0,0,0,0.85); border-radius: 6px; padding: 6px 10px;',
                        x_align: Clutter.ActorAlign.CENTER,
                        y_align: Clutter.ActorAlign.CENTER,
                        x_expand: true, y_expand: true
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
                        this._refreshZones();
                    });

                    labelBox.add_child(nameEntry);
                    labelBox.add_child(delBtn);
                    zoneBox.add_child(labelBox);
                    
                    zoneBox.connect('button-press-event', () => Clutter.EVENT_STOP);
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
            
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this.get_parent()) {
                    Main.layoutManager.uiGroup.remove_child(this);
                }
                this.destroy();
                this._manager.onDesignerClosed();
                return GLib.SOURCE_REMOVE;
            });
        }
    }
);