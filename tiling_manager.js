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
import { getSectionRect, fuzzyMatchAppToZone, Sections, calculateTitleSimilarity, isWindowIgnored } from './layout_definitions.js';
import { applyWindowTransform } from './window_manager_adapter.js';
import { applyBSP, applyCascade, applyMasterStack } from './layout_algorithms.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { QuickTilerOverlay } from './quick_tiler.js';
import { LifecycleMediator, WindowBootstrapper } from './lifecycle.js';

export default class TilingManager {
    constructor(settings) {
        this.settings = settings;
        this._enabled = false;
        this._activeOverlay = null;

        this.activeLayoutName = null;
        this.isDesignerActive = false;
        this._designerRoot = null;
        this._indicator = null;
        this._quickTiler = null;
        this._autoTilingTimerId = 0;
        this._saveTimerId = 0;
        this._bootstrappers = new Map();

        this.storage = new LayoutStorage(this);
        this.snapEngine = new SnapEngine(this);
        this.stackManager = new StackManager(this);
        
        this.mediator = new LifecycleMediator(this._log.bind(this));
    }

    _log(msg) {
        if (!this.settings.get_boolean('enable-debug-logs')) return;
        let now = GLib.DateTime.new_now_local();
        let ms = now.get_microsecond().toString().padStart(6, '0').substring(0, 3);
        console.log(`[OmniPanel-Debug] [${now.format('%H:%M:%S')}.${ms}] ${msg}`);
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;
        this._log("Extension ENABLED. Registering listeners via Object tracking.");

        this.settings.set_boolean('designer-active', false);
        
        this.settings.connectObject(
            'changed::designer-active', () => {
                let isActive = this.settings.get_boolean('designer-active');
                if (isActive && !this.isDesignerActive) {
                    this.startZoneDesigner();
                } else if (!isActive && this.isDesignerActive) {
                    this.stopZoneDesigner();
                }
            },
            'changed::named-layouts', () => {
                let layouts = {};
                try { layouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch (e) { this._log(`JSON Parse Error: ${e}`); }
                if (this.activeLayoutName && !layouts[this.activeLayoutName]) {
                    this._log(`Active layout [${this.activeLayoutName}] was deleted. Purging unmanaged zones.`);
                    this.activeLayoutName = null;
                    this.settings.set_string('custom-sections', '{}');
                    this.stackManager.clearOverlays();
                    if (this.isDesignerActive) {
                        this.settings.set_boolean('designer-active', false);
                    }
                }
            },
            this
        );

        Main.layoutManager.connectObject('monitors-changed', () => this.storage.onMonitorsChanged(), this);
        
        global.display.connectObject(
            'window-created', (d, w) => {
                let winId = w ? w.get_id() : Math.random().toString();
                if (this._bootstrappers.has(winId)) {
                    this._bootstrappers.get(winId).cleanup();
                }
                let bs = new WindowBootstrapper(w, this.mediator, this.settings, this._log.bind(this), this._executePlacement.bind(this), this);
                bs.onDestroy = () => this._bootstrappers.delete(winId);
                this._bootstrappers.set(winId, bs);
            },
            'grab-op-begin', (d, w, o) => this.snapEngine.onGrabBegin(d, w, o),
            'grab-op-end', (d, w, o) => this.snapEngine.onGrabEnd(d, w, o),
            this
        );
        
        global.workspace_manager.connectObject('workspace-switched', () => this.queueAutoTiling(), this);
        
        this.mediator.bindShortcut('snap-left', this.settings, () => this.snapEngine.snapDirection('left'));
        this.mediator.bindShortcut('snap-right', this.settings, () => this.snapEngine.snapDirection('right'));
        this.mediator.bindShortcut('snap-up', this.settings, () => this.snapEngine.snapDirection('up'));
        this.mediator.bindShortcut('snap-down', this.settings, () => this.snapEngine.snapDirection('down'));
        this.mediator.bindShortcut('switch-layout', this.settings, () => this.cycleLayouts());
        this.mediator.bindShortcut('quick-tiler-hotkey', this.settings, () => this.showQuickTiler());

        for (let i = 1; i <= 9; i++) {
            this.mediator.bindShortcut(`layout-hotkey-${i}`, this.settings, () => this.activateLayoutBySlot(i));
        }

        let defaultLayout = this.settings.get_string('default-layout');
        if (defaultLayout) {
            this.mediator.addTimer(0, () => {
                this.storage.restoreNamedLayout(defaultLayout);
                return GLib.SOURCE_REMOVE;
            });
        }

        this.stackManager.enable();
        
        this._saveTimerId = this.mediator.addTimerSeconds(5, () => {
            this.storage.saveCurrentLayoutStates();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        this._enabled = false;
        this._log("Extension DISABLED.");

        if (this._saveTimerId) {
            this.mediator.clearTimer(this._saveTimerId);
            this._saveTimerId = 0;
        }

        this.settings.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        global.display.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);

        this.stackManager.disable();
        this.snapEngine.disable();

        for (let bs of this._bootstrappers.values()) {
            bs.cleanup();
        }
        this._bootstrappers.clear();

        this.mediator.destroy();

        if (this._quickTiler) {
            this._quickTiler.close();
            this._quickTiler = null;
        }

        if (this._activeOverlay) {
            if (Main.layoutManager.uiGroup.contains(this._activeOverlay)) {
                Main.popModal(this._activeOverlay);
                Main.layoutManager.uiGroup.remove_child(this._activeOverlay);
            }
            this._activeOverlay.destroy();
            this._activeOverlay = null;
        }

        this.stopZoneDesigner();
    }

    showQuickTiler() {
        if (this._quickTiler) {
            this._quickTiler.close();
            this._quickTiler = null;
        }
        this._quickTiler = new QuickTilerOverlay(this);
    }

    queueAutoTiling() {
        if (!this.settings.get_boolean('auto-tiling-enabled')) return;
        if (this._autoTilingTimerId) {
            this.mediator.clearTimer(this._autoTilingTimerId);
        }
        this._autoTilingTimerId = this.mediator.addTimer(100, () => {
            this._autoTilingTimerId = 0;
            this.doAutoTiling();
            return GLib.SOURCE_REMOVE;
        });
    }

    doAutoTiling() {
        if (!this.settings.get_boolean('auto-tiling-enabled')) return;
        let mode = this.settings.get_string('auto-tiling-mode');
        let gap = this.settings.get_int('auto-tiling-gap');
        let workspace = global.workspace_manager.get_active_workspace();
        let allWindows = global.display.get_tab_list(Meta.TabList.NORMAL, workspace);

        let monitors = Main.layoutManager.monitors;
        for (let i = 0; i < monitors.length; i++) {
            let monWindows = allWindows.filter(w => {
                if (w.get_monitor() !== i) return false;
                if (isWindowIgnored(w, this.settings)) return false;
                let actor = w.get_compositor_private();
                if (!actor || actor.is_destroyed()) return false;
                
                let wType = w.get_window_type();
                let isSkipTaskbar = w.is_skip_taskbar();
                let role = w.get_role();
                let isDialog = (wType === Meta.WindowType.DIALOG || wType === Meta.WindowType.MODAL_DIALOG || wType === Meta.WindowType.UTILITY || isSkipTaskbar || role === 'pop-up' || w.get_transient_for() !== null);

                if (w.is_override_redirect() || isDialog) return false;
                
                return true;
            });
            
            if (monWindows.length === 0) continue;

            monWindows.sort((a, b) => {
                let ida = a.get_id();
                let idb = b.get_id();
                return ida - idb;
            });

            let mon = monitors[i];
            let panelHeight = Main.panel.height;
            let wx = mon.x;
            let wy = mon.y + panelHeight;
            let ww = mon.width;
            let wh = mon.height - panelHeight;

            if (mode === 'bsp') {
                applyBSP(monWindows, wx, wy, ww, wh, gap, i, this._log.bind(this));
            } else if (mode === 'cascade') {
                applyCascade(monWindows, wx, wy, ww, wh, i, this._log.bind(this));
            } else if (mode === 'master-stack') {
                applyMasterStack(monWindows, wx, wy, ww, wh, gap, i, this._log.bind(this));
            }
        }
    }

    activateLayoutBySlot(slotId) {
        let layouts = {};
        try { layouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch (e) { this._log(`JSON Parse Error: ${e}`); return; }

        let targetName = Object.keys(layouts).find(k => layouts[k].hotkeySlot === slotId);
        if (targetName) {
            this.storage.restoreNamedLayout(targetName);
        }
    }

    cycleLayouts() {
        let layoutsStr = this.settings.get_string('named-layouts');
        let layouts = {};
        try { layouts = JSON.parse(layoutsStr); } catch (e) { this._log(`JSON Parse Error: ${e}`); return; }

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
        entry.connectObject('destroy', () => { entry = null; }, this);
        
        let btnBox = new St.BoxLayout({ vertical: false, style: 'spacing: 16px;' });
        let cancelBtn = new St.Button({ label: _('Cancel'), style: 'background-color: #444; color: white; padding: 8px 24px; border-radius: 6px;', reactive: true, can_focus: true, track_hover: true });
        let saveBtn = new St.Button({ label: _('Save'), style: 'background-color: #0078d4; color: white; padding: 8px 24px; border-radius: 6px; font-weight: bold;', reactive: true, can_focus: true, track_hover: true });

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
        if (entry) entry.grab_key_focus();

        let isClosed = false;
        let closeOverlay = (runCallback, text) => {
            if (isClosed) return;
            isClosed = true;

            if (entry && entry.clutter_text) {
                entry.clutter_text.set_cursor_visible(false);
            }

            global.stage.set_key_focus(overlay);

            if (pushedModal) {
                Main.popModal(overlay);
                pushedModal = false;
            }

            this.mediator.addIdle(() => {
                if (overlay && Main.layoutManager.uiGroup.contains(overlay)) {
                    Main.layoutManager.uiGroup.remove_child(overlay);
                }
                if (overlay) {
                    overlay.disconnectObject(this);
                    overlay.destroy();
                }
                this._activeOverlay = null;

                if (runCallback && callback) {
                    callback(text);
                }
                return GLib.SOURCE_REMOVE;
            });
        };

        cancelBtn.connectObject('clicked', () => closeOverlay(false, null), this);
        saveBtn.connectObject('clicked', () => closeOverlay(true, entry ? entry.get_text().trim() : ''), this);
        entry.clutter_text.connectObject('activate', () => closeOverlay(true, entry ? entry.get_text().trim() : ''), this);
        
        overlay.connectObject('button-press-event', () => Clutter.EVENT_STOP, this);
        overlay.connectObject('key-press-event', (_, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                closeOverlay(false, null);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }, this);
    }

    promptForLayoutName() {
        this._showPromptOverlay(_('Enter a name for the current layout:'), (name) => {
            if (name) this.storage.saveNamedLayout(name);
        });
    }

    startZoneDesigner() {
        if (this.isDesignerActive) return;
        
        if (!this.activeLayoutName) {
            this._showPromptOverlay(_('No active layout. Name this layout first:'), (name) => {
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
                if (win._omnipanel_zone && customSections[win._omnipanel_zone]) {
                    let mIndex = win._omnipanel_monitor !== undefined ? win._omnipanel_monitor : win.get_monitor();
                    if (customSections[win._omnipanel_zone].monitorIndex !== undefined) {
                        mIndex = customSections[win._omnipanel_zone].monitorIndex;
                    }

                    let rect = getSectionRect(mIndex, win._omnipanel_zone, customSections);
                    if (rect) {
                        this._log(`[Designer Sync] Repositioning window into [${win._omnipanel_zone}]`);
                        applyWindowTransform(win, mIndex, rect, false, this._log.bind(this));
                    }
                }
            }
            
            if (this.stackManager) {
                this.stackManager.invalidateSignature();
                this.stackManager.updateOverlays();
            }
        }
    }

    _executePlacement(window, wmClass, winTitle, winId) {
        this._log(`[${winId}] Starting Layout Evaluation. Class=${wmClass} Title=${winTitle}`);

        if (isWindowIgnored(window, this.settings)) {
            this._log(`[${winId}] Ignoring WM_CLASS/Title [${wmClass} / ${winTitle}] due to user ignore-list configuration.`);
            return;
        }

        if (this.settings.get_boolean('auto-tiling-enabled')) {
            this._log(`[${winId}] Auto-tiling is enabled. Triggering full workspace layout recalculation.`);
            this.queueAutoTiling();
            return;
        }

        let categories = '';
        let tracker = Shell.WindowTracker.get_default();
        if (tracker) {
            let app = tracker.get_window_app(window);
            if (app && app.get_app_info()) {
                categories = app.get_app_info().get_categories() || '';
            }
        }

        let savedData = null;

        if (this.activeLayoutName) {
            let allLayouts = {};
            try { allLayouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch (e) { this._log(`JSON Parse Error: ${e}`); }
            savedData = allLayouts[this.activeLayoutName];
        } else if (this.settings.get_boolean('auto-restore-layouts')) {
            let signatures = this.getMonitorSignature();
            let allLayouts = {};
            try { allLayouts = JSON.parse(this.settings.get_string('saved-tiling-layouts') || '{}'); } catch (e) { this._log(`JSON Parse Error: ${e}`); }

            savedData = allLayouts[signatures.exact];
            if (!savedData && this.settings.get_boolean('fuzzy-restore-monitors')) {
                let possibleSignatures = Object.keys(allLayouts);
                let fuzzyMatch = possibleSignatures.find(sig => sig.split('|').length.toString() === signatures.fuzzy);
                if (fuzzyMatch) savedData = allLayouts[fuzzyMatch];
            }
        }

        let liveZonesState = this.storage.getCustomSections();
        let windowsState = savedData ? (savedData.windows || savedData) : {};

        let layoutList = [];
        if (this.settings.get_boolean('remember-app-affinity')) {
            layoutList = windowsState[wmClass] ? (Array.isArray(windowsState[wmClass]) ? windowsState[wmClass] : [windowsState[wmClass]]) : [];
        }
        
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
        let fuzzyData = null;
        if (this.settings.get_boolean('enable-smart-placement')) {
            let appDictStr = this.settings.get_string('app-dictionary');
            let catMapStr = this.settings.get_string('category-map');
            
            let appDict = undefined;
            if (appDictStr && appDictStr.trim() !== '') {
                try { appDict = JSON.parse(appDictStr); } catch (e) { this._log(`JSON Parse Error: ${e}`); }
            }
            
            let catMap = undefined;
            if (catMapStr && catMapStr.trim() !== '') {
                try { catMap = JSON.parse(catMapStr); } catch (e) { this._log(`JSON Parse Error: ${e}`); }
            }

            fuzzyData = fuzzyMatchAppToZone(wmClass, winTitle, categories, Object.keys(liveZonesState), appDict, catMap);
            if (fuzzyData) {
                matchedZone = fuzzyData.zone;
            }
        }

        let targetRect = null;
        let targetMonitor = 0;
        let isMax = false;
        let targetZoneName = null;

        let hasExplicitSection = layout && layout.section && (liveZonesState[layout.section] || Object.values(Sections).includes(layout.section));

        let parent = window.get_transient_for();
        let wType = window.get_window_type();
        let isSkipTaskbar = window.is_skip_taskbar();
        let role = window.get_role();

        let isDialog = (wType === Meta.WindowType.DIALOG || wType === Meta.WindowType.MODAL_DIALOG || wType === Meta.WindowType.UTILITY || isSkipTaskbar || role === 'pop-up' || parent !== null);

        if (fuzzyData && fuzzyData.isExplicit) {
            targetZoneName = fuzzyData.zone;
            isDialog = false;
        } else if (parent && parent._omnipanel_zone) {
            targetZoneName = parent._omnipanel_zone;
            targetMonitor = parent._omnipanel_monitor !== undefined ? parent._omnipanel_monitor : parent.get_monitor();
        } else if (hasExplicitSection) {
            targetZoneName = layout.section;
        } else if (matchedZone) {
            targetZoneName = matchedZone;
        }

        if (targetZoneName) {
            this._log(`[${winId}] MATCH FOUND: Zone [${targetZoneName}]`);
            if (!parent || parent._omnipanel_monitor === undefined) {
                targetMonitor = liveZonesState[targetZoneName] && liveZonesState[targetZoneName].monitorIndex !== undefined ? liveZonesState[targetZoneName].monitorIndex : (layout ? layout.monitor : 0);
            }
            targetRect = getSectionRect(targetMonitor, targetZoneName, liveZonesState);
            isMax = (targetZoneName === 'maximized' || (hasExplicitSection && layout.section === 'maximized'));

            if (isDialog) {
                isMax = false;
                let currentRect = window.get_frame_rect();
                let w = currentRect.width > 10 ? currentRect.width : 400;
                let h = currentRect.height > 10 ? currentRect.height : 300;
                if (w > targetRect.width) w = targetRect.width;
                if (h > targetRect.height) h = targetRect.height;
                
                let cx = targetRect.x + (targetRect.width - w) / 2;
                let cy = targetRect.y + (targetRect.height - h) / 2;
                targetRect = { x: Math.round(cx), y: Math.round(cy), width: Math.round(w), height: Math.round(h) };
                this._log(`[${winId}] Window is Dialog/Transient. Centering in zone instead of maximizing/stretching.`);
            }

            if (targetRect) {
                window._omnipanel_zone = targetZoneName;
                window._omnipanel_monitor = targetMonitor;

                this._log(`[${winId}] Target zone resolved. Triggering applyWindowTransform on monitor ${targetMonitor}`);
                applyWindowTransform(window, targetMonitor, targetRect, isMax, this._log.bind(this));
                
                if (!isDialog) {
                    this.mediator.addTimer(200, () => {
                        if (this.stackManager) {
                            this.stackManager.invalidateSignature(targetZoneName);
                            this.stackManager.updateOverlays();
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                }
            } else {
                 this._log(`[${winId}] ERROR: getSectionRect returned null for [${targetZoneName}]`);
            }
        } else {
            this._log(`[${winId}] NO MATCH: Ignoring window. Letting GNOME handle natively.`);
        }
    }
}