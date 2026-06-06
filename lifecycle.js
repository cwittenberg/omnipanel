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
        try { obj.disconnect(id); } catch {}
        this._signals = this._signals.filter(s => s.id !== id);
    }

    bindShortcut(name, settings, handler) {
        try { Main.wm.removeKeybinding(name); } catch {}
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
            try { obj.disconnect(id); } catch {}
        }
        this._signals = [];

        for (let name of this._bindings) {
            try { Main.wm.removeKeybinding(name); } catch {}
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
        
        this.winId = 'unknown';
        try { this.winId = window.get_id ? window.get_id() : 'unknown'; } catch {}
        
        this.attempts = 0;
        this.maxAttempts = 15;
        this.timerId = 0;

        this._bootstrap();
    }

    _bootstrap() {
        let title = 'unknown', wmClass = 'unknown';
        try { title = this.window.get_title() || 'unknown'; wmClass = this.window.get_wm_class() || 'unknown'; } catch {}

        this.logger(`[${this.winId}] ------------------------------------------------`);
        this.logger(`[${this.winId}] 🪲 EXTREME DEBUG: NEW WINDOW DETECTED`);
        this.logger(`[${this.winId}] 🪲 APP: ${wmClass} | TITLE: ${title}`);

        try {
            let rect = this.window.get_frame_rect();
            this.logger(`[${this.winId}] 🪲 INITIAL COMPOSITOR SPAWN GEOMETRY: X:${rect.x} Y:${rect.y} W:${rect.width} H:${rect.height}`);
            if (rect.width < 100 || rect.height < 100) {
                this.logger(`[${this.winId}] 🚨 COMPOSITOR HEALER: Rescuing 0x0 window. Instantly applying safe float.`);
                this.mediator.addTimer(10, () => {
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
        } catch {}

        try {
            this.window._omnipanel_is_dead = false;

            if (this.window._omnipanel_unmanaged_id === undefined) {
                let sigId = this.mediator.connectSignal(this.window, 'unmanaged', () => {
                    this.window._omnipanel_is_dead = true;
                    if (this.timerId) {
                        this.mediator.clearTimer(this.timerId);
                        this.timerId = 0;
                    }
                    this.mediator.disconnectSignal(this.window, sigId);
                    if (this.tilingManager) this.tilingManager.queueAutoTiling(); 
                });
                this.window._omnipanel_unmanaged_id = sigId;
            }

            let isSkipTaskbar = typeof this.window.is_skip_taskbar === 'function' ? this.window.is_skip_taskbar() : false;
            let isSkipPager = typeof this.window.is_skip_pager === 'function' ? this.window.is_skip_pager() : false;

            if (this.window.is_override_redirect() || isSkipTaskbar || isSkipPager) {
                this.logger(`[${this.winId}] Ignoring override-redirect or skip-taskbar (browser tab) window.`);
                return;
            }

            let role = typeof this.window.get_role === 'function' ? this.window.get_role() : '';
            if (role === 'browser-tab' || role === 'pop-up') {
                this.logger(`[${this.winId}] Ignoring browser tab or popup.`);
                return;
            }

            let transient = this.window.get_transient_for();
            if (transient !== null) {
                this.logger(`[${this.winId}] Window is transient (dialog). Aborting entirely.`);
                return; 
            }

            let wType = this.window.get_window_type();
            if (wType !== Meta.WindowType.NORMAL) {
                this.logger(`[${this.winId}] Window is not NORMAL. Aborting entirely.`);
                return;
            }
        } catch {}

        this.logger(`[${this.winId}] >> Starting rapid DBus metadata polling (50ms intervals)...`);
        
        this.timerId = this.mediator.addTimer(50, this._pollMetadata.bind(this));
        
        try {
            this.mediator.connectSignal(this.window, 'size-changed', () => {});
        } catch {}
    }

    _pollMetadata() {
        if (this.window._omnipanel_is_dead || !isWindowValid(this.window)) {
            this.timerId = 0;
            this.logger(`[${this.winId}] Window died or actor destroyed before yield completed. Safely aborted.`);
            return GLib.SOURCE_REMOVE;
        }

        try {
            let isSkipTaskbarNow = typeof this.window.is_skip_taskbar === 'function' ? this.window.is_skip_taskbar() : false;
            let isSkipPagerNow = typeof this.window.is_skip_pager === 'function' ? this.window.is_skip_pager() : false;

            if (isSkipTaskbarNow || isSkipPagerNow) {
                this.logger(`[${this.winId}] Window became skip_taskbar during yield. Aborting.`);
                return GLib.SOURCE_REMOVE;
            }

            let finalWmClass = this.window.get_wm_class() || '';
            
            if (!finalWmClass && this.attempts < this.maxAttempts) {
                this.attempts++;
                return GLib.SOURCE_CONTINUE;
            }

            this.timerId = 0;

            if (!finalWmClass) {
                this.logger(`[${this.winId}] Window has no wm_class after max attempts. Aborting.`);
                return GLib.SOURCE_REMOVE;
            }
            
            this.logger(`[${this.winId}] Metadata retrieved safely on attempt ${this.attempts + 1}. Moving to execution phase.`);
            this.placementCallback(this.window, finalWmClass, this.window.get_title() || '', this.winId);
            
        } catch {
            this.timerId = 0;
            this.logger(`[${this.winId}] FATAL CATCH in Timer`);
        }

        return GLib.SOURCE_REMOVE;
    }
}