# OmniPanel for GNOME Shell

**OmniPanel** is a true multi-monitor panel extension and advanced window management system for GNOME Shell (versions 46, 47, and 50) OmniPanel is a powerful **Window Management and Tiling** engine featuring a visual Zone Designer, smart auto-placement, directional snapping, and pure automatic tiling algorithms. OmniPanel also introduces a revolutionary **Active Toolbar Movement** engine. Instead of cloning, OmniPanel dynamically sweeps the *real* native GNOME top bar directly to whichever monitor - you are actively using. This includes all your extensions to maximize productivity.

## Features

### 🪟 Advanced Window Management & Tiling
* **Zone Designer Mode:** Visually draw, resize, and configure custom rectangular drop zones across your screens.
* **Smart Auto-Placement:** Automatically assigns new unrecognized windows to zones matching their application name, GNOME desktop metadata category, or explicitly saved app affinity.
* **Window Stacks:** Fast-switching overlay indicators automatically appear when multiple windows share the exact same drop zone, allowing you to seamlessly expand them into Stack, Column, Row, or Grid views.
* **Directional Snapping:** Intuitively snap the active window into a neighboring Drop Zone using configurable hotkeys (e.g., `Alt + Arrows`).
* **Quick Tiler:** Instantly spawn an 8x8 interactive grid (Default: `<Super>g`) on the active monitor to reshape the active window by clicking and dragging across cells.
* **Pure Automatic Tiling:** Optionally enable a master auto-tiling override to dynamically arrange all workspace windows using BSP (Binary Space Partitioning) or Cascading algorithms with configurable gaps.
* **Auto-Restore Layouts:** Seamlessly remembers and restores your saved window positions based on your current monitor setup, fully supporting fuzzy monitor matching.
* **Wayland & X11 Support:** Built-in transform strategies ensure smooth execution on both Wayland and X11 compositors.
* **Window Exclusions:** Define a comma-separated list of application names (like "steam" or "gimp") to keep OmniPanel from managing them.


### 🖥️ Multi-Monitor Top Bar
* **Active Toolbar Movement:** Your true GNOME panel, including all system tray indicators and extensions, seamlessly follows your mouse to the active screen.
* **Animation Effects:** Choose between Instant, Fade, Slide Down, or Pop animations when the panel moves between screens.
* **Panel Appearance Controls:** Apply a custom background color to the active monitor's top bar, and make inactive screens translucent or completely hide them to reduce distractions.
* **Show Desktop Button:** Adds a dedicated button to the top bar to instantly minimize and restore windows on your current monitor.
* **Zero Configuration Sync:** Because it uses the native GNOME components, your clock format and all extension settings are perfectly and automatically synced across monitors.

## Installation

1.  Create the extension directory:
    ```bash
    mkdir -p ~/.local/share/gnome-shell/extensions/omnipanel@christian/schemas
    ```
2.  Copy the extension files (`extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`) into the root of that directory.
3.  Copy the `org.gnome.shell.extensions.omnipanel.gschema.xml` file into the `schemas` directory.
4.  Compile the GSettings schema:
    ```bash
    glib-compile-schemas ~/.local/share/gnome-shell/extensions/omnipanel@christian/schemas/
    ```
5.  Log out and log back in (or restart GNOME Shell).
6.  Enable the extension via the terminal or the GNOME Extensions app:
    ```bash
    gnome-extensions enable omnipanel@christian
    ```

## Configuration

You can configure OmniPanel using the official **GNOME Extensions** app. Navigate to OmniPanel and click the gear icon to adjust movement speed, animations, opacities, and colors.

## Author
Christian Wittenberg

## License
This project is licensed under the GNU General Public License v2.0 (GPL-2.0)
