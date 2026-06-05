// omnipanel/layout_storage.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { getSectionRect, identifySection, calculateTitleSimilarity, isWindowValid, isWindowIgnored } from './layout_definitions.js';
import { applyWindowTransform } from './window_manager_adapter.js';

export class LayoutStorage {
    constructor(manager) {
        this.manager = manager;
        this.settings = manager.settings;
    }

    getCustomSections() {
        try { return JSON.parse(this.settings.get_string('custom-sections') || '{}'); } 
        catch { return {}; }
    }
    
    setCustomSectionsAndSave(zones) {
        this.settings.set_string('custom-sections', JSON.stringify(zones));
        
        if (this.manager.activeLayoutName) {
            let allLayouts = {};
            try { allLayouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { }
            if (allLayouts[this.manager.activeLayoutName]) {
                allLayouts[this.manager.activeLayoutName].zones = zones;
                this.settings.set_string('named-layouts', JSON.stringify(allLayouts));
            }
        }
    }

    getCurrentLayoutState() {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL, null);
        let customSections = this.getCustomSections();
        let layoutState = {};
        
        for (let window of windows) {
            try {
                if (!window || !window.get_display()) continue;
                if (window.is_override_redirect()) continue;
                if (window.get_transient_for() !== null) continue;
                if (isWindowIgnored(window, this.settings)) continue;
                
                let monitorIndex = window.get_monitor();
                let section = null;
                
                if (window._omnipanel_zone && customSections[window._omnipanel_zone]) {
                    section = window._omnipanel_zone;
                } else {
                    let rect = window.get_frame_rect();
                    section = identifySection(rect, monitorIndex, customSections);
                }
                
                let wmClass = window.get_wm_class();
                if (!wmClass) continue;
                if (!layoutState[wmClass]) layoutState[wmClass] = [];
                
                let title = window.get_title() || '';
                if (section) {
                    layoutState[wmClass].push({ title: title, monitor: monitorIndex, section: section });
                }
            } catch { }
        }
        return layoutState;
    }

    saveCurrentLayoutStates() {
        let state = this.getCurrentLayoutState();
        let zones = this.getCustomSections();
        
        let usedZones = new Set();
        for (let wmClass in state) {
            for (let win of state[wmClass]) {
                if (win.section) usedZones.add(win.section);
            }
        }

        let zonesModified = false;
        for (let zName in zones) {
            if (zName.startsWith('__unnamed_') && !usedZones.has(zName)) {
                delete zones[zName];
                zonesModified = true;
            }
        }

        if (zonesModified) {
            this.setCustomSectionsAndSave(zones);
            zones = this.getCustomSections(); 
        }

        if (this.settings.get_boolean('auto-restore-layouts')) {
            let signatures = this.manager.getMonitorSignature();
            let allLayouts = {};
            try { allLayouts = JSON.parse(this.settings.get_string('saved-tiling-layouts') || '{}'); } catch { }
            let existingWindows = allLayouts[signatures.exact] ? (allLayouts[signatures.exact].windows || {}) : {};
            let mergedWindows = { ...existingWindows, ...state };
            allLayouts[signatures.exact] = { windows: mergedWindows, zones: zones };
            this.settings.set_string('saved-tiling-layouts', JSON.stringify(allLayouts));
        }

        if (this.manager.activeLayoutName) {
            let namedLayouts = {};
            try { namedLayouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { }
            
            if (namedLayouts[this.manager.activeLayoutName]) {
                let target = namedLayouts[this.manager.activeLayoutName];
                let existingWindows = target.windows || {};
                
                let mergedWindows = { ...existingWindows, ...state };
                
                let existingColor = target.color || 'rgba(46, 204, 113, 1.0)';
                let existingSlot = target.hotkeySlot || null;
                let existingText = target.hotkeyText || null;
                
                namedLayouts[this.manager.activeLayoutName] = { windows: mergedWindows, zones: zones, color: existingColor };
                if (existingSlot) namedLayouts[this.manager.activeLayoutName].hotkeySlot = existingSlot;
                if (existingText) namedLayouts[this.manager.activeLayoutName].hotkeyText = existingText;
                this.settings.set_string('named-layouts', JSON.stringify(namedLayouts));
            }
        }
    }

    saveNamedLayout(name) {
        let state = this.getCurrentLayoutState();
        let zones = this.getCustomSections();
        let allLayouts = {};
        try { allLayouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { }
        
        let existingWindows = allLayouts[name] ? (allLayouts[name].windows || {}) : {};
        let mergedWindows = { ...existingWindows, ...state };
        let existingColor = allLayouts[name] && allLayouts[name].color ? allLayouts[name].color : 'rgba(46, 204, 113, 1.0)';
        let existingSlot = allLayouts[name] && allLayouts[name].hotkeySlot ? allLayouts[name].hotkeySlot : null;
        let existingText = allLayouts[name] && allLayouts[name].hotkeyText ? allLayouts[name].hotkeyText : null;
        
        if (!existingSlot) {
            let usedSlots = Object.values(allLayouts).map(l => l.hotkeySlot).filter(s => s);
            existingSlot = [1,2,3,4,5,6,7,8,9].find(s => !usedSlots.includes(s)) || 1;
        }
        
        allLayouts[name] = { windows: mergedWindows, zones: zones, color: existingColor, hotkeySlot: existingSlot };
        if (existingText) allLayouts[name].hotkeyText = existingText;
        
        this.settings.set_string('named-layouts', JSON.stringify(allLayouts));
        this.manager.activeLayoutName = name;

        if (this.manager._indicator) {
            this.manager._indicator._rebuildMenu();
        }
        if (!this.settings.get_string('default-layout')) {
            this.settings.set_string('default-layout', name);
        }
    }

    saveCustomZoneRect(name, rect, monitorIndex) {
        let safeMonitorIndex = Math.max(0, monitorIndex);
        let monitor = Main.layoutManager.monitors[safeMonitorIndex];
        if (!monitor) return;
        
        let panelHeight = Main.panel.height;
        let workAreaY = monitor.y + panelHeight;
        let workAreaHeight = monitor.height - panelHeight;

        let rx = (rect.x - monitor.x) / monitor.width;
        let ry = (rect.y - workAreaY) / workAreaHeight;
        let rw = rect.width / monitor.width;
        let rh = rect.height / workAreaHeight;

        rx = Number.isFinite(rx) ? rx : 0;
        ry = Number.isFinite(ry) ? ry : 0;
        rw = Number.isFinite(rw) ? Math.max(0.05, rw) : 0.2;
        rh = Number.isFinite(rh) ? Math.max(0.05, rh) : 0.2;

        const COLORS = ['#e74c3c', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#2ecc71', '#34495e', '#ff7979', '#badc58'];
        let allZones = this.getCustomSections();
        let existing = allZones[name] || {};
        
        let color = existing.color;
        if (!color) {
            let used = Object.values(allZones).map(z => z.color);
            let available = COLORS.filter(c => !used.includes(c));
            color = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : COLORS[Math.floor(Math.random() * COLORS.length)];
        }

        allZones[name] = { 
            ...existing,
            rx, ry, rw, rh, monitorIndex: safeMonitorIndex, 
            color: color, 
            hotkeySlot: existing.hotkeySlot || 0 
        };
        this.setCustomSectionsAndSave(allZones);
    }

    restoreNamedLayout(name) {
        if (!name) return;
        let namedLayouts = {};
        try { namedLayouts = JSON.parse(this.settings.get_string('named-layouts') || '{}'); } catch { return; }
        
        let layout = namedLayouts[name];
        if (layout) {
            this.manager.activeLayoutName = name;
            let zones = layout.zones || {};
            let windows = layout.windows || {};
            
            this.settings.set_string('custom-sections', JSON.stringify(zones));
            this.restoreLayout(windows, zones);
            
            if (this.manager._indicator) {
                this.manager._indicator._rebuildMenu();
            }
        }
    }

    restoreLayout(savedState, zonesOverride = null) {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL, null);
        let customSections = zonesOverride || this.getCustomSections();
        let availableLayouts = {};
        let fallbackLayouts = {};
        
        let rememberAffinity = this.settings.get_boolean('remember-app-affinity');

        for (let wmClass in savedState) {
            availableLayouts[wmClass] = Array.isArray(savedState[wmClass]) ? 
                JSON.parse(JSON.stringify(savedState[wmClass])) : 
                [JSON.parse(JSON.stringify(savedState[wmClass]))];
        }

        for (let window of windows) {
            try {
                if (!window || !window.get_display() || window.is_override_redirect()) continue;
                if (window.get_transient_for() !== null) continue;
                if (isWindowIgnored(window, this.settings)) continue;

                let wmClass = window.get_wm_class();
                if (!wmClass) continue;

                let hadZone = !!window._omnipanel_zone;
                let isPlaced = false;
                let matchedLayout = null;

                if (rememberAffinity) {
                    if (availableLayouts[wmClass] && availableLayouts[wmClass].length > 0) {
                        let list = availableLayouts[wmClass];
                        let winTitle = window.get_title() || '';
                        
                        let bestIdx = 0;
                        let bestScore = -1;

                        for (let i = 0; i < list.length; i++) {
                            let score = calculateTitleSimilarity(winTitle, list[i].title);
                            if (score > bestScore) {
                                bestScore = score;
                                bestIdx = i;
                            }
                        }

                        matchedLayout = list[bestIdx];
                        list.splice(bestIdx, 1);
                        fallbackLayouts[wmClass] = matchedLayout;
                    } else if (fallbackLayouts[wmClass]) {
                        matchedLayout = fallbackLayouts[wmClass];
                        this.manager._log(`[LayoutStorage] Rescuing extra window [${wmClass}] using fallback layout.`);
                    }
                }

                if (matchedLayout) {
                    let finalMonitor = matchedLayout.monitor;
                    if (matchedLayout.section && customSections[matchedLayout.section] && customSections[matchedLayout.section].monitorIndex !== undefined) {
                        finalMonitor = customSections[matchedLayout.section].monitorIndex;
                    }

                    let targetRect = null;
                    if (matchedLayout.section) {
                        targetRect = getSectionRect(finalMonitor, matchedLayout.section, customSections);
                    }
                    
                    if (targetRect) {
                        isPlaced = true;
                        window._omnipanel_zone = matchedLayout.section;
                        window._omnipanel_monitor = finalMonitor;
                        
                        applyWindowTransform(window, finalMonitor, targetRect, matchedLayout.section === 'maximized', this.manager._log.bind(this.manager));
                        
                        if (this.manager.stackManager && matchedLayout.section) {
                            this.manager.stackManager.invalidateSignature(matchedLayout.section);
                        }
                    }
                }

                if (!isPlaced && hadZone) {
                    this.manager._log(`[LayoutStorage] Window [${wmClass}] abandoned by layout switch. Executing Safe Ejection.`);
                    
                    delete window._omnipanel_zone;
                    delete window._omnipanel_monitor;
                    
                    let mIdx = window.get_monitor() || 0;
                    let mRect = Main.layoutManager.monitors[mIdx];
                    
                    if (mRect) {
                        let safeW = 800;
                        let safeH = 600;

                        try {
                            if (typeof window.get_min_size === 'function') {
                                let min = window.get_min_size();
                                if (min && min.length === 2) {
                                    safeW = Math.max(safeW, min[0]);
                                    safeH = Math.max(safeH, min[1]);
                                }
                            }
                        } catch {}

                        let safeX = mRect.x + Math.floor((mRect.width - safeW) / 2);
                        let safeY = mRect.y + Math.floor((mRect.height - safeH) / 2);
                        
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                            try {
                                if (isWindowValid(window)) {
                                    if (window.get_maximized() > 0) window.unmaximize(Meta.MaximizeFlags.BOTH);
                                    window.move_resize_frame(false, safeX, safeY, safeW, safeH);
                                }
                            } catch {}
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                }
            } catch {}
        }
    }

    onMonitorsChanged() {
        if (!this.settings.get_boolean('auto-restore-layouts')) return;

        let signatures = this.manager.getMonitorSignature();
        let allLayouts = {};
        try { allLayouts = JSON.parse(this.settings.get_string('saved-tiling-layouts') || '{}'); } catch { }

        let savedData = allLayouts[signatures.exact];

        if (!savedData && this.settings.get_boolean('fuzzy-restore-monitors')) {
            let possibleSignatures = Object.keys(allLayouts);
            let fuzzyMatch = possibleSignatures.find(sig => sig.split('|').length.toString() === signatures.fuzzy);
            if (fuzzyMatch) {
                savedData = allLayouts[fuzzyMatch];
            }
        }

        if (savedData) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                let windowsState = savedData.windows || savedData;
                let zonesState = savedData.zones || {};
                
                this.settings.set_string('custom-sections', JSON.stringify(zonesState));

                this.restoreLayout(windowsState, zonesState);
                return GLib.SOURCE_REMOVE;
            });
        }
    }
}