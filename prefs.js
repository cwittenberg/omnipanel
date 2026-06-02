// omnipanel/prefs.js
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import buildTopBarPage from './prefs_topbar.js';
import buildTilingPage from './prefs_tiling.js';
import { buildGuidePage, buildAboutPage } from './prefs_guide_about.js';

export default class OmniPanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        window.add(buildTilingPage(settings, window));
        window.add(buildTopBarPage(settings));
        window.add(buildGuidePage());
        window.add(buildAboutPage(settings, this.metadata));
    }
}