// omnipanel/tiling_manager.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { ZoneDesignerRoot } from './zone_designer.js';
import { LayoutStorage } from './layout_storage.js';
import { SnapEngine } from './snap_engine.js';
import { StackManager } from './stack_manager.js';
import { getSectionRect, fuzzyMatchAppToZone, applyWindowTransform, Sections, calculateTitleSimilarity, isWindowValid, isWindowIgnored } from './layout_definitions.js';

export default class TilingManager {
    constructor(settings) {
        this.settings = settings;
        this._enabled = false;
        this._windowCreatedId = 0;
        this._monitorsChangedId = 0;
        this._grabBeginId = 0;
        this._grabEndId = 0;
        this._timeoutId = 0;
        
        this._trackedSignals = [];
        this._trackedTimers = new Set();
        this._activeOverlay = null;

        this.activeLayoutName = null;
        this.isDesignerActive = false;
        this._designerRoot = null;
        this._indicator = null;

        this.storage = new LayoutStorage(this);
        this.snapEngine = new SnapEngine(this);
        this.stackManager = new StackManager(this);
    }

    _log(msg) {
        if (!this.settings.get_boolean('enable-debug-logs')) return;
        let now = GLib.DateTime.new_now_local();
        let ms = now.get_microsecond().toString().padStart(6, '0').substring(0, 3);
        console.log(`[OmniPanel-Debug] [${now.format('%H:%M:%S')}.${ms}] ${msg}`);
    }

    _bindSafe(name, handler) {
        try { Main.wm.removeKeybinding(name); } catch {}
        Main.wm.addKeybinding(name, this.settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT, Shell.ActionMode.NORMAL, handler);
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;
        this._log("Extension ENABLED. Registering listeners.");

        this.settings.set_boolean('designer-active', false);
        let dActiveId = this.settings.connect('changed::designer-active', () => {
            let isActive = this.settings.get_boolean('designer-active');
            if (isActive && !this.isDesignerActive) {
                this.startZoneDesigner();
            } else if (!isActive && this.isDesignerActive) {
                this.stopZoneDesigner();
            }
        });
        this._trackedSignals.push({ obj: this.settings, id: dActiveId });

        let layoutsChangedId = this.settings.connect('changed::named-layouts', () => {
            let layouts = {};
            try { layouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch {}
            if (this.activeLayoutName && !layouts[this.activeLayoutName]) {
                this._log(`Active layout [${this.activeLayoutName}] was deleted. Purging unmanaged zones.`);
                this.activeLayoutName = null;
                this.settings.set_string('custom-sections', '{}');
                this.stackManager.clearOverlays();
                if (this.isDesignerActive) {
                    this.settings.set_boolean('designer-active', false);
                }
            }
        });
        this._trackedSignals.push({ obj: this.settings, id: layoutsChangedId });

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this.storage.onMonitorsChanged());
        this._windowCreatedId = global.display.connect('window-created', this._onWindowCreated.bind(this));
        
        this._grabBeginId = global.display.connect('grab-op-begin', (d, w, o) => this.snapEngine.onGrabBegin(d, w, o));
        this._grabEndId = global.display.connect('grab-op-end', (d, w, o) => this.snapEngine.onGrabEnd(d, w, o));
        
        this._bindSafe('snap-left', () => this.snapEngine.snapDirection('left'));
        this._bindSafe('snap-right', () => this.snapEngine.snapDirection('right'));
        this._bindSafe('snap-up', () => this.snapEngine.snapDirection('up'));
        this._bindSafe('snap-down', () => this.snapEngine.snapDirection('down'));
        this._bindSafe('switch-layout', () => this.cycleLayouts());

        for (let i = 1; i <= 9; i++) {
            this._bindSafe(`layout-hotkey-${i}`, () => this.activateLayoutBySlot(i));
        }

        let defaultLayout = this.settings.get_string('default-layout');
        if (defaultLayout) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.storage.restoreNamedLayout(defaultLayout);
                return GLib.SOURCE_REMOVE;
            });
        }

        this.stackManager.enable();
        this._startStateTracking();
    }

    disable() {
        if (!this._enabled) return;
        this._enabled = false;
        this._log("Extension DISABLED.");

        this.stackManager.disable();
        this.snapEngine.disable();

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = 0;
        }
        if (this._grabBeginId) {
            global.display.disconnect(this._grabBeginId);
            this._grabBeginId = 0;
        }
        if (this._grabEndId) {
            global.display.disconnect(this._grabEndId);
            this._grabEndId = 0;
        }
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        
        for (let item of this._trackedSignals) {
            try { item.obj.disconnect(item.id); } catch {}
        }
        this._trackedSignals = [];

        for (let timerId of this._trackedTimers) {
            GLib.source_remove(timerId);
        }
        this._trackedTimers.clear();

        try { Main.wm.removeKeybinding('snap-left'); } catch {}
        try { Main.wm.removeKeybinding('snap-right'); } catch {}
        try { Main.wm.removeKeybinding('snap-up'); } catch {}
        try { Main.wm.removeKeybinding('snap-down'); } catch {}
        try { Main.wm.removeKeybinding('switch-layout'); } catch {}
        
        for (let i = 1; i <= 9; i++) {
            try { Main.wm.removeKeybinding(`layout-hotkey-${i}`); } catch {}
        }

        if (this._activeOverlay) {
            try { Main.popModal(this._activeOverlay); } catch {}
            if (this._activeOverlay.get_parent()) {
                Main.layoutManager.uiGroup.remove_child(this._activeOverlay);
            }
            this._activeOverlay.destroy();
            this._activeOverlay = null;
        }

        this.stopZoneDesigner();
    }

    activateLayoutBySlot(slotId) {
        let layouts = {};
        try { layouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { return; }

        let targetName = Object.keys(layouts).find(k => layouts[k].hotkeySlot === slotId);
        if (targetName) {
            this.storage.restoreNamedLayout(targetName);
        }
    }

    cycleLayouts() {
        let layoutsStr = this.settings.get_string('named-layouts');
        let layouts = {};
        try { layouts = JSON.parse(layoutsStr); } catch { return; }

        let keys = Object.keys(layouts);
        if (keys.length === 0) return;
        
        let idx = keys.indexOf(this.activeLayoutName);
        let nextIdx = (idx + 1) % keys.length;
        
        this.storage.restoreNamedLayout(keys[nextIdx]);
    }

    getMonitorSignature() {
        let monitors = Main.layoutManager.monitors;
        let sigData = monitors.map(m => `${m.width}x${m.height}@${m.x},${m.y}`);
        let fuzzyData = monitors.length.toString();
        return { exact: sigData.join('|'), fuzzy: fuzzyData };
    }

    _showPromptOverlay(title, callback) {
        let m = Main.layoutManager.monitors[global.display.get_current_monitor()];
        
        let overlay = new St.Widget({
            reactive: true,
            style: 'background-color: rgba(0, 0, 0, 0.75);',
            x: 0, y: 0, width: global.stage.width, height: global.stage.height
        });

        let monitorContainer = new St.BoxLayout({
            vertical: true,
            x: m.x, y: m.y, width: m.width, height: m.height,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        let dialogBox = new St.BoxLayout({
            vertical: true,
            style: 'background-color: #242424; padding: 24px; border-radius: 12px; border: 1px solid #555; box-shadow: 0 8px 16px rgba(0,0,0,0.8);'
        });

        let label = new St.Label({ text: title, style: 'font-weight: bold; font-size: 18px; margin-bottom: 16px; color: white;' });
        let entry = new St.Entry({ style: 'min-width: 300px; padding: 10px; border-radius: 6px; margin-bottom: 24px;', can_focus: true, reactive: true });
        
        let btnBox = new St.BoxLayout({ vertical: false, style: 'spacing: 16px;' });
        let cancelBtn = new St.Button({ label: 'Cancel', style: 'background-color: #444; color: white; padding: 8px 24px; border-radius: 6px;', reactive: true, can_focus: true, track_hover: true });
        let saveBtn = new St.Button({ label: 'Save', style: 'background-color: #0078d4; color: white; padding: 8px 24px; border-radius: 6px; font-weight: bold;', reactive: true, can_focus: true, track_hover: true });

        btnBox.add_child(cancelBtn);
        btnBox.add_child(saveBtn);
        dialogBox.add_child(label);
        dialogBox.add_child(entry);
        dialogBox.add_child(btnBox);
        monitorContainer.add_child(dialogBox);
        overlay.add_child(monitorContainer);

        Main.layoutManager.uiGroup.add_child(overlay);
        this._activeOverlay = overlay;

        let pushedModal = Main.pushModal(overlay);
        entry.grab_key_focus();

        let isClosed = false;
        let closeOverlay = (runCallback, text) => {
            if (isClosed) return;
            isClosed = true;

            if (entry && entry.clutter_text) {
                entry.clutter_text.set_cursor_visible(false);
            }
            global.stage.set_key_focus(overlay);

            if (pushedModal) {
                try { Main.popModal(overlay); } catch { }
                pushedModal = false;
            }

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (overlay.get_parent()) {
                    Main.layoutManager.uiGroup.remove_child(overlay);
                }
                overlay.destroy();
                this._activeOverlay = null;

                if (runCallback && callback) {
                    callback(text);
                }
                return GLib.SOURCE_REMOVE;
            });
        };

        cancelBtn.connect('clicked', () => closeOverlay(false, null));
        saveBtn.connect('clicked', () => closeOverlay(true, entry.get_text().trim()));
        entry.clutter_text.connect('activate', () => closeOverlay(true, entry.get_text().trim()));
        
        overlay.connect('button-press-event', () => Clutter.EVENT_STOP);
        overlay.connect('key-press-event', (_, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                closeOverlay(false, null);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    promptForLayoutName() {
        this._showPromptOverlay('Enter a name for the current layout:', (name) => {
            if (name) this.storage.saveNamedLayout(name);
        });
    }

    startZoneDesigner() {
        if (this.isDesignerActive) return;
        
        if (!this.activeLayoutName) {
            this._showPromptOverlay('No active layout. Name this layout first:', (name) => {
                if (name) {
                    this.storage.saveNamedLayout(name);
                    this.isDesignerActive = true;
                    this._designerRoot = new ZoneDesignerRoot(this);
                    this._designerRoot.open();
                } else {
                    this.settings.set_boolean('designer-active', false);
                }
            });
        } else {
            this.isDesignerActive = true;
            this._designerRoot = new ZoneDesignerRoot(this);
            this._designerRoot.open();
        }
    }

    stopZoneDesigner() {
        if (this._designerRoot) {
            this._designerRoot.close();
        }
    }

    onDesignerClosed(zonesModified) {
        this.isDesignerActive = false;
        this._designerRoot = null;
        this.settings.set_boolean('designer-active', false);

        if (zonesModified) {
            let customSections = this.storage.getCustomSections();
            let windows = global.display.list_all_windows();
            
            for (let win of windows) {
                try {
                    if (win._omnipanel_zone && customSections[win._omnipanel_zone]) {
                        let mIndex = win._omnipanel_monitor !== undefined ? win._omnipanel_monitor : 0;
                        if (customSections[win._omnipanel_zone].monitorIndex !== undefined) {
                            mIndex = customSections[win._omnipanel_zone].monitorIndex;
                        }

                        let rect = getSectionRect(mIndex, win._omnipanel_zone, customSections);
                        if (rect) {
                            this._log(`[Designer Sync] Repositioning window into [${win._omnipanel_zone}]`);
                            applyWindowTransform(win, mIndex, rect, false, this._log.bind(this));
                        }
                    }
                } catch {}
            }
            
            if (this.stackManager) {
                this.stackManager.invalidateSignature();
                this.stackManager.updateOverlays();
            }
        }
    }

    _startStateTracking() {
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            try {
                this.storage.saveCurrentLayoutStates();
            } catch { }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _executePlacement(window, wmClass, winTitle, winId) {
        this._log(`[${winId}] Starting Layout Evaluation. Class=${wmClass} Title=${winTitle}`);
        try {
            if (isWindowIgnored(window, this.settings)) {
                this._log(`[${winId}] Ignoring WM_CLASS/Title [${wmClass} / ${winTitle}] due to user ignore-list configuration.`);
                return;
            }

            let categories = '';
            try {
                let tracker = Shell.WindowTracker.get_default();
                let app = tracker.get_window_app(window);
                if (app && app.get_app_info()) {
                    categories = app.get_app_info().get_categories() || '';
                }
            } catch { }

            let savedData = null;

            if (this.activeLayoutName) {
                let allLayouts = {};
                try { allLayouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { }
                savedData = allLayouts[this.activeLayoutName];
            } else if (this.settings.get_boolean('auto-restore-layouts')) {
                let signatures = this.getMonitorSignature();
                let allLayouts = {};
                try { allLayouts = JSON.parse(this.settings.get_string('saved-tiling-layouts') || '{}'); } catch { }

                savedData = allLayouts[signatures.exact];
                if (!savedData && this.settings.get_boolean('fuzzy-restore-monitors')) {
                    let possibleSignatures = Object.keys(allLayouts);
                    let fuzzyMatch = possibleSignatures.find(sig => sig.split('|').length.toString() === signatures.fuzzy);
                    if (fuzzyMatch) savedData = allLayouts[fuzzyMatch];
                }
            }

            let liveZonesState = this.storage.getCustomSections();
            let windowsState = savedData ? (savedData.windows || savedData) : {};

            let layoutList = windowsState[wmClass] ? (Array.isArray(windowsState[wmClass]) ? windowsState[wmClass] : [windowsState[wmClass]]) : [];
            let layout = null;
            let bestScore = -1;
            
            if (layoutList.length > 0) {
                for (let l of layoutList) {
                    let score = calculateTitleSimilarity(winTitle, l.title);
                    if (score > bestScore) {
                        bestScore = score;
                        layout = l;
                    }
                }
            }

            let matchedZone = null;
            if (this.settings.get_boolean('enable-smart-placement')) {
                let fuzzyData = fuzzyMatchAppToZone(wmClass, winTitle, categories, Object.keys(liveZonesState));
                if (fuzzyData) {
                    matchedZone = fuzzyData.zone;
                }
            }

            let targetRect = null;
            let targetMonitor = 0;
            let isMax = false;
            let targetZoneName = null;

            let hasExplicitSection = layout && layout.section && (liveZonesState[layout.section] || Object.values(Sections).includes(layout.section));

            if (matchedZone) {
                targetZoneName = matchedZone;
            } else if (hasExplicitSection) {
                targetZoneName = layout.section;
            }

            if (targetZoneName) {
                this._log(`[${winId}] MATCH FOUND: Zone [${targetZoneName}]`);
                targetMonitor = liveZonesState[targetZoneName] && liveZonesState[targetZoneName].monitorIndex !== undefined ? liveZonesState[targetZoneName].monitorIndex : (layout ? layout.monitor : 0);
                targetRect = getSectionRect(targetMonitor, targetZoneName, liveZonesState);
                isMax = (targetZoneName === 'maximized' || (hasExplicitSection && layout.section === 'maximized'));

                if (targetRect) {
                    window._omnipanel_zone = targetZoneName;
                    window._omnipanel_monitor = targetMonitor;
                    
                    this._log(`[${winId}] Target zone resolved. Triggering applyWindowTransform on monitor ${targetMonitor}`);
                    applyWindowTransform(window, targetMonitor, targetRect, isMax, this._log.bind(this));
                    
                    let stackTid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                        this._trackedTimers.delete(stackTid);
                        if (this.stackManager) {
                            this.stackManager.invalidateSignature(targetZoneName);
                            try { this.stackManager.updateOverlays(); } catch {}
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                    this._trackedTimers.add(stackTid);
                } else {
                     this._log(`[${winId}] ERROR: getSectionRect returned null for [${targetZoneName}]`);
                }
            } else {
                this._log(`[${winId}] NO MATCH: Ignoring window. Letting GNOME handle natively.`);
            }

        } catch {
            this._log(`[${winId}] FATAL CATCH in _executePlacement`);
        }
    }

    _onWindowCreated(display, window) {
        let winId = 'unknown';
        try { winId = window.get_id ? window.get_id() : 'unknown'; } catch {}
        
        let title = 'unknown', wmClass = 'unknown';
        try { title = window.get_title() || 'unknown'; wmClass = window.get_wm_class() || 'unknown'; } catch {}

        this._log(`[${winId}] ------------------------------------------------`);
        this._log(`[${winId}] 🪲 EXTREME DEBUG: NEW WINDOW DETECTED`);
        this._log(`[${winId}] 🪲 APP: ${wmClass} | TITLE: ${title}`);
        
        try {
            let rect = window.get_frame_rect();
            this._log(`[${winId}] 🪲 INITIAL WAYLAND SPAWN GEOMETRY: X:${rect.x} Y:${rect.y} W:${rect.width} H:${rect.height}`);
            if (rect.width < 100 || rect.height < 100) {
                this._log(`[${winId}] 🚨 WAYLAND HEALER: Rescuing 0x0 window. Instantly applying safe float.`);
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
                    if (isWindowValid(window)) {
                        let m = Main.layoutManager.monitors[window.get_monitor() || 0] || Main.layoutManager.monitors[0];
                        if (window.get_maximized() > 0) {
                            window.unmaximize(Meta.MaximizeFlags.BOTH);
                        }
                        window.move_resize_frame(false, m.x + 100, m.y + 100, 800, 600);
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        } catch {}

        try {
            window._omnipanel_is_dead = false;

            if (window._omnipanel_unmanaged_id === undefined) {
                let sigId = window.connect('unmanaged', () => {
                    window._omnipanel_is_dead = true;
                    if (window._omnipanel_creation_timer) {
                        GLib.source_remove(window._omnipanel_creation_timer);
                        this._trackedTimers.delete(window._omnipanel_creation_timer);
                        window._omnipanel_creation_timer = 0;
                    }
                });
                window._omnipanel_unmanaged_id = sigId;
                this._trackedSignals.push({ obj: window, id: sigId });
            }

            let isSkipTaskbar = typeof window.is_skip_taskbar === 'function' ? window.is_skip_taskbar() : false;
            let isSkipPager = typeof window.is_skip_pager === 'function' ? window.is_skip_pager() : false;

            if (window.is_override_redirect() || isSkipTaskbar || isSkipPager) {
                this._log(`[${winId}] Ignoring override-redirect or skip-taskbar (browser tab) window.`);
                return;
            }

            let role = typeof window.get_role === 'function' ? window.get_role() : '';
            if (role === 'browser-tab' || role === 'pop-up') {
                this._log(`[${winId}] Ignoring browser tab or popup.`);
                return;
            }

            let transient = window.get_transient_for();
            if (transient !== null) {
                this._log(`[${winId}] Window is transient (dialog). Aborting entirely.`);
                return; 
            }

            let wType = window.get_window_type();
            if (wType !== Meta.WindowType.NORMAL) {
                this._log(`[${winId}] Window is not NORMAL. Aborting entirely.`);
                return;
            }

        } catch {}

        this._log(`[${winId}] >> Starting rapid DBus metadata polling (50ms intervals)...`);

        let attempts = 0;
        let maxAttempts = 15; // 15 * 50ms = 750ms max wait

        let timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            if (window._omnipanel_is_dead || !isWindowValid(window)) {
                this._trackedTimers.delete(window._omnipanel_creation_timer);
                window._omnipanel_creation_timer = 0;
                this._log(`[${winId}] Window died or actor destroyed before yield completed. Safely aborted.`);
                return GLib.SOURCE_REMOVE;
            }

            try {
                let isSkipTaskbarNow = typeof window.is_skip_taskbar === 'function' ? window.is_skip_taskbar() : false;
                let isSkipPagerNow = typeof window.is_skip_pager === 'function' ? window.is_skip_pager() : false;

                if (isSkipTaskbarNow || isSkipPagerNow) {
                    this._trackedTimers.delete(window._omnipanel_creation_timer);
                    this._log(`[${winId}] Window became skip_taskbar during yield. Aborting.`);
                    return GLib.SOURCE_REMOVE;
                }

                let finalWmClass = window.get_wm_class() || '';
                
                if (!finalWmClass && attempts < maxAttempts) {
                    attempts++;
                    return GLib.SOURCE_CONTINUE; // Keep polling
                }

                this._trackedTimers.delete(window._omnipanel_creation_timer);
                window._omnipanel_creation_timer = 0;

                if (!finalWmClass) {
                    this._log(`[${winId}] Window has no wm_class after max attempts. Aborting.`);
                    return GLib.SOURCE_REMOVE;
                }
                
                this._log(`[${winId}] Metadata retrieved safely on attempt ${attempts + 1}. Moving to execution phase.`);
                this._executePlacement(window, finalWmClass, window.get_title() || '', winId);
                
            } catch {
                this._trackedTimers.delete(window._omnipanel_creation_timer);
                this._log(`[${winId}] FATAL CATCH in Timer`);
            }

            return GLib.SOURCE_REMOVE;
        });
        window._omnipanel_creation_timer = timerId;
        this._trackedTimers.add(timerId);

        try {
            let sizeSigId = window.connect('size-changed', () => {});
            this._trackedSignals.push({ obj: window, id: sizeSigId });
        } catch {}
    }
}