// omnipanel/transform_x11.js
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

export class X11TransformStrategy {
    constructor() {}

    clear() {
        // X11 transformations are synchronous
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
                    
                    task.window.move_resize_frame(false, task.x, task.y, task.w, task.h);

                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                        if (task.window && !task.window._omnipanel_is_dead) {
                            try {
                                let actual = task.window.get_frame_rect();
                                
                                if (actual.width > task.w) task.window._omnipanel_min_w = actual.width;
                                if (actual.height > task.h) task.window._omnipanel_min_h = actual.height;

                                let zRight = task.zoneX + task.zoneW;
                                let zBottom = task.zoneY + task.zoneH;

                                let aRight = actual.x + actual.width;
                                let aBottom = actual.y + actual.height;

                                let shiftX = 0;
                                let shiftY = 0;

                                if (aRight > zRight) shiftX = zRight - aRight;
                                if (aBottom > zBottom) shiftY = zBottom - aBottom;

                                if (actual.x + shiftX < task.zoneX) shiftX = task.zoneX - actual.x;
                                if (actual.y + shiftY < task.zoneY) shiftY = task.zoneY - actual.y;

                                if (shiftX !== 0 || shiftY !== 0) {
                                    if (task.logger) task.logger(`[X11Strategy] Correcting Zone Boundary Overflow for [${task.title}]: Shift X by ${shiftX}, Y by ${shiftY}`);
                                    task.window.move_resize_frame(false, actual.x + shiftX, actual.y + shiftY, actual.width, actual.height);
                                }
                            } catch {}
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                }
            } catch (err) {
                if (task.logger) task.logger(`[X11Strategy Error] ${err}`);
            }
        }
    }
}