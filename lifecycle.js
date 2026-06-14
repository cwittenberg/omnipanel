// omnipanel/lifecycle.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { isWindowValid } from './layout_definitions.js';

export class LifecycleMediator {
    constructor(logger) {
        this._signals = [];
        this._bindings = [];
        this._timers = new Set();
        this._logger = logger;
    }

    connectSignal(obj, signal, handler) {
        let id = obj.connect(signal, handler);
        this._signals.push({ obj, id });
        return id;
    }

    disconnectSignal(obj, id) {
        if (obj && id) {
            obj.disconnect(id);
        }
        this._signals = this._signals.filter(s => s.id !== id);
    }

    bindShortcut(name, settings, handler) {
        Main.wm.removeKeybinding(name);
        Main.wm.addKeybinding(name, settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, Shell.ActionMode.NORMAL, handler);
        this._bindings.push(name);
    }

    addTimer(delayMs, handler) {
        let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            let res = handler();
            if (res === GLib.SOURCE_REMOVE) this._timers.delete(id);
            return res;
        });
        this._timers.add(id);
        return id;
    }

    addTimerSeconds(delaySec, handler) {
        let id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delaySec, () => {
            let res = handler();
            if (res === GLib.SOURCE_REMOVE) this._timers.delete(id);
            return res;
        });
        this._timers.add(id);
        return id;
    }

    addIdle(handler) {
        let id = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            let res = handler();
            if (res === GLib.SOURCE_REMOVE) this._timers.delete(id);
            return res;
        });
        this._timers.add(id);
        return id;
    }

    clearTimer(id) {
        if (this._timers.has(id)) {
            GLib.source_remove(id);
            this._timers.delete(id);
        }
    }

    destroy() {
        for (let {obj, id} of this._signals) {
            if (obj && id) obj.disconnect(id);
        }
        this._signals = [];

        for (let name of this._bindings) {
            Main.wm.removeKeybinding(name);
        }
        this._bindings = [];

        for (let id of this._timers) {
            GLib.source_remove(id);
        }
        this._timers.clear();
    }
}

export class WindowBootstrapper {
    constructor(window, mediator, settings, logger, placementCallback, tilingManager) {
        this.window = window;
        this.mediator = mediator;
        this.settings = settings;
        this.logger = logger;
        this.placementCallback = placementCallback;
        this.tilingManager = tilingManager;
        this.onDestroy = null;
        
        this.winId = (window && typeof window.get_id === 'function') ? window.get_id() : 'unknown';
        
        this.attempts = 0;
        this.maxAttempts = 15;
        
        this.timerId = 0;
        this.titleTimerId = 0;
        this.rescueTimerId = 0;
        this.titleChangeSig = 0;
        
        this.placed = false;

        this._bootstrap();
    }

    cleanup() {
        if (this.timerId) {
            this.mediator.clearTimer(this.timerId);
            this.timerId = 0;
        }
        if (this.titleTimerId) {
            this.mediator.clearTimer(this.titleTimerId);
            this.titleTimerId = 0;
        }
        if (this.rescueTimerId) {
            this.mediator.clearTimer(this.rescueTimerId);
            this.rescueTimerId = 0;
        }
        if (this.titleChangeSig && this.window) {
            this.mediator.disconnectSignal(this.window, this.titleChangeSig);
            this.titleChangeSig = 0;
        }
        if (this.window && this.window._omnipanel_unmanaged_id) {
            this.mediator.disconnectSignal(this.window, this.window._omnipanel_unmanaged_id);
            this.window._omnipanel_unmanaged_id = undefined;
        }
        
        if (this.onDestroy) {
            this.onDestroy();
        }
        
        this.window = null;
    }

    _bootstrap() {
        if (!this.window) return;
        
        let title = (typeof this.window.get_title === 'function') ? (this.window.get_title() || 'unknown') : 'unknown';
        let wmClass = (typeof this.window.get_wm_class === 'function') ? (this.window.get_wm_class() || 'unknown') : 'unknown';

        this.logger(`[${this.winId}] ------------------------------------------------`);
        this.logger(`[${this.winId}] 🪲 EXTREME DEBUG: NEW WINDOW DETECTED`);
        this.logger(`[${this.winId}] 🪲 APP: ${wmClass} | TITLE: ${title}`);

        if (typeof this.window.get_frame_rect === 'function') {
            let rect = this.window.get_frame_rect();
            this.logger(`[${this.winId}] 🪲 INITIAL COMPOSITOR SPAWN GEOMETRY: X:${rect.x} Y:${rect.y} W:${rect.width} H:${rect.height}`);
            if (rect.width < 100 || rect.height < 100) {
                this.logger(`[${this.winId}] 🚨 COMPOSITOR HEALER: Rescuing 0x0 window. Instantly applying safe float.`);
                this.rescueTimerId = this.mediator.addTimer(10, () => {
                    this.rescueTimerId = 0;
                    if (isWindowValid(this.window)) {
                        let m = Main.layoutManager.monitors[this.window.get_monitor() || 0] || Main.layoutManager.monitors[0];
                        if (this.window.get_maximized() > 0) {
                            this.window.unmaximize(Meta.MaximizeFlags.BOTH);
                        }
                        this.window.move_resize_frame(false, m.x + 100, m.y + 100, 800, 600);
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        }

        this.window._omnipanel_is_dead = false;

        if (this.window._omnipanel_unmanaged_id === undefined) {
            let sigId = this.mediator.connectSignal(this.window, 'unmanaged', () => {
                if (this.window) this.window._omnipanel_is_dead = true;
                if (this.tilingManager) this.tilingManager.queueAutoTiling(); 
                
                this.cleanup(); 
            });
            this.window._omnipanel_unmanaged_id = sigId;
        }

        let isSkipTaskbar = typeof this.window.is_skip_taskbar === 'function' ? this.window.is_skip_taskbar() : false;
        let isSkipPager = typeof this.window.is_skip_pager === 'function' ? this.window.is_skip_pager() : false;

        let wType = typeof this.window.get_window_type === 'function' ? this.window.get_window_type() : Meta.WindowType.NORMAL;
        let role = typeof this.window.get_role === 'function' ? this.window.get_role() : '';
        let isDialog = (wType === Meta.WindowType.DIALOG || wType === Meta.WindowType.MODAL_DIALOG || wType === Meta.WindowType.UTILITY || role === 'pop-up' || this.window.get_transient_for() !== null);

        let isOverride = typeof this.window.is_override_redirect === 'function' ? this.window.is_override_redirect() : false;

        if (isOverride || (!isDialog && (isSkipTaskbar || isSkipPager))) {
            this.logger(`[${this.winId}] Ignoring override-redirect or skip-taskbar (browser tab) window.`);
            return;
        }

        if (role === 'browser-tab') {
            this.logger(`[${this.winId}] Ignoring browser tab.`);
            return;
        }

        if (wType !== Meta.WindowType.NORMAL && !isDialog) {
            this.logger(`[${this.winId}] Window is not NORMAL or DIALOG. Aborting entirely.`);
            return;
        }

        this.logger(`[${this.winId}] >> Starting rapid DBus metadata polling (50ms intervals)...`);
        
        this.timerId = this.mediator.addTimer(50, this._pollMetadata.bind(this));
        
        let initialTitle = (typeof this.window.get_title === 'function') ? (this.window.get_title() || '') : '';
        this.titleChangeSig = this.mediator.connectSignal(this.window, 'notify::title', () => {
            if (!this.window || !isWindowValid(this.window)) return;
            let newTitle = (typeof this.window.get_title === 'function') ? (this.window.get_title() || '') : '';
            if (newTitle && newTitle !== initialTitle) {
                this.logger(`[${this.winId}] 🪲 TITLE CHANGED during grace period: '${initialTitle}' -> '${newTitle}'`);
                initialTitle = newTitle;
                if (this.placed) {
                    this.logger(`[${this.winId}] Re-evaluating placement due to late title update.`);
                    this.placementCallback(this.window, this.window.get_wm_class() || '', newTitle, this.winId);
                }
            }
        });

        this.titleTimerId = this.mediator.addTimer(2000, () => {
            this.titleTimerId = 0;
            if (this.titleChangeSig && this.window) {
                this.mediator.disconnectSignal(this.window, this.titleChangeSig);
                this.titleChangeSig = 0;
            }
            this.cleanup();
            return GLib.SOURCE_REMOVE;
        });
    }

    _pollMetadata() {
        if (!this.window || this.window._omnipanel_is_dead || !isWindowValid(this.window)) {
            this.timerId = 0;
            this.logger(`[${this.winId}] Window died or actor destroyed before yield completed. Safely aborted.`);
            this.cleanup();
            return GLib.SOURCE_REMOVE;
        }

        let isSkipTaskbarNow = typeof this.window.is_skip_taskbar === 'function' ? this.window.is_skip_taskbar() : false;
        let isSkipPagerNow = typeof this.window.is_skip_pager === 'function' ? this.window.is_skip_pager() : false;

        let wType = typeof this.window.get_window_type === 'function' ? this.window.get_window_type() : Meta.WindowType.NORMAL;
        let role = typeof this.window.get_role === 'function' ? this.window.get_role() : '';
        let isDialog = (wType === Meta.WindowType.DIALOG || wType === Meta.WindowType.MODAL_DIALOG || wType === Meta.WindowType.UTILITY || role === 'pop-up' || this.window.get_transient_for() !== null);

        if (!isDialog && (isSkipTaskbarNow || isSkipPagerNow)) {
            this.logger(`[${this.winId}] Window became skip_taskbar during yield. Aborting.`);
            this.timerId = 0;
            return GLib.SOURCE_REMOVE;
        }

        let finalWmClass = typeof this.window.get_wm_class === 'function' ? (this.window.get_wm_class() || '') : '';
        
        if (!finalWmClass && this.attempts < this.maxAttempts) {
            this.attempts++;
            return GLib.SOURCE_CONTINUE;
        }

        this.timerId = 0;

        if (!finalWmClass) {
            this.logger(`[${this.winId}] Window has no wm_class after max attempts. Aborting.`);
            this.cleanup();
            return GLib.SOURCE_REMOVE;
        }
        
        this.logger(`[${this.winId}] Metadata retrieved safely on attempt ${this.attempts + 1}. Moving to execution phase.`);
        this.placed = true;
        let windowTitle = typeof this.window.get_title === 'function' ? (this.window.get_title() || '') : '';
        this.placementCallback(this.window, finalWmClass, windowTitle, this.winId);

        return GLib.SOURCE_REMOVE;
    }
}