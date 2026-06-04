// omnipanel/transform_x11.js
import Meta from 'gi://Meta';

export class X11TransformStrategy {
    constructor() {}

    clear() {
        // X11 transformations are synchronous and instantaneous, no queue memory required
    }

    applyTransform(task) {
        if (task.window && !task.window._omnipanel_is_dead) {
            try {
                let isAlreadyMax = task.window.get_maximized() === Meta.MaximizeFlags.BOTH || task.window.get_maximized() === 3 || task.window.get_maximized() === true;
                
                if (task.isMax) {
                    if (task.logger) task.logger(`[X11Strategy] Maximizing [${task.title}]`);
                    if (!isAlreadyMax) task.window.maximize(Meta.MaximizeFlags.BOTH);
                } else {
                    if (task.logger) task.logger(`[X11Strategy] Applying immediate geometry on [${task.title}] -> [X:${task.x} Y:${task.y} W:${task.w} H:${task.h}]`);
                    
                    if (isAlreadyMax || task.window.get_maximized() > 0) {
                        task.window.unmaximize(Meta.MaximizeFlags.BOTH);
                    }
                    
                    // CRITICAL FIX: user_op MUST be false for programmatic window movement.
                    // Setting it to true causes the window manager to ignore the request under certain X11 environments.
                    task.window.move_resize_frame(false, task.x, task.y, task.w, task.h);
                }
            } catch (err) {
                if (task.logger) task.logger(`[X11Strategy Error] ${err}`);
            }
        }
    }
}