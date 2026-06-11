// omnipanel/transform_wayland.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

export class WaylandTransformStrategy {
    constructor() {
        this.activeTasks = new Map();
        this.activeTimeouts = new Set();
    }

    clear() {
        this.activeTasks.clear();
        for (const timeoutId of this.activeTimeouts) {
            GLib.source_remove(timeoutId);
        }
        this.activeTimeouts.clear();
    }

    _safeTimeout(delay, callback) {
        const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.activeTimeouts.delete(timeoutId);
            callback();
            return GLib.SOURCE_REMOVE;
        });
        this.activeTimeouts.add(timeoutId);
        return timeoutId;
    }

    _isTargetGeometryReached(window, targetX, targetY, targetW, targetH) {
        try {
            const rect = window.get_frame_rect();
            const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
            const tolerance = 2 * scale;
            
            const xMatch = Math.abs(rect.x - targetX) <= tolerance;
            const yMatch = Math.abs(rect.y - targetY) <= tolerance;
            const wMatch = Math.abs(rect.width - targetW) <= tolerance;
            const hMatch = Math.abs(rect.height - targetH) <= tolerance;
            return (xMatch && yMatch && wMatch && hMatch);
        } catch {
            return false;
        }
    }

    _executeTask(taskIdentifier) {
        const task = this.activeTasks.get(taskIdentifier);
        if (!task || !task.window || task.window._omnipanel_is_dead) {
            this.activeTasks.delete(taskIdentifier);
            return;
        }

        try {
            const isAlreadyMax = task.window.get_maximized() === Meta.MaximizeFlags.BOTH || task.window.get_maximized() === 3 || task.window.get_maximized() === true;
            
            if (task.isMax) {
                if (!isAlreadyMax) task.window.maximize(Meta.MaximizeFlags.BOTH);
                this.activeTasks.delete(taskIdentifier); 
            } else {
                if (isAlreadyMax || task.window.get_maximized() > 0) {
                    task.window.unmaximize(Meta.MaximizeFlags.BOTH);
                }
                
                if (!this._isTargetGeometryReached(task.window, task.x, task.y, task.w, task.h)) {
                    task.window.move_resize_frame(false, task.x, task.y, task.w, task.h);
                    
                    task.attempts--;
                    if (task.attempts > 0) {
                        this._safeTimeout(150, () => this._executeTask(taskIdentifier));
                    } else {
                        if (task.logger) task.logger(`[WaylandStrategy] Transform timed out after 3s for [${task.title}]`);
                        try {
                            const actual = task.window.get_frame_rect();
                            if (actual.width > task.w) task.window._omnipanel_min_w = actual.width;
                            if (actual.height > task.h) task.window._omnipanel_min_h = actual.height;
                        } catch {}
                        this.activeTasks.delete(taskIdentifier);
                    }
                } else {
                    this.activeTasks.delete(taskIdentifier);
                }
            }
        } catch (err) {
            if (task.logger) task.logger(`[WaylandStrategy Error] ${err}`);
            this.activeTasks.delete(taskIdentifier);
        }
    }

    applyTransform(task) {
        task.attempts = 20; 
        this.activeTasks.set(task.id, task);
        if (task.logger) task.logger(`[WaylandStrategy] Committing transform [${task.title}] -> [X:${task.x} Y:${task.y} W:${task.w} H:${task.h}]`);
        this._executeTask(task.id);
    }
}