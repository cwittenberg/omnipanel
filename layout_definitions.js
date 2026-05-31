// layout_definitions.js
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

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

export function isWindowValid(window) {
    if (!window) return false;
    if (window._omnipanel_is_dead === true) return false;
    try {
        if (typeof window.is_disposed === 'function' && window.is_disposed()) return false;
        let actor = window.get_compositor_private();
        if (!actor) return false;
        if (typeof actor.is_destroyed === 'function' && actor.is_destroyed()) return false;
    } catch { return false; }
    return true;
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
        try { layouts = JSON.parse(manager.settings.get_string('named-layouts') || '{}'); } catch {}
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

export function fuzzyMatchAppToZone(wmClass, windowTitle, categories, zoneNames) {
    if (!zoneNames || zoneNames.length === 0) return null;

    wmClass = (wmClass || '').toLowerCase();
    windowTitle = (windowTitle || '').toLowerCase();
    categories = (categories || '').toLowerCase();

    const termKeywords = ['term', 'console', 'alacritty', 'kitty', 'wezterm', 'pty', 'bash', 'zsh', 'fish', 'tmux', 'powershell', 'cmd'];
    
    let isExplicitTerminal = termKeywords.some(kw => 
        windowTitle === kw || 
        windowTitle.startsWith(`${kw} `) || 
        windowTitle.endsWith(` - ${kw}`) || 
        windowTitle.includes(` ${kw} `) ||
        windowTitle.includes(`[${kw}]`)
    );

    if (isExplicitTerminal) {
        let termZone = zoneNames.find(zn => zn.toLowerCase().includes('term') || zn.toLowerCase().includes('cli') || zn.toLowerCase().includes('console'));
        if (termZone) return { zone: termZone, isExplicit: true };
    }

    const appDictionary = [
        { zoneKeys: ['file', 'folder', 'dir'], keywords: ['file', 'nautilus', 'thunar', 'dolphin', 'caja', 'nemo', 'folder', 'pcmanfm', 'krusader', 'mc', 'ranger', 'vifm', 'spacefm', 'polo'] },
        { zoneKeys: ['code', 'dev', 'ide', 'prog'], keywords: ['code', 'ide', 'sublime', 'builder', 'webstorm', 'phpstorm', 'pycharm', 'intellij', 'cursor', 'zed', 'neovim', 'vim', 'emacs', 'eclipse', 'netbeans', 'geany', 'qtcreator', 'studio', 'xcode', 'clion', 'rubymine', 'goland', 'rider', 'kate', 'kdevelop'] },
        { zoneKeys: ['web', 'browser', 'net', 'internet'], keywords: ['web', 'browser', 'chrome', 'firefox', 'edge', 'safari', 'brave', 'vivaldi', 'opera', 'chromium', 'thorium', 'librewolf', 'waterfox', 'epiphany', 'falkon', 'midori', 'qutebrowser', 'arc', 'zen'] },
        { zoneKeys: ['term', 'console', 'cli'], keywords: termKeywords },
        { zoneKeys: ['chat', 'social', 'msg', 'talk', 'comms'], keywords: ['chat', 'slack', 'discord', 'teams', 'telegram', 'whatsapp', 'signal', 'skype', 'element', 'matrix', 'mattermost', 'viber', 'line', 'wechat', 'caprine', 'fractal', 'revolt', 'mumble', 'ts3'] },
        { zoneKeys: ['mail', 'email', 'post', 'inbox'], keywords: ['mail', 'thunderbird', 'geary', 'evolution', 'outlook', 'mailspring', 'sylpheed', 'claws', 'mutt', 'neomutt', 'kmail', 'trojita', 'bluemail', 'spark'] },
        { zoneKeys: ['music', 'audio', 'sound', 'tune'], keywords: ['music', 'spotify', 'rhythmbox', 'lollypop', 'clementine', 'audacious', 'amarok', 'deadbeef', 'quodlibet', 'cmus', 'ncmpcpp', 'tidal', 'deezer', 'amberol', 'elisa', 'tauon'] },
        { zoneKeys: ['vid', 'media', 'movie', 'tv', 'watch'], keywords: ['vid', 'media', 'vlc', 'mpv', 'player', 'obs', 'kodi', 'plex', 'jellyfin', 'smplayer', 'totem', 'celluloid', 'haruna', 'bomi', 'stremio', 'netflix'] },
        { zoneKeys: ['doc', 'office', 'write', 'note', 'text'], keywords: ['office', 'doc', 'word', 'excel', 'powerpoint', 'writer', 'calc', 'impress', 'libreoffice', 'openoffice', 'wps', 'onlyoffice', 'pdf', 'evince', 'okular', 'zathura', 'sioyek', 'notion', 'obsidian', 'logseq', 'joplin', 'marktext', 'typora'] },
        { zoneKeys: ['img', 'design', 'graphic', 'photo', 'art', 'draw', 'pic'], keywords: ['design', 'graphics', 'photo', 'image', 'img', 'gimp', 'inkscape', 'krita', 'figma', 'blender', 'darktable', 'rawtherapee', 'digikam', 'loupe', 'eog', 'gwenview', 'aseprite', 'scribus', 'penpot', 'illustrator', 'photoshop', 'paint'] },
        { zoneKeys: ['game', 'play', 'fun', 'gaming'], keywords: ['game', 'play', 'steam', 'lutris', 'heroic', 'bottles', 'retroarch', 'minecraft', 'csgo', 'dota', 'origin', 'epic', 'gog', 'minetest', 'dolphin-emu', 'rpcs3', 'yuzu', 'ryujinx', 'itch'] },
        { zoneKeys: ['sys', 'monitor', 'task', 'admin', 'tool'], keywords: ['sys', 'monitor', 'task', 'htop', 'btop', 'missioncenter', 'ksysguard', 'nvtop', 'settings', 'control', 'tweaks', 'dconf', 'gparted', 'disks', 'timeshift', 'stacer', 'bleachbit'] },
        { zoneKeys: ['db', 'data', 'sql', 'database'], keywords: ['db', 'data', 'sql', 'dbeaver', 'datagrip', 'pgadmin', 'mysql', 'redis', 'mongo', 'nosqlbooster', 'tableplus', 'beekeeper', 'heidisql', 'sqlite'] },
        { zoneKeys: ['vm', 'virt', 'container', 'docker'], keywords: ['virt', 'vm', 'virtualbox', 'vmware', 'qemu', 'boxes', 'docker', 'podman', 'kubernetes', 'k8s', 'lens', 'portainer'] },
        { zoneKeys: ['3d', 'cad', 'print'], keywords: ['3d', 'cad', 'freecad', 'autocad', 'solidworks', 'cura', 'prusaslicer', 'kicad', 'fusion360'] }
    ];

    for (let zone of zoneNames) {
        let z = zone.toLowerCase();
        for (let dict of appDictionary) {
            if (dict.zoneKeys.some(zk => z.includes(zk))) {
                if (dict.keywords.some(kw => wmClass.includes(kw))) {
                    return { zone: zone, isExplicit: false };
                }
            }
        }
    }

    const fdCategoryMap = [
        { cat: 'development', hints: ['code', 'dev', 'ide', 'prog'] },
        { cat: 'network',     hints: ['web', 'browser', 'net', 'chat', 'mail', 'internet'] },
        { cat: 'audiovideo',  hints: ['vid', 'media', 'music', 'audio', 'watch'] },
        { cat: 'office',      hints: ['doc', 'office', 'write', 'note'] },
        { cat: 'graphics',    hints: ['img', 'design', 'photo', 'graphic', 'art', 'draw'] },
        { cat: 'game',        hints: ['game', 'play', 'gaming'] },
        { cat: 'system',      hints: ['sys', 'monitor', 'task', 'term', 'console'] },
        { cat: 'utility',     hints: ['tool', 'sys', 'util'] },
        { cat: 'filemanager', hints: ['file', 'folder', 'dir'] }
    ];

    if (categories) {
        for (let c of fdCategoryMap) {
            if (categories.includes(c.cat)) {
                for (let zone of zoneNames) {
                    let z = zone.toLowerCase();
                    if (c.hints.some(hint => z.includes(hint))) {
                        return { zone: zone, isExplicit: false };
                    }
                }
            }
        }
    }

    for (let zone of zoneNames) {
        let z = zone.toLowerCase();
        if (z.length > 2 && (wmClass.includes(z) || z.includes(wmClass))) {
            return { zone: zone, isExplicit: false };
        }
    }

    for (let zone of zoneNames) {
        let z = zone.toLowerCase();
        if (z.length > 3 && windowTitle.includes(z)) {
            if (windowTitle.startsWith(z) || windowTitle.includes(` ${z}`) || windowTitle.includes(`-${z}`) || windowTitle.includes(`[${z}]`)) {
                return { zone: zone, isExplicit: false };
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

        let crx = Number(cs.rx);
        let cry = Number(cs.ry);
        let crw = Number(cs.rw);
        let crh = Number(cs.rh);

        crx = isNaN(crx) ? 0 : Math.max(0, Math.min(1, crx));
        cry = isNaN(cry) ? 0 : Math.max(0, Math.min(1, cry));
        crw = isNaN(crw) ? 0.2 : Math.max(0.05, Math.min(1, crw)); 
        crh = isNaN(crh) ? 0.2 : Math.max(0.05, Math.min(1, crh)); 

        rect.x = monitor.x + Math.round(monitor.width * crx);
        rect.y = workAreaY + Math.round(workAreaHeight * cry);
        
        rect.width = Math.max(150, Math.round(monitor.width * crw));
        rect.height = Math.max(100, Math.round(workAreaHeight * crh));
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

const _activeSources = new Set();

export function clearPendingTransforms() {
    for (let id of _activeSources) {
        GLib.source_remove(id);
    }
    _activeSources.clear();
}

export function applyWindowTransform(window, targetMonitorIndex, targetRect, isMaximized = false, logger = null) {
    if (!isWindowValid(window)) return;
    
    let winTitle = 'unknown';
    try { winTitle = window.get_title() || 'unknown'; } catch {}

    // Safely clear overlapping layout requests for this window
    if (window._omnipanel_transform_timeout) {
        GLib.source_remove(window._omnipanel_transform_timeout);
        _activeSources.delete(window._omnipanel_transform_timeout);
        window._omnipanel_transform_timeout = 0;
    }

    let targetX = Math.round(Number(targetRect.x));
    let targetY = Math.round(Number(targetRect.y));
    let targetW = Math.round(Number(targetRect.width));
    let targetH = Math.round(Number(targetRect.height));

    if (isNaN(targetX) || isNaN(targetY) || isNaN(targetW) || isNaN(targetH)) return;

    let dynamicMinW = 50;
    let dynamicMinH = 50;

    try {
        if (typeof window.get_min_size === 'function') {
            let minSize = window.get_min_size();
            if (Array.isArray(minSize) && minSize.length >= 2) {
                if (minSize[0] > 0) dynamicMinW = minSize[0];
                if (minSize[1] > 0) dynamicMinH = minSize[1];
            }
        }
    } catch {} // Removed unused e/err variable

    targetW = Math.max(dynamicMinW, targetW);
    targetH = Math.max(dynamicMinH, targetH);

    let executeResize = () => {
        if (!isWindowValid(window)) return;

        let frame = window.get_frame_rect();
        let currentMonitor = window.get_monitor();
        let isAlreadyMax = window.get_maximized() === Meta.MaximizeFlags.BOTH || window.get_maximized() === 3 || window.get_maximized() === true;
        
        if (isMaximized) {
            // Delta bypass stops Wayland flooding
            if (isAlreadyMax && currentMonitor === targetMonitorIndex) return; 

            if (logger) logger(`[applyWindowTransform] Maximizing [${winTitle}] on Monitor ${targetMonitorIndex}`);
            
            // Explicitly force the window to the correct monitor BEFORE maximizing
            if (currentMonitor !== targetMonitorIndex) {
                window.move_to_monitor(targetMonitorIndex);
            }
            if (!isAlreadyMax) {
                window.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            }
        } else {
            // Delta Bypass: Protects Wayland Ping Serial from being flooded if window is already perfectly positioned
            if (Math.abs(frame.x - targetX) <= 5 && Math.abs(frame.y - targetY) <= 5 && 
                Math.abs(frame.width - targetW) <= 5 && Math.abs(frame.height - targetH) <= 5 &&
                !isAlreadyMax && currentMonitor === targetMonitorIndex) {
                return; 
            }

            if (isAlreadyMax) {
                window.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
                // Safe Wayland Unmaximize: Wait 50ms for GTK client state resolution before applying geometry
                let t = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                    _activeSources.delete(t);
                    if (isWindowValid(window)) {
                        if (window.get_monitor() !== targetMonitorIndex) {
                            window.move_to_monitor(targetMonitorIndex);
                        }
                        window.move_resize_frame(true, targetX, targetY, targetW, targetH);
                    }
                    return GLib.SOURCE_REMOVE;
                });
                _activeSources.add(t);
            } else {
                if (logger) logger(`[applyWindowTransform] Executing move_resize_frame() on [${winTitle}] -> [X:${targetX} Y:${targetY} W:${targetW} H:${targetH}]`);
                // Explicit monitor attachment for floating snaps
                if (currentMonitor !== targetMonitorIndex) {
                    window.move_to_monitor(targetMonitorIndex);
                }
                window.move_resize_frame(true, targetX, targetY, targetW, targetH);
            }
        }
    };

    // First execution ensures snappy layout responsiveness
    executeResize();

    // Second execution guarantees the app spreads to the FULL ZONE EXTENT in case it was slow to initialize
    let tid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
        window._omnipanel_transform_timeout = 0;
        _activeSources.delete(tid);
        executeResize();
        return GLib.SOURCE_REMOVE;
    });
    
    window._omnipanel_transform_timeout = tid;
    _activeSources.add(tid);
}