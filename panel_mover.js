// omnipanel/panel_mover.js
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import GnomeDesktop from 'gi://GnomeDesktop';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SecondaryPanel = GObject.registerClass(
    class SecondaryPanel extends St.Widget {
        _init(monitorIndex, panelMoverInstance) {
            super._init({
                name: 'panel',
                reactive: true,
                style_class: 'panel',
             });
            this.add_style_class_name('solid');
            this._monitorIndex = monitorIndex;
            this._ext = panelMoverInstance;
            
            let monitor = Main.layoutManager.monitors[monitorIndex];
            
            this.set_size(monitor.width, Main.panel.height);
            this.set_position(monitor.x, monitor.y);
            this.layout_manager = new Clutter.BinLayout();
            
            this._leftBox = new St.BoxLayout({
                 x_expand: true, y_expand: true, x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.FILL
             });
            this._centerBox = new St.BoxLayout({
                 x_expand: true, y_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.FILL
             });
            this._rightBox = new St.BoxLayout({
                 x_expand: true, y_expand: true, x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.FILL
             });
            this.add_child(this._leftBox);
            this.add_child(this._centerBox);
            this.add_child(this._rightBox);

            // Catch the click to pass dragging to maximized windows
            this.connectObject('button-press-event', this._onButtonPress.bind(this), this);
        }

        _onButtonPress(actor, event) {
            if (event.get_source() !== actor)
                return Clutter.EVENT_PROPAGATE;

            let button = event.get_button();
            if (button !== 1) // Only react to left-clicks
                return Clutter.EVENT_PROPAGATE;

            let focusWindow = global.display.get_focus_window();
            if (!focusWindow)
                return Clutter.EVENT_PROPAGATE;

            // Ensure the window is fully maximized
            let isMaximized = focusWindow.is_maximized();

            if (!isMaximized)
                return Clutter.EVENT_PROPAGATE;

            // Ensure the maximized window is actually on the monitor the user is dragging from
            if (focusWindow.get_monitor() !== this._monitorIndex)
                return Clutter.EVENT_PROPAGATE;

            let [x, y] = event.get_coords();
            
            global.display.begin_grab_op(
                focusWindow,
                Meta.GrabOp.MOVING,
                false,
                true,
                button,
                event.get_state(),
                event.get_time(),
                x,
                y
            );

            return Clutter.EVENT_STOP;
        }
    }
);

export default class PanelMover {
    constructor(settings) {
        this._settings = settings;
        this._enabled = false;
        this._panels = [];
        this._movementLoopId = 0;
        this._activeMonitor = -1;
        this._lastTargetPanel = null;
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;

        this._createPanels();
        
        Main.layoutManager.connectObject('monitors-changed', this._createPanels.bind(this), this);
        this._settings.connectObject('changed', this._onSettingsChanged.bind(this), this);
        global.display.connectObject('grab-op-end', this._onGrabOpEnd.bind(this), this);

        this._startMovementEngine();
    }

    disable() {
        this._enabled = false;

        // Automatically clean up all signals attached to this instance
        Main.layoutManager.disconnectObject(this);
        this._settings.disconnectObject(this);
        global.display.disconnectObject(this);
        
        this._stopMovementEngine();
        
        // Pass 'true' to ensure tearing down the layout skips animations and occurs synchronously
        this._returnExtensionsToPrimary(true);
        this._removePlaceholders(Main.panel);
        this._destroyPanels();
    }

    _onGrabOpEnd(display, window, op) {
        // Only react if the operation was moving a window
        if (op !== Meta.GrabOp.MOVING || !window) return;

        let [x, y] = global.get_pointer();

        // Check if the user dropped the window on any of our secondary panels
        for (let panel of this._panels) {
            let [px, py] = panel.get_transformed_position();
            let [pw, ph] = panel.get_transformed_size();

            if (x >= px && x <= px + pw && y >= py && y <= py + ph) {
                // Force maximize the window
                window.maximize();
                break;
            }
        }
    }

    _onSettingsChanged(settings, key) {
        const movementKeys = ['movement-speed', 'highlight-active', 'active-panel-color', 'translucent-inactive', 'inactive-opacity', 'hide-inactive-panels', 'animation-style', 'show-clock'];
        
        if (key === 'movement-speed') {
            this._startMovementEngine();
        } else if (movementKeys.includes(key)) {
            this._lastTargetPanel = null; 
            this._moveBoxes(this._activeMonitor);
        }
    }

    _startMovementEngine() {
        this._stopMovementEngine();
        let speed = this._settings.get_int('movement-speed');
        
        this._movementLoopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, speed, () => {
            this._runMovementLogic();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopMovementEngine() {
        if (this._movementLoopId) {
            GLib.source_remove(this._movementLoopId);
            this._movementLoopId = 0;
        }
    }

    _createPanels() {
        this._returnExtensionsToPrimary(true);
        this._destroyPanels();

        let monitors = Main.layoutManager.monitors;
        let primaryIndex = Main.layoutManager.primaryIndex;

        this._injectPlaceholders(Main.panel, true);

        for (let i = 0; i < monitors.length; i++) {
            if (i === primaryIndex) continue;

            let panel = new SecondaryPanel(i, this);
            this._injectPlaceholders(panel, false);
            
            Main.layoutManager.addChrome(panel, { affectsStruts: true, trackFullscreen: true });
            this._panels.push(panel);
        }
        
        this._activeMonitor = -1;
        this._lastTargetPanel = null;
    }

    _destroyPanels() {
        for (let panel of this._panels) {
            this._removePlaceholders(panel);
            Main.layoutManager.removeChrome(panel);
            panel.destroy();
        }
        this._panels = [];
    }

    _injectPlaceholders(panel, isPrimary) {
        if (!panel._omniClock) {
            let clock = new St.Label({ style_class: 'clock-display', y_align: Clutter.ActorAlign.CENTER });
            let wallClock = new GnomeDesktop.WallClock();
            let binding = wallClock.bind_property('clock', clock, 'text', GObject.BindingFlags.SYNC_CREATE);
            
            clock._wallClock = wallClock; 
            clock._wallClockBinding = binding;
            clock._isOmniPlaceholder = true;
            clock._isPrimaryPlaceholder = isPrimary;
            
            panel._centerBox.insert_child_at_index(clock, 0);
            panel._omniClock = clock;

            if (isPrimary) clock.hide();
        }
    }

    _removePlaceholders(panel) {
        if (panel._omniClock) {
            panel._centerBox.remove_child(panel._omniClock);
            if (panel._omniClock._wallClockBinding) {
                panel._omniClock._wallClockBinding.unbind();
            }
            panel._omniClock.destroy();
            delete panel._omniClock;
        }
    }

    _runMovementLogic() {
        if (Main.sessionMode.isLocked) return;

        let monitorIndex = global.display.get_current_monitor();
        
        if (monitorIndex !== this._activeMonitor && monitorIndex >= 0) {
            this._activeMonitor = monitorIndex;
            this._moveBoxes(monitorIndex);
        }
    }

    _moveBoxes(monitorIndex, forceSync = false) {
        let primaryIndex = Main.layoutManager.primaryIndex;
        let targetPanel = (monitorIndex === primaryIndex) ? Main.panel : this._panels.find(p => p._monitorIndex === monitorIndex);
        
        if (!targetPanel) return;

        let allPanels = [Main.panel, ...this._panels];
        let boxNames = ['_leftBox', '_centerBox', '_rightBox'];
        
        // Overwrite animation style if we are forcefully tearing down synchronously
        let animStyle = forceSync ? 'none' : this._settings.get_string('animation-style');
        let animDuration = this._settings.get_int('animation-duration');

        let isNewSwitch = (this._lastTargetPanel !== targetPanel && this._lastTargetPanel !== null);

        if (targetPanel._omniClock) targetPanel._omniClock.hide();

        for (let boxName of boxNames) {
            let targetBox = targetPanel[boxName];
            
            for (let panel of allPanels) {
                if (panel === targetPanel) continue;
                
                let sourceBox = panel[boxName];
                if (!sourceBox) continue;

                let children = [...sourceBox.get_children()];
                for (let child of children) {
                    if (child._isOmniPlaceholder) continue;

                    sourceBox.remove_child(child);
                    targetBox.add_child(child);

                    if (isNewSwitch && animStyle !== 'none') {
                        if (animStyle === 'fade') {
                            child.opacity = 0;
                            child.ease({ opacity: 255, duration: animDuration, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
                        } else if (animStyle === 'slide') {
                            child.translation_y = -Main.panel.height;
                            child.ease({ translation_y: 0, duration: animDuration, mode: Clutter.AnimationMode.EASE_OUT_BACK });
                        } else if (animStyle === 'pop') {
                            child.set_pivot_point(0.5, 0.5);
                            child.scale_x = 0;
                            child.scale_y = 0;
                            child.ease({ scale_x: 1, scale_y: 1, duration: animDuration, mode: Clutter.AnimationMode.EASE_OUT_BACK });
                        }
                    } else {
                        child.opacity = 255;
                        child.translation_y = 0;
                        child.scale_x = 1;
                        child.scale_y = 1;
                    }
                }
            }
        }

        let highlightActive = this._settings.get_boolean('highlight-active');
        let activeColor = this._settings.get_string('active-panel-color');
        let hideInactive = this._settings.get_boolean('hide-inactive-panels');
        let translucentInactive = this._settings.get_boolean('translucent-inactive');
        let inactiveOpacity = this._settings.get_double('inactive-opacity');

        for (let panel of allPanels) {
            let isActive = (panel === targetPanel);
            
            if (isActive && highlightActive) {
                panel.set_style('background-color: ' + activeColor + ';');
            } else {
                panel.set_style(null);
            }

            let targetPanelOpacity = 255;
            if (!isActive) {
                if (hideInactive) targetPanelOpacity = 0;
                else if (translucentInactive) targetPanelOpacity = Math.round(inactiveOpacity * 255);
            }

            if (isNewSwitch && animStyle !== 'none') {
                panel.ease({ opacity: targetPanelOpacity, duration: animDuration, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
            } else {
                panel.opacity = targetPanelOpacity;
            }
            
            panel.reactive = (targetPanelOpacity > 0);

            if (!isActive) {
                if (panel._omniClock) {
                    if (!panel._omniClock._isPrimaryPlaceholder || this._settings.get_boolean('show-clock')) {
                        panel._omniClock.show();

                        if (isNewSwitch && animStyle === 'fade') {
                            panel._omniClock.opacity = 0;
                            panel._omniClock.ease({ opacity: 255, duration: animDuration, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
                        } else {
                            panel._omniClock.opacity = 255;
                        }
                    } else {
                        panel._omniClock.hide();
                    }
                }
            }
        }

        this._lastTargetPanel = targetPanel;
    }
    
    _returnExtensionsToPrimary(forceSync = false) {
        let primaryIndex = null;
        if (Main.layoutManager) {
            primaryIndex = Main.layoutManager.primaryIndex;
        }

        if (primaryIndex !== null && primaryIndex !== undefined && primaryIndex >= 0) {
            this._activeMonitor = primaryIndex;
            this._lastTargetPanel = null;
            this._moveBoxes(primaryIndex, forceSync);
        }
    }
}