// omnipanel/defaults.js
export const DEFAULT_APP_DICTIONARY = [
    { zoneKeys: ['file', 'folder', 'dir'], keywords: ['file', 'nautilus', 'thunar', 'dolphin', 'caja', 'nemo', 'folder', 'pcmanfm', 'krusader', 'mc', 'ranger', 'vifm', 'spacefm', 'polo'] },
    { zoneKeys: ['code', 'dev', 'ide', 'prog'], keywords: ['code', 'ide', 'sublime', 'builder', 'webstorm', 'phpstorm', 'pycharm', 'intellij', 'cursor', 'zed', 'neovim', 'vim', 'emacs', 'eclipse', 'netbeans', 'geany', 'qtcreator', 'studio', 'xcode', 'clion', 'rubymine', 'goland', 'rider', 'kate', 'kdevelop'] },
    { zoneKeys: ['web', 'browser', 'net', 'internet'], keywords: ['web', 'browser', 'chrome', 'firefox', 'edge', 'safari', 'brave', 'vivaldi', 'opera', 'chromium', 'thorium', 'librewolf', 'waterfox', 'epiphany', 'falkon', 'midori', 'qutebrowser', 'arc', 'zen'] },
    { zoneKeys: ['term', 'console', 'cli', 'bash'], keywords: ['term', 'ssh','console', 'alacritty', 'kitty', 'wezterm', 'pty', 'bash', 'zsh', 'fish', 'tmux', 'powershell', 'cmd'] },
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

export const DEFAULT_CATEGORY_MAP = [
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