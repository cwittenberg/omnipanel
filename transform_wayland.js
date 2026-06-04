// omnipanel/transform_wayland.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

export class WaylandTransformStrategy {
    constructor() {
        this.queue = [];
        this.isRunning = false;
        this.activeTimeouts = new Set();
    }

    clear() {
        this.queue.length = 0;
        this.isRunning = false;
        for (let t of this.activeTimeouts) {
            GLib.source_remove(t);
        }
        this.activeTimeouts.clear();
    }

    _safeTimeout(delay, callback) {
        let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.activeTimeouts.delete(id);
            if (!this.isRunning) return GLib.SOURCE_REMOVE;
            return callback();
        });
        this.activeTimeouts.add(id);
        return id;
    }

    _processQueue() {
        if (this.queue.length === 0 || !this.isRunning) {
            this.isRunning = false;
            return;
        }
        
        this.isRunning = true;
        let task = this.queue.shift();
        
        if (task.window && !task.window._omnipanel_is_dead) {
            try {
                let isAlreadyMax = task.window.get_maximized() === Meta.MaximizeFlags.BOTH || task.window.get_maximized() === 3 || task.window.get_maximized() === true;
                
                if (task.isMax) {
                    if (task.logger) task.logger(`[WaylandStrategy] Maximizing [${task.title}]`);
                    if (!isAlreadyMax) task.window.maximize(Meta.MaximizeFlags.BOTH);
                } else {
                    if (task.logger) task.logger(`[WaylandStrategy] Applying spanning geometry on [${task.title}] -> [X:${task.x} Y:${task.y} W:${task.w} H:${task.h}]`);
                    
                    if (isAlreadyMax || task.window.get_maximized() > 0) {
                        task.window.unmaximize(Meta.MaximizeFlags.BOTH);
                    }
                    
                    task.window.move_resize_frame(false, task.x, task.y, task.w, task.h);
                    
                    this._safeTimeout(50, () => {
                        if (task.window && !task.window._omnipanel_is_dead) {
                            if (task.window.get_maximized() > 0) task.window.unmaximize(Meta.MaximizeFlags.BOTH);
                            task.window.move_resize_frame(false, task.x, task.y, task.w, task.h);
                        }
                        return GLib.SOURCE_REMOVE;
                    });

                    this._safeTimeout(250, () => {
                        if (task.window && !task.window._omnipanel_is_dead) {
                            if (task.window.get_maximized() > 0) task.window.unmaximize(Meta.MaximizeFlags.BOTH);
                            task.window.move_resize_frame(false, task.x, task.y, task.w, task.h);
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                }
            } catch (err) {
                if (task.logger) task.logger(`[WaylandStrategy Error] ${err}`);
            }
        }
        
        this._safeTimeout(50, () => {
            this._processQueue();
            return GLib.SOURCE_REMOVE;
        });
    }

    applyTransform(task) {
        let existingIdx = this.queue.findIndex(t => t.id === task.id);
        if (existingIdx !== -1) {
            this.queue.splice(existingIdx, 1);
        }
        this.queue.push(task);
        
        if (!this.isRunning) {
            this.isRunning = true;
            this._processQueue();
        }
    }
}