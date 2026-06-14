// omnipanel/quick_tiler.js

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { applyWindowTransform } from './window_manager_adapter.js';

export const QuickTilerOverlay = GObject.registerClass(
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
            let pointerRect = new Mtk.Rectangle({ x: Math.round(px), y: Math.round(py), width: 1, height: 1 });
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
                hint_text: _('Name this Zone (or leave blank to just resize)...'),
                style: 'min-width: 340px; padding: 8px; margin-right: 12px; border-radius: 6px;',
                can_focus: true, reactive: true
            });
            this._entry.connectObject('destroy', () => { this._entry = null; }, this);
            
            let saveBtn = new St.Button({ 
                label: _('Apply'), 
                style: 'background-color: #2ecc71; color: #111; font-weight: bold; padding: 6px 20px; border-radius: 6px;',
                reactive: true, can_focus: true, track_hover: true
            });
            
            saveBtn.connectObject('clicked', () => this._submitPrompt(), this);
            this._entry.clutter_text.connectObject('activate', () => this._submitPrompt(), this);
            
            this._promptBox.add_child(this._entry);
            this._promptBox.add_child(saveBtn);

            this.add_child(this._promptBox);

            this.connectObject('button-press-event', (actor, event) => {
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
            }, this);

            this.connectObject('motion-event', (actor, event) => {
                if (!this._isDragging) return Clutter.EVENT_PROPAGATE;
                let [x, y] = event.get_coords();
                let cell = this._getCellAt(x, y);
                if (cell && cell._index !== this._endIndex) {
                    this._endIndex = cell._index;
                    this._updateHighlight();
                }
                return Clutter.EVENT_STOP;
            }, this);

            this.connectObject('button-release-event', () => {
                if (this._isDragging) {
                    this._isDragging = false;
                    this._applyTiling();
                }
                return Clutter.EVENT_STOP;
            }, this);

            Main.layoutManager.uiGroup.add_child(this);
            this._modalGrab = Main.pushModal(this);
            this.connectObject('destroy', () => {
                this._modalGrab = null;
            }, this);

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

        _hasModalGrab(grab) {
            if (!grab) {
                return false;
            }

            if (!Main.modalActorFocusStack) {
                return true;
            }

            return Main.modalActorFocusStack.some(record => record.grab === grab);
        }

        _popModal() {
            let grab = this._modalGrab;
            if (!grab) {
                return;
            }

            this._modalGrab = null;

            if (this._hasModalGrab(grab)) {
                Main.popModal(grab);
            }
        }

        close() {
            if (this._isClosed) return;
            this._isClosed = true;

            if (this._captureId) {
                this.manager.mediator.disconnectSignal(global.stage, this._captureId);
                this._captureId = 0;
            }

            if (this._entry && this._entry.clutter_text) {
                this._entry.clutter_text.set_cursor_visible(false);
            }
            
            global.stage.set_key_focus(null);
            this._popModal();
            
            if (this.manager && this.manager._quickTiler === this) {
                this.manager._quickTiler = null;
            }

            if (this.get_parent && this.get_parent()) {
                Main.layoutManager.uiGroup.remove_child(this);
            }
            this.destroy();
        }
    }
);