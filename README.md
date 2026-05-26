# OmniPanel for GNOME Shell

**OmniPanel** is a true multi-monitor panel extension for GNOME Shell (versions 46, 47, 50, and 50.1). 

Unlike legacy multi-monitor extensions that attempt to forcefully clone and rebuild GNOME components (which frequently breaks third-party extensions and crashes the shell), OmniPanel introduces a revolutionary **Active Toolbar Movement** engine. 

Instead of cloning, OmniPanel dynamically sweeps the *real* native GNOME top bar—including all of your third-party extensions, system tray indicators, and the native calendar—directly to whichever monitor you are actively using.

## Features

* **Active Toolbar Movement:** Your true GNOME panel, including all extensions (like Clipboard Indicator), seamlessly follows your mouse to the active screen.
* **Animation Effects:** Choose between Instant, Fade, Slide Down, or Pop animations when the panel moves between screens.
* **Active Panel Highlighting:** Optionally apply a custom background color to the top bar of the currently active monitor.
* **Inactive Panel Dimming:** Make the top bars on inactive screens translucent or completely hide them to reduce distractions.
* **Zero Configuration Sync:** Because it uses the native GNOME components, your clock format (12h/24h) and all extension settings are perfectly and automatically synced.

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
This project is licensed under the GNU General Public License v2.0 (GPL-2.0).