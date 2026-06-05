// omnipanel/i18n.js
import GLib from 'gi://GLib';

export const LANGUAGES = [
    { id: 'auto', name: 'Autodetect System Language' },
    { id: 'en', name: 'English' },
    { id: 'zh', name: '简体中文 (Chinese Simplified)' },
    { id: 'es', name: 'Español (Spanish)' },
    { id: 'hi', name: 'हिन्दी (Hindi)' },
    { id: 'ar', name: 'العربية (Arabic)' },
    { id: 'pt', name: 'Português (Portuguese)' },
    { id: 'ru', name: 'Русский (Russian)' },
    { id: 'ja', name: '日本語 (Japanese)' },
    { id: 'fr', name: 'Français (French)' },
    { id: 'de', name: 'Deutsch (German)' }
];

const TRANSLATIONS = {
    en: {
        language_settings: "Language Settings",
        ui_language: "Interface Language",
        ui_language_desc: "Choose the display language for OmniPanel elements and configurations",
        layouts_title: "Layouts",
        topbar_title: "Top bar",
        hotkeys_title: "Hotkeys",
        guide_title: "Guide",
        about_title: "About"
    },
    zh: {
        language_settings: "语言设置",
        ui_language: "界面语言",
        ui_language_desc: "选择 OmniPanel 元素和配置显示的语言",
        layouts_title: "布局",
        topbar_title: "顶栏",
        hotkeys_title: "快捷键",
        guide_title: "指南",
        about_title: "关于"
    },
    es: {
        language_settings: "Configuración de Idioma",
        ui_language: "Idioma de Interfaz",
        ui_language_desc: "Elija el idioma de visualización para los elementos y configuraciones de OmniPanel",
        layouts_title: "Diseños",
        topbar_title: "Barra superior",
        hotkeys_title: "Atajos",
        guide_title: "Guía",
        about_title: "Acerca de"
    },
    hi: {
        language_settings: "भाषा सेटिंग",
        ui_language: "इंटरफ़ेस भाषा",
        ui_language_desc: "ओम्नीपैनल तत्वों और कॉन्फ़िगरेशन के लिए प्रदर्शन भाषा चुनें",
        layouts_title: "लेआउट",
        topbar_title: "शीर्ष पट्टी",
        hotkeys_title: "हॉटकीज़",
        guide_title: "मार्गदर्शिका",
        about_title: "विवरण"
    },
    ar: {
        language_settings: "إعدادات اللغة",
        ui_language: "لغة الواجهة",
        ui_language_desc: "اختر لغة العرض لعناصر وتكوينات OmniPanel",
        layouts_title: "التخطيطات",
        topbar_title: "الشريط العلوي",
        hotkeys_title: "مفاتيح الاختصار",
        guide_title: "الدليل",
        about_title: "حول"
    },
    pt: {
        language_settings: "Configurações de Idioma",
        ui_language: "Idioma da Interface",
        ui_language_desc: "Escolha o idioma de exibição para os elementos e configurações do OmniPanel",
        layouts_title: "Layouts",
        topbar_title: "Barra superior",
        hotkeys_title: "Atalhos",
        guide_title: "Guia",
        about_title: "Sobre"
    },
    ru: {
        language_settings: "Языковые настройки",
        ui_language: "Язык интерфейса",
        ui_language_desc: "Выберите язык отображения для элементов и конфигураций OmniPanel",
        layouts_title: "Макеты",
        topbar_title: "Верхняя панель",
        hotkeys_title: "Горячие клавиши",
        guide_title: "Руководство",
        about_title: "О программе"
    },
    ja: {
        language_settings: "言語設定",
        ui_language: "インターフェース言語",
        ui_language_desc: "OmniPanel の要素と設定の表示言語を選択します",
        layouts_title: "レイアウト",
        topbar_title: "トップバー",
        hotkeys_title: "ホットキー",
        guide_title: "ガイド",
        about_title: "情報"
    },
    fr: {
        language_settings: "Paramètres de Langue",
        ui_language: "Langue de l'interface",
        ui_language_desc: "Choisissez la langue d'affichage des éléments et configurations d'OmniPanel",
        layouts_title: "Dispositions",
        topbar_title: "Barre supérieure",
        hotkeys_title: "Raccourcis",
        guide_title: "Guide",
        about_title: "À propos"
    },
    de: {
        language_settings: "Spracheinstellungen",
        ui_language: "Oberflächensprache",
        ui_language_desc: "Wählen Sie die Anzeigesprache für OmniPanel-Elemente und -Konfigurationen",
        layouts_title: "Layouts",
        topbar_title: "Top-Bar",
        hotkeys_title: "Tastenkombinationen",
        guide_title: "Anleitung",
        about_title: "Über"
    }
};

export function getActiveLanguage(settings) {
    let configuredLang = settings.get_string('language') || 'auto';
    if (configuredLang !== 'auto' && TRANSLATIONS[configuredLang]) {
        return configuredLang;
    }
    
    // Autodetect language matching system locales
    let locales = GLib.get_language_names();
    for (let locale of locales) {
        let baseLang = locale.split('.')[0].split('_')[0];
        if (TRANSLATIONS[baseLang]) {
            return baseLang;
        }
    }
    return 'en'; // Default fallback
}

export function t(settings, key) {
    let lang = getActiveLanguage(settings);
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
        return TRANSLATIONS[lang][key];
    }
    // Fallback to English string if missing
    if (TRANSLATIONS['en'][key]) {
        return TRANSLATIONS['en'][key];
    }
    return key;
}