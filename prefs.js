// omnipanel/prefs.js
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import buildTopBarPage from './prefs_topbar.js';
import buildTilingPage from './prefs_tiling.js';
import { buildGuidePage, buildAboutPage } from './prefs_guide_about.js';
import { buildHotkeysPage } from './prefs_hotkeys.js';

export default class OmniPanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        window.add(buildTilingPage(settings, window));
        window.add(buildTopBarPage(settings));
        window.add(buildHotkeysPage());
        
        // We pass this.dir to allow loading local assets from the extension directory
        window.add(buildGuidePage(this.dir));
        window.add(buildAboutPage(settings, this.metadata, this.dir));
    }
}