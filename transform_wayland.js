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
        for (let t of this.activeTimeouts) {
            GLib.source_remove(t);
        }
        this.activeTimeouts.clear();
    }

    _safeTimeout(delay, callback) {
        let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.activeTimeouts.delete(id);
            callback();
            return GLib.SOURCE_REMOVE;
        });
        this.activeTimeouts.add(id);
        return id;
    }

    _isTargetGeometryReached(window, targetX, targetY, targetW, targetH) {
        try {
            let rect = window.get_frame_rect();
            // Wayland CSDs (Client-Side Decorations) can sometimes introduce a shadow/border offset.
            // Ensure high-dpi scale awareness is implemented so tolerances work accurately on fractional scaling.
            let scale = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
            let tolerance = 2 * scale;
            
            let xMatch = Math.abs(rect.x - targetX) <= tolerance;
            let yMatch = Math.abs(rect.y - targetY) <= tolerance;
            let wMatch = Math.abs(rect.width - targetW) <= tolerance;
            let hMatch = Math.abs(rect.height - targetH) <= tolerance;
            return (xMatch && yMatch && wMatch && hMatch);
        } catch {
            return false;
        }
    }

    _executeTask(taskId) {
        let task = this.activeTasks.get(taskId);
        if (!task || !task.window || task.window._omnipanel_is_dead) {
            this.activeTasks.delete(taskId);
            return;
        }

        try {
            let isAlreadyMax = task.window.get_maximized() === Meta.MaximizeFlags.BOTH || task.window.get_maximized() === 3 || task.window.get_maximized() === true;
            
            if (task.isMax) {
                if (!isAlreadyMax) task.window.maximize(Meta.MaximizeFlags.BOTH);
                // Maximizing is atomic enough on Wayland, no retries needed.
                this.activeTasks.delete(taskId); 
            } else {
                if (isAlreadyMax || task.window.get_maximized() > 0) {
                    task.window.unmaximize(Meta.MaximizeFlags.BOTH);
                }
                
                if (!this._isTargetGeometryReached(task.window, task.x, task.y, task.w, task.h)) {
                    // Only blast the move_resize_frame if we are explicitly out of bounds
                    task.window.move_resize_frame(false, task.x, task.y, task.w, task.h);
                    
                    task.attempts--;
                    if (task.attempts > 0) {
                        // Retry evaluation in 150ms. This acts as a net to catch windows that 
                        // ignored the first request because they were busy mapping or unmaximizing.
                        this._safeTimeout(150, () => this._executeTask(taskId));
                    } else {
                        if (task.logger) task.logger(`[WaylandStrategy] Transform timed out after 3s for [${task.title}]`);
                        this.activeTasks.delete(taskId);
                    }
                } else {
                    // Target reached. Clean up map.
                    this.activeTasks.delete(taskId);
                }
            }
        } catch (err) {
            if (task.logger) task.logger(`[WaylandStrategy Error] ${err}`);
            this.activeTasks.delete(taskId);
        }
    }

    applyTransform(task) {
        // Initialize tracking (20 attempts * 150ms = 3.0 seconds maximum patience per window)
        task.attempts = 20; 
        
        // Set or Overwrite (Debouncing). If StackManager spams transforms for the same window,
        // we simply update the target coordinates and reset the attempt counter, preventing queue jams.
        this.activeTasks.set(task.id, task);
        
        if (task.logger) task.logger(`[WaylandStrategy] Committing transform [${task.title}] -> [X:${task.x} Y:${task.y} W:${task.w} H:${task.h}]`);
        
        this._executeTask(task.id);
    }
}