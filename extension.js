// extension.js
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import PanelMover from './panel_mover.js';
import TilingManager from './tiling_manager.js';
import { LayoutIndicator } from './layout_indicator.js';
import { ShowDesktopButton } from './show_desktop_button.js';
import { clearPendingTransforms } from './layout_definitions.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class OmniPanelExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._panelMover = null;
        this._tilingManager = null;
        this._indicator = null;
        this._showDesktopBtn = null;
    }

    enable() {
        this._settings = this.getSettings();
        
        this._panelMover = new PanelMover(this._settings, this);
        this._tilingManager = new TilingManager(this._settings);
        
        this._indicator = new LayoutIndicator(this._settings, this._tilingManager, this);
        this._tilingManager._indicator = this._indicator;

        this._showDesktopBtn = new ShowDesktopButton(this._settings);

        Main.panel.addToStatusArea('omnipanel-show-desktop', this._showDesktopBtn, 2, 'right');

        this._settingsChangedId = this._settings.connect('changed', this._onSettingsChanged.bind(this));

        this._applyModules();
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        if (this._panelMover) {
            this._panelMover.disable();
            this._panelMover = null;
        }

        if (this._tilingManager) {
            this._tilingManager.disable();
            this._tilingManager = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        
        if (this._showDesktopBtn) {
            this._showDesktopBtn.destroy();
            this._showDesktopBtn = null;
        }
        
        clearPendingTransforms();

        this._settings = null;
    }

    _onSettingsChanged(settings, key) {
        if (key === 'movement-enabled') {
            if (this._settings.get_boolean('movement-enabled')) {
                this._panelMover.enable();
            } else {
                this._panelMover.disable();
            }
        }
        
        if (key === 'enable-tiling') {
            if (this._settings.get_boolean('enable-tiling')) {
                this._tilingManager.enable();
            } else {
                this._tilingManager.disable();
            }
        }
    }

    _applyModules() {
        if (this._settings.get_boolean('movement-enabled')) {
            this._panelMover.enable();
        }

        if (this._settings.get_boolean('enable-tiling')) {
            this._tilingManager.enable();
        }
    }
}