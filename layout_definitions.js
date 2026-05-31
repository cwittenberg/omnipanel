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

        rect.x = monitor.x + Math.round(monitor.width * cs.rx);
        rect.y = workAreaY + Math.round(workAreaHeight * cs.ry);
        rect.width = Math.round(monitor.width * cs.rw);
        rect.height = Math.round(workAreaHeight * cs.rh);
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
        rect.width = Math.max(100, rect.width);
        rect.height = Math.max(100, rect.height);
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

// Global map to track pending transforms and prevent race conditions using strict Window IDs
const _pendingTransforms = new Map();

export function applyWindowTransform(window, targetMonitorIndex, targetRect, isMaximized = false, zoneBounds = null) {
    if (!window || !window.get_display()) return;
    
    let targetX = Math.round(targetRect.x);
    let targetY = Math.round(targetRect.y);
    let targetW = Math.round(Math.max(100, targetRect.width));
    let targetH = Math.round(Math.max(100, targetRect.height));

    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        try {
            if (!window || !window.get_display()) return GLib.SOURCE_REMOVE;
            
            let winId = 0;
            try { winId = window.get_id(); } catch {}

            // Clear any previously queued timeout for this exact window ID to prevent race conditions
            if (winId && _pendingTransforms.has(winId)) {
                GLib.source_remove(_pendingTransforms.get(winId));
                _pendingTransforms.delete(winId);
            }

            let apply = () => {
                if (isMaximized) {
                    if (!window.get_maximized()) {
                        window.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
                    }
                } else {
                    if (window.get_maximized()) {
                        window.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
                    }
                    window.move_resize_frame(false, targetX, targetY, targetW, targetH);
                }
            };

            // Apply size immediately
            apply();

            // Queue secondary fallback size to override app-default map initializations
            let tId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
                try {
                    if (window && window.get_display()) {
                        apply(); 
                        
                        // Post-resize bounds check to prevent spillover from GTK4 minimum sizes
                        if (!isMaximized && zoneBounds) {
                            let cRect = window.get_frame_rect();
                            let fixY = cRect.y;
                            let fixX = cRect.x;
                            let changed = false;

                            // If bottom edge goes past zone bottom, pull it up
                            if (cRect.y + cRect.height > zoneBounds.y + zoneBounds.height) {
                                fixY = (zoneBounds.y + zoneBounds.height) - cRect.height;
                                changed = true;
                            }
                            // If right edge goes past zone right, pull it left
                            if (cRect.x + cRect.width > zoneBounds.x + zoneBounds.width) {
                                fixX = (zoneBounds.x + zoneBounds.width) - cRect.width;
                                changed = true;
                            }
                            
                            // Never pull the window out of the top or left of the zone
                            // This ensures if the window is completely larger than the entire zone, it anchors top-left.
                            if (fixY < zoneBounds.y) {
                                fixY = zoneBounds.y;
                                changed = true;
                            }
                            if (fixX < zoneBounds.x) {
                                fixX = zoneBounds.x;
                                changed = true;
                            }

                            if (changed) {
                                window.move_resize_frame(false, fixX, fixY, cRect.width, cRect.height);
                            }
                        }
                    }
                } catch {}
                if (winId) _pendingTransforms.delete(winId);
                return GLib.SOURCE_REMOVE;
            });
            
            if (winId) _pendingTransforms.set(winId, tId);

        } catch { }
        return GLib.SOURCE_REMOVE;
    });
}