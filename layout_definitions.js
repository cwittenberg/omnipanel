// omnipanel/layout_definitions.js

import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { DEFAULT_APP_DICTIONARY, DEFAULT_CATEGORY_MAP } from './defaults.js';

export const windowApi = {
    isMaximized(win) { return win.is_maximized(); },
    wasMaximized(win) { return win.is_maximized(); },
    maximize(win) { win.maximize(); },
    unmaximize(win) { win.unmaximize(); },
    moveResize(win, x, y, w, h) { win.move_resize_frame(false, x, y, w, h); }
};

export const Sections = {
    LEFT_HALF: 'left_half',
    RIGHT_HALF: 'right_half',
    TOP_HALF: 'top_half',
    BOTTOM_HALF: 'bottom_half',
    MAXIMIZED: 'maximized',
    CENTER_THIRD: 'center_third',
    LEFT_THIRD: 'left_third',
    RIGHT_THIRD: 'right_third',
    TOP_LEFT_QUAD: 'top_left_quad',
    TOP_RIGHT_QUAD: 'top_right_quad',
    BOTTOM_LEFT_QUAD: 'bottom_left_quad',
    BOTTOM_RIGHT_QUAD: 'bottom_right_quad'
};

export function isWindowIgnored(window, settings) {
    if (!window || !settings) return false;
    
    let currentIgnoreList = (settings.get_strv('ignore-wm-classes') || []).join(',');
    if (window._omnipanel_ignore_list === currentIgnoreList && window._omnipanel_ignored !== undefined) {
        return window._omnipanel_ignored;
    }

    let result = false;
    let wmClass = (window.get_wm_class() || '').toLowerCase();
    let winTitle = (window.get_title() || '').toLowerCase();
    
    if (wmClass.includes('ding') || winTitle.includes('desktop icons')) {
        result = true;
    } else {
        let wType = window.get_window_type();
        if (wType === Meta.WindowType.DESKTOP || wType === Meta.WindowType.DOCK) result = true;

        if (!result) {
            let appName = '';
            let tracker = Shell.WindowTracker.get_default();
            let app = tracker.get_window_app(window);
            if (app) {
                appName = (app.get_name() || '').toLowerCase();
            }
            
            let ignoreList = settings.get_strv('ignore-wm-classes') || [];
            
            result = ignoreList.some(cls => {
                let term = cls.trim().toLowerCase();
                if (term.length < 2) return false;
                return wmClass.includes(term) || winTitle.includes(term) || appName.includes(term);
            });
        }
    }

    window._omnipanel_ignore_list = currentIgnoreList;
    window._omnipanel_ignored = result;
    return result;
}

export function isWindowValid(window) {
    if (!window || window._omnipanel_is_dead) return false;
    let actor = window.get_compositor_private();
    return actor && !actor.is_destroyed();
}

export function hexToRgba(hex, alpha) {
    let r = 46, g = 204, b = 113;
    
    if (hex && hex.startsWith('#')) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            r = parseInt(hex.substring(0, 1).repeat(2), 16);
            g = parseInt(hex.substring(1, 2).repeat(2), 16);
            b = parseInt(hex.substring(2, 3).repeat(2), 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
    } else if (hex && hex.startsWith('rgb')) {
        return hex; 
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getLayoutColors(manager) {
    let base = 'rgba(46, 204, 113, 1.0)';
    if (manager && manager.activeLayoutName) {
        let layouts = {};
        try { 
            layouts = JSON.parse(manager.settings.get_string('named-layouts') || '{}'); 
        } catch {
            layouts = {};
        }
        
        if (layouts[manager.activeLayoutName] && layouts[manager.activeLayoutName].color) {
            base = layouts[manager.activeLayoutName].color;
        }
    }
    
    let rgbMatch = base.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        let rgb = `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`;
        return {
            border: `rgba(${rgb}, 1.0)`,
            fillNormal: `transparent`,
            fillActive: `transparent`
        };
    }
    return { border: '#2ecc71', fillNormal: 'transparent', fillActive: 'transparent' };
}

export function calculateTitleSimilarity(t1, t2) {
    if (!t1 || !t2) return 0;
    let w1 = t1.toLowerCase().split(/[\s\-_|/]+/);
    let w2 = t2.toLowerCase().split(/[\s\-_|/]+/);

    let score = 0;
    for (let w of w1) {
        if (w.length > 2 && w2.includes(w)) score++;
    }
    return score;
}

export function fuzzyMatchAppToZone(wmClass, windowTitle, categories, zoneNames, appDictionary = DEFAULT_APP_DICTIONARY, fdCategoryMap = DEFAULT_CATEGORY_MAP) {
    if (!zoneNames || zoneNames.length === 0) return null;
    if (!appDictionary || !Array.isArray(appDictionary)) appDictionary = DEFAULT_APP_DICTIONARY;
    if (!fdCategoryMap || !Array.isArray(fdCategoryMap)) fdCategoryMap = DEFAULT_CATEGORY_MAP;

    wmClass = (wmClass || '').toLowerCase().trim();
    windowTitle = (windowTitle || '').toLowerCase().trim();
    categories = (categories || '').toLowerCase().trim();

    // PRIORITY 1: Sub-app / Embedded Terminal overrides (e.g., bash inside VS Code)
    let termKeywords = ['bash', 'zsh', 'fish', 'tmux', 'pty', 'terminal', 'console', 'sh'];
    let isEmbeddedTerm = termKeywords.some(kw => windowTitle.includes(kw)) && !termKeywords.some(kw => wmClass.includes(kw));
    
    if (isEmbeddedTerm) {
        let termZone = zoneNames.find(zn => {
            let z = zn.toLowerCase().trim();
            return z.includes('term') || z.includes('cli') || z.includes('console');
        });
        if (termZone) return { zone: termZone, isExplicit: true, reason: 'Embedded Terminal Override' };
    }

    // PRIORITY 2: Dictionary Matching (Ordered by dictionary specificity)
    for (let dict of appDictionary) {
        let matchingZones = zoneNames.filter(zn => {
            let z = zn.toLowerCase().trim();
            return dict.zoneKeys.some(zk => z.includes(zk));
        });

        if (matchingZones.length > 0) {
            if (dict.keywords.some(kw => wmClass.includes(kw))) {
                return { zone: matchingZones[0], isExplicit: true, reason: `Dict wmClass match for ${matchingZones[0]}` };
            }
            if (dict.keywords.some(kw => windowTitle.includes(kw))) {
                return { zone: matchingZones[0], isExplicit: true, reason: `Dict title match for ${matchingZones[0]}` };
            }
        }
    }

    // PRIORITY 3: Exact Zone Name Matches
    for (let zone of zoneNames) {
        let z = zone.toLowerCase().trim();
        if (z.length > 2) {
            if (wmClass.includes(z) || z.includes(wmClass)) {
                return { zone: zone, isExplicit: true, reason: `Exact wmClass match for ${zone}` };
            }
            if (windowTitle.includes(z)) {
                return { zone: zone, isExplicit: true, reason: `Exact title match for ${zone}` };
            }
        }
    }

    // PRIORITY 4: Category Matching (Lower Priority -> Non-explicit fallback)
    if (categories) {
        for (let c of fdCategoryMap) {
            if (categories.includes(c.cat)) {
                for (let zone of zoneNames) {
                    let z = zone.toLowerCase().trim();
                    if (c.hints.some(hint => z.includes(hint))) {
                        return { zone: zone, isExplicit: false, reason: `GNOME Desktop Category match` };
                    }
                }
            }
        }
    }

    return null;
}

export function getSectionRect(monitorIndex, section, customSections = {}) {
    let mCount = Main.layoutManager.monitors.length;
    if (mCount === 0) return null;

    let rect = new Mtk.Rectangle();
    
    if (customSections[section] && customSections[section].rw !== undefined) {
        let cs = customSections[section];
        
        let actualMonitorIndex = cs.monitorIndex !== undefined ? cs.monitorIndex : monitorIndex;
        let safeMonitorIndex = Math.max(0, Math.min(actualMonitorIndex, mCount - 1));
        let monitor = Main.layoutManager.monitors[safeMonitorIndex];
        
        if (!monitor) return null;

        let panelHeight = Main.panel.height;
        let workAreaY = monitor.y + panelHeight;
        let workAreaHeight = monitor.height - panelHeight;
        
        let crx = Number(cs.rx) || 0;
        let cry = Number(cs.ry) || 0;
        let crw = Math.max(0.05, Number(cs.rw) || 0.2);
        let crh = Math.max(0.05, Number(cs.rh) || 0.2);
        
        rect.x = monitor.x + Math.round(monitor.width * crx);
        rect.y = workAreaY + Math.round(workAreaHeight * cry);
        rect.width = Math.max(50, Math.round(monitor.width * crw));
        rect.height = Math.max(50, Math.round(workAreaHeight * crh));

    } else {
        let safeMonitorIndex = Math.max(0, Math.min(monitorIndex, mCount - 1));
        let monitor = Main.layoutManager.monitors[safeMonitorIndex];
        
        if (!monitor) return null;

        let panelHeight = Main.panel.height;
        let workAreaY = monitor.y + panelHeight;
        let workAreaHeight = monitor.height - panelHeight;
        
        switch (section) {
            case Sections.MAXIMIZED:
                rect.x = monitor.x;
                rect.y = workAreaY;
                rect.width = monitor.width;
                rect.height = workAreaHeight;
                break;
            case Sections.LEFT_HALF:
                rect.x = monitor.x;
                rect.y = workAreaY;
                rect.width = Math.floor(monitor.width / 2);
                rect.height = workAreaHeight;
                break;
            case Sections.RIGHT_HALF:
                rect.x = monitor.x + Math.floor(monitor.width / 2);
                rect.y = workAreaY;
                rect.width = Math.ceil(monitor.width / 2);
                rect.height = workAreaHeight;
                break;
            case Sections.TOP_HALF:
                rect.x = monitor.x;
                rect.y = workAreaY;
                rect.width = monitor.width;
                rect.height = Math.floor(workAreaHeight / 2);
                break;
            case Sections.BOTTOM_HALF:
                rect.x = monitor.x;
                rect.y = workAreaY + Math.floor(workAreaHeight / 2);
                rect.width = monitor.width;
                rect.height = Math.ceil(workAreaHeight / 2);
                break;
            case Sections.CENTER_THIRD:
                rect.x = monitor.x + Math.floor(monitor.width / 3);
                rect.y = workAreaY;
                rect.width = Math.floor(monitor.width / 3);
                rect.height = workAreaHeight;
                break;
            case Sections.LEFT_THIRD:
                rect.x = monitor.x;
                rect.y = workAreaY;
                rect.width = Math.floor(monitor.width / 3);
                rect.height = workAreaHeight;
                break;
            case Sections.RIGHT_THIRD:
                rect.x = monitor.x + Math.floor((monitor.width / 3) * 2);
                rect.y = workAreaY;
                rect.width = monitor.width - rect.x;
                rect.height = workAreaHeight;
                break;
            case Sections.TOP_LEFT_QUAD:
                rect.x = monitor.x;
                rect.y = workAreaY;
                rect.width = Math.floor(monitor.width / 2);
                rect.height = Math.floor(workAreaHeight / 2);
                break;
            case Sections.TOP_RIGHT_QUAD:
                rect.x = monitor.x + Math.floor(monitor.width / 2);
                rect.y = workAreaY;
                rect.width = Math.ceil(monitor.width / 2);
                rect.height = Math.floor(workAreaHeight / 2);
                break;
            case Sections.BOTTOM_LEFT_QUAD:
                rect.x = monitor.x;
                rect.y = workAreaY + Math.floor(workAreaHeight / 2);
                rect.width = Math.floor(monitor.width / 2);
                rect.height = Math.ceil(workAreaHeight / 2);
                break;
            case Sections.BOTTOM_RIGHT_QUAD:
                rect.x = monitor.x + Math.floor(monitor.width / 2);
                rect.y = workAreaY + Math.floor(workAreaHeight / 2);
                rect.width = Math.ceil(monitor.width / 2);
                rect.height = Math.ceil(workAreaHeight / 2);
                break;
            default:
                return null;
        }
    }

    if (rect && rect.width > 0 && rect.height > 0) {
        rect.width = Math.max(50, rect.width);
        rect.height = Math.max(50, rect.height);
        return rect;
    }

    return null;
}

export function identifySection(windowRect, monitorIndex, customSections = {}) {
    let bestMatch = null;
    let minDifference = Infinity;

    let allSections = [...Object.values(Sections), ...Object.keys(customSections)];
    
    for (const section of allSections) {
        let sectionRect = getSectionRect(monitorIndex, section, customSections);
        if (!sectionRect) continue;
        
        let diff = Math.abs(windowRect.x - sectionRect.x) + 
                   Math.abs(windowRect.y - sectionRect.y) + 
                   Math.abs(windowRect.width - sectionRect.width) + 
                   Math.abs(windowRect.height - sectionRect.height);
                   
        if (diff < 400 && diff < minDifference) {
            minDifference = diff;
            bestMatch = section;
        }
    }

    return bestMatch;
}