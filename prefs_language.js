// omnipanel/i18n.js
import GLib from 'gi://GLib';

export const LANGUAGES = [
    { id: 'auto', name: 'Autodetect System Language' },
    { id: 'en', name: 'English' },
    { id: 'nl', name: 'Nederlands (Dutch)' },
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

const DICTIONARY = {
    "Language": { nl: "Taal", zh: "语言", es: "Idioma", hi: "भाषा", ar: "اللغة", pt: "Idioma", ru: "Язык", ja: "言語", fr: "Langue", de: "Sprache" },
    "Language Settings": { nl: "Taalinstellingen", zh: "语言设置", es: "Configuración de Idioma", hi: "भाषा सेटिंग", ar: "إعدادات اللغة", pt: "Configurações de Idioma", ru: "Языковые настройки", ja: "言語設定", fr: "Paramètres de Langue", de: "Spracheinstellungen" },
    "Interface Language": { nl: "Interfacetaal", zh: "界面语言", es: "Idioma de Interfaz", hi: "इंटरफ़ेस भाषा", ar: "لغة الواجهة", pt: "Idioma da Interface", ru: "Язык интерфейса", ja: "インターフェース言語", fr: "Langue de l'interface", de: "Oberflächensprache" },
    "Choose the display language for OmniPanel elements and configurations": { nl: "Kies de weergavetaal voor OmniPanel-elementen en -configuraties", zh: "选择 OmniPanel 元素和配置显示的语言", es: "Elija el idioma de visualización para los elementos y configuraciones de OmniPanel", hi: "ओम्नीपैनल तत्वों और कॉन्फ़िगरेशन के लिए प्रदर्शन भाषा चुनें", ar: "اختر لغة العرض لعناصر وتكوينات OmniPanel", pt: "Escolha o idioma de exibição para os elementos e configurações do OmniPanel", ru: "Выберите язык отображения для элементов и конфигураций OmniPanel", ja: "OmniPanel の要素と設定の表示言語を選択します", fr: "Choisissez la langue d'affichage des éléments et configurations d'OmniPanel", de: "Wählen Sie die Anzeigesprache für OmniPanel-Elemente und -Konfigurationen" },
    "Layouts": { nl: "Lay-outs", zh: "布局", es: "Diseños", hi: "लेआउट", ar: "التخطيطات", pt: "Layouts", ru: "Макеты", ja: "レイアウト", fr: "Dispositions", de: "Layouts" },
    "Top bar": { nl: "Bovenste balk", zh: "顶栏", es: "Barra superior", hi: "शीर्ष पट्टी", ar: "الشريط العلوي", pt: "Barra superior", ru: "Верхняя панель", ja: "トップバー", fr: "Barre supérieure", de: "Top-Bar" },
    "Hotkeys": { nl: "Sneltoetsen", zh: "快捷键", es: "Atajos", hi: "हॉटकीज़", ar: "مفاتيح الاختصار", pt: "Atalhos", ru: "Горячие клавиши", ja: "ホットキー", fr: "Raccourcis", de: "Tastenkombinationen" },
    "Guide": { nl: "Gids", zh: "指南", es: "Guía", hi: "मार्गदर्शिका", ar: "الدليل", pt: "Guia", ru: "Руководство", ja: "ガイド", fr: "Guide", de: "Anleitung" },
    "About": { nl: "Over", zh: "关于", es: "Acerca de", hi: "विवरण", ar: "حول", pt: "Sobre", ru: "О программе", ja: "情報", fr: "À propos", de: "Über" },
    "Enable Toolbar Movement": { nl: "Werkbalkbeweging Inschakelen", zh: "启用工具栏移动", es: "Habilitar movimiento de barra", hi: "टूलबार आंदोलन सक्षम करें", ar: "تمكين حركة شريط الأدوات", pt: "Ativar movimento da barra", ru: "Включить перемещение панели", ja: "ツールバーの移動を有効にする", fr: "Activer le mouvement de la barre", de: "Toolbar-Bewegung aktivieren" },
    "Dynamically move the real native panel to the active screen": { nl: "Verplaats het echte systeempaneel dynamisch naar het actieve scherm", zh: "将真实的本机面板动态移动到活动屏幕", es: "Mueva dinámicamente el panel nativo a la pantalla activa", hi: "सक्रिय स्क्रीन पर वास्तविक मूल पैनल को गतिशील रूप से ले जाएं", ar: "نقل اللوحة الأصلية الحقيقية ديناميكيًا إلى الشاشة النشطة", pt: "Mova dinamicamente o painel nativo para a tela ativa", ru: "Динамическое перемещение настоящей панели на активный экран", ja: "実際のネイティブパネルをアクティブな画面に動的に移動します", fr: "Déplacer dynamiquement le panneau natif vers l'écran actif", de: "Das echte native Panel dynamisch auf den aktiven Bildschirm verschieben" },
    "Show Desktop Button": { nl: "Knop Bureaublad Tonen", zh: "显示桌面按钮", es: "Botón Mostrar escritorio", hi: "डेस्कटॉप बटन दिखाएं", ar: "زر إظهار سطح المكتب", pt: "Botão Mostrar Área de Trabalho", ru: "Кнопка Свернуть все", ja: "デスクトップを表示ボタン", fr: "Bouton Afficher le bureau", de: "Desktop-Button anzeigen" },
    "Enable Show Desktop Button": { nl: "Knop Bureaublad Tonen inschakelen", zh: "启用显示桌面按钮", es: "Habilitar botón Mostrar escritorio", hi: "डेस्कटॉप बटन दिखाएं सक्षम करें", ar: "تمكين زر إظهار سطح المكتب", pt: "Ativar botão Mostrar Área de Trabalho", ru: "Включить кнопку Свернуть все", ja: "デスクトップを表示ボタンを有効にする", fr: "Activer le bouton Afficher le bureau", de: "Desktop-Button anzeigen aktivieren" },
    "Adds a button to the top bar to minimize/restore windows on the current monitor": { nl: "Voegt een knop toe aan de bovenste balk om vensters op de huidige monitor te minimaliseren/herstellen", zh: "在顶栏添加一个按钮以最小化/恢复当前显示器上的窗口", es: "Agrega un botón para minimizar/restaurar ventanas en el monitor actual", hi: "वर्तमान मॉनिटर पर विंडो को छोटा/पुनर्स्थापित करने के लिए शीर्ष पट्टी में एक बटन जोड़ता है", ar: "يضيف زرًا إلى الشريط العلوي لتصغير/استعادة النوافذ على الشاشة الحالية", pt: "Adiciona um botão para minimizar/restaurar janelas no monitor atual", ru: "Добавляет кнопку на верхнюю панель для сворачивания/восстановления окон", ja: "現在のモニターのウィンドウを最小化/復元するボタンをトップバーに追加します", fr: "Ajoute un bouton à la barre pour minimiser/restaurer les fenêtres", de: "Fügt der oberen Leiste eine Schaltfläche zum Minimieren/Wiederherstellen von Fenstern hinzu" },
    "Show Desktop": { nl: "Bureaublad tonen", zh: "显示桌面", es: "Mostrar escritorio", hi: "डेस्कटॉप दिखाएं", ar: "إظهار سطح المكتب", pt: "Mostrar área de trabalho", ru: "Показать рабочий стол", ja: "デスクトップを表示", fr: "Afficher le bureau", de: "Desktop anzeigen" },
    "Animation Effects": { nl: "Animatie-effecten", zh: "动画效果", es: "Efectos de animación", hi: "एनिमेशन प्रभाव", ar: "تأثيرات الرسوم المتحركة", pt: "Efeitos de animação", ru: "Эффекты анимации", ja: "アニメーション効果", fr: "Effets d'animation", de: "Animationseffekte" },
    "Movement Animation Style": { nl: "Animatiestijl voor beweging", zh: "移动动画样式", es: "Estilo de animación de movimiento", hi: "आंदोलन एनिमेशन शैली", ar: "نمط الرسوم المتحركة للحركة", pt: "Estilo de animação de movimento", ru: "Стиль анимации движения", ja: "移動アニメーションスタイル", fr: "Style d'animation de mouvement", de: "Bewegungsanimationsstil" },
    "Active Panel Appearance": { nl: "Uiterlijk actief paneel", zh: "活动面板外观", es: "Apariencia del panel activo", hi: "सक्रिय पैनल प्रकटन", ar: "مظهر اللوحة النشطة", pt: "Aparência do painel ativo", ru: "Внешний вид активной панели", ja: "アクティブパネルの外観", fr: "Apparence du panneau actif", de: "Aussehen des aktiven Panels" },
    "Highlight Active Panel": { nl: "Actief paneel markeren", zh: "高亮活动面板", es: "Resaltar panel activo", hi: "सक्रिय पैनल हाइलाइट करें", ar: "تمييز اللوحة النشطة", pt: "Destacar painel ativo", ru: "Выделять активную панель", ja: "アクティブパネルをハイライト", fr: "Mettre en surbrillance le panneau actif", de: "Aktives Panel hervorheben" },
    "Active Panel Color": { nl: "Kleur actief paneel", zh: "活动面板颜色", es: "Color del panel activo", hi: "सक्रिय पैनल रंग", ar: "لون اللوحة النشطة", pt: "Cor do painel ativo", ru: "Цвет активной панели", ja: "アクティブパネルの色", fr: "Couleur du panneau actif", de: "Aktive Panelfarbe" },
    "Inactive Panel Appearance": { nl: "Uiterlijk inactief paneel", zh: "非活动面板外观", es: "Apariencia del panel inactivo", hi: "निष्क्रिय पैनल प्रकटन", ar: "مظهر اللوحة غير النشطة", pt: "Aparência do painel inativo", ru: "Внешний вид неактивной панели", ja: "非アクティブパネルの外観", fr: "Apparence du panneau inactif", de: "Aussehen des inaktiven Panels" },
    "Translucent Inactive Bars": { nl: "Doorschijnende inactieve balken", zh: "半透明非活动栏", es: "Barras inactivas translúcidas", hi: "पारभासी निष्क्रिय बार", ar: "أشرطة غير نشطة شفافة", pt: "Barras inativas translúcidas", ru: "Полупрозрачные неактивные панели", ja: "半透明の非アクティブバー", fr: "Barres inactives translucides", de: "Durchscheinende inaktive Leisten" },
    "Hide toolbars on inactive screens": { nl: "Werkbalken op inactieve schermen verbergen", zh: "在非活动屏幕上隐藏工具栏", es: "Ocultar barras en pantallas inactivas", hi: "निष्क्रिय स्क्रीन पर टूलबार छिपाएं", ar: "إخفاء أشرطة الأدوات على الشاشات غير النشطة", pt: "Ocultar barras em telas inativas", ru: "Скрывать панели на неактивных экранах", ja: "非アクティブな画面でツールバーを隠す", fr: "Masquer les barres sur les écrans inactifs", de: "Werkzeugleisten auf inaktiven Bildschirmen ausblenden" },
    "Directional Snapping": { nl: "Richting Uitlijnen", zh: "方向对齐", es: "Ajuste direccional", hi: "दिशात्मक स्नैपिंग", ar: "الالتقاط الاتجاهي", pt: "Ajuste Direcional", ru: "Направленное прилипание", ja: "方向スナップ", fr: "Accrochage directionnel", de: "Direktionales Einrasten" },
    "Snap Left": { nl: "Links Uitlijnen", zh: "向左对齐", es: "Ajustar a la izquierda", hi: "बाएं स्नैप करें", ar: "محاذاة لليسار", pt: "Ajustar à Esquerda", ru: "Прикрепить слева", ja: "左にスナップ", fr: "Accrocher à gauche", de: "Links einrasten" },
    "Snap Right": { nl: "Rechts Uitlijnen", zh: "向右对齐", es: "Ajustar a la derecha", hi: "दाएं स्नैप करें", ar: "محاذاة لليمين", pt: "Ajustar à Direita", ru: "Прикрепить справа", ja: "右にスナップ", fr: "Accrocher à droite", de: "Rechts einrasten" },
    "Snap Up": { nl: "Boven Uitlijnen", zh: "向上对齐", es: "Ajustar arriba", hi: "ऊपर स्नैप करें", ar: "محاذاة للأعلى", pt: "Ajustar para Cima", ru: "Прикрепить сверху", ja: "上にスナップ", fr: "Accrocher en haut", de: "Oben einrasten" },
    "Snap Down": { nl: "Onder Uitlijnen", zh: "向下对齐", es: "Ajustar abajo", hi: "नीचे स्नैप करें", ar: "محاذاة للأسفل", pt: "Ajustar para Baixo", ru: "Прикрепить снизу", ja: "下にスナップ", fr: "Accrocher en bas", de: "Unten einrasten" },
    "Cycle Layouts": { nl: "Lay-outs doorlopen", zh: "循环布局", es: "Alternar diseños", hi: "लेआउट चक्र", ar: "دورة التخطيطات", pt: "Alternar Layouts", ru: "Переключение макетов", ja: "レイアウトの切り替え", fr: "Faire défiler les dispositions", de: "Layouts durchschalten" },
    "Stack Navigation": { nl: "Stapelnavigatie", zh: "堆叠导航", es: "Navegación de pila", hi: "स्टैक नेविगेशन", ar: "التنقل في المكدس", pt: "Navegação de Pilha", ru: "Навигация по стопке", ja: "スタックナビゲーション", fr: "Navigation de la pile", de: "Stapel-Navigation" },
    "Quick Tiler (Grid Spawning)": { nl: "Snelle Tiler", zh: "快速平铺", es: "Mosaico rápido", hi: "त्वरित टाइलर", ar: "المبلط السريع", pt: "Tiler Rápido", ru: "Быстрая плитка", ja: "クイックタイラー", fr: "Tuilage rapide", de: "Quick Tiler" },
    "Enable Window Management": { nl: "Vensterbeheer Inschakelen", zh: "启用窗口管理", es: "Habilitar gestión de ventanas", hi: "विंडो प्रबंधन सक्षम करें", ar: "تمكين إدارة النوافذ", pt: "Ativar Gerenciamento de Janelas", ru: "Включить управление окнами", ja: "ウィンドウ管理を有効にする", fr: "Activer la gestion des fenêtres", de: "Fenstermanagement aktivieren" },
    "Zone Designer Mode": { nl: "Zonemaker Modus", zh: "区域设计器模式", es: "Modo de diseñador de zonas", hi: "ज़ोन डिज़ाइनर मोड", ar: "وضع مصمم المنطقة", pt: "Modo Designer de Zonas", ru: "Режим дизайнера зон", ja: "ゾーンデザイナーモード", fr: "Mode concepteur de zone", de: "Zonen-Designer-Modus" },
    "Auto-Restore Layouts": { nl: "Lay-outs Automatisch Herstellen", zh: "自动恢复布局", es: "Restaurar diseños automáticamente", hi: "लेआउट स्वतः पुनर्स्थापित करें", ar: "استعادة التخطيطات تلقائيًا", pt: "Restaurar layouts automaticamente", ru: "Авто-восстановление макетов", ja: "レイアウトの自動復元", fr: "Restaurer automatiquement les dispositions", de: "Layouts automatisch wiederherstellen" },
    "Automation & Defaults": { nl: "Automatisering & Standaardwaarden", zh: "自动化和默认值", es: "Automatización y valores predeterminados", hi: "स्वचालन और डिफ़ॉल्ट", ar: "الأتمتة والافتراضيات", pt: "Automação e Padrões", ru: "Автоматизация и настройки по умолчанию", ja: "自動化とデフォルト", fr: "Automatisation et défauts", de: "Automatisierung & Standards" },
    "Fuzzy Auto-Placement": { nl: "Fuzzy Auto-Plaatsing", zh: "模糊自动放置", es: "Colocación automática difusa", hi: "फ़ज़ी ऑटो-प्लेसमेंट", ar: "وضع تلقائي ضبابي", pt: "Colocação automática difusa", ru: "Нечеткое авторазмещение", ja: "ファジー自動配置", fr: "Placement automatique flou", de: "Fuzzy-Autoplatzierung" },
    "Window Exclusions": { nl: "Venster Uitsluitingen", zh: "窗口排除", es: "Exclusiones de ventanas", hi: "विंडो अपवर्जन", ar: "استثناءات النافذة", pt: "Exclusões de Janelas", ru: "Исключения окон", ja: "ウィンドウの除外", fr: "Exclusions de fenêtres", de: "Fensterausschlüsse" },
    "Stack Indicators": { nl: "Stapelindicatoren", zh: "堆叠指示器", es: "Indicadores de pila", hi: "स्टैक संकेतक", ar: "مؤشرات المكدس", pt: "Indicadores de Pilha", ru: "Индикаторы стопки", ja: "スタックインジケーター", fr: "Indicateurs de pile", de: "Stapelindikatoren" },
    "Default Stack Layout": { nl: "Standaard Stapel Lay-out", zh: "默认堆叠布局", es: "Diseño de pila predeterminado", hi: "डिफ़ॉल्ट स्टैक लेआउट", ar: "تخطيط المكدس الافتراضي", pt: "Layout de Pilha Padrão", ru: "Стандартный макет стопки", ja: "デフォルトのスタックレイアウト", fr: "Disposition de la pile par défaut", de: "Standard-Stapellayout" },
    "Keyboard Shortcuts": { nl: "Sneltoetsen", zh: "键盘快捷键", es: "Atajos de teclado", hi: "कीबोर्ड शॉर्टकट", ar: "اختصارات لوحة المفاتيح", pt: "Atalhos do Teclado", ru: "Сочетания клавиш", ja: "キーボードショートカット", fr: "Raccourcis clavier", de: "Tastaturkürzel" },
    "Saved Layouts & Drop Zones": { nl: "Opgeslagen Lay-outs & Drop Zones", zh: "已保存的布局和拖放区域", es: "Diseños guardados y zonas", hi: "सहेजे गए लेआउट और ड्रॉप ज़ोन", ar: "التخطيطات المحفوظة ومناطق الإسقاط", pt: "Layouts e Zonas Salvas", ru: "Сохраненные макеты и зоны", ja: "保存されたレイアウトとドロップゾーン", fr: "Dispositions et zones enregistrées", de: "Gespeicherte Layouts & Drop-Zonen" },
    "Alternative: Pure Automatic Tiling": { nl: "Alternatief: Pure Automatische Tiling", zh: "替代方案：纯自动平铺", es: "Alternativa: Mosaico automático", hi: "वैकल्पिक: शुद्ध स्वचालित टाइलिंग", ar: "البديل: تبليط تلقائي نقي", pt: "Alternativa: Mosaico Automático", ru: "Альтернатива: Чистый авто-тайлинг", ja: "代替：純粋な自動タイリング", fr: "Alternative : Tuilage automatique pur", de: "Alternative: Reines automatisches Tiling" },
    "OmniPanel Command Center": { nl: "OmniPanel Commandocentrum", zh: "OmniPanel 控制中心", es: "Centro de comandos", hi: "कमांड सेंटर", ar: "مركز أوامر", pt: "Centro de Comandos", ru: "Командный центр", ja: "コマンドセンター", fr: "Centre de commande", de: "Kommandozentrale" },
    "Multi-Monitor Top Panel": { nl: "Multi-Monitor Bovenpaneel", zh: "多显示器顶部面板", es: "Panel superior multimonitor", hi: "मल्टी-मॉनिटर टॉप पैनल", ar: "لوحة علوية متعددة الشاشات", pt: "Painel Superior Multimonitor", ru: "Мультимониторная верхняя панель", ja: "マルチモニター トップパネル", fr: "Panneau supérieur multi-écrans", de: "Multi-Monitor Top-Panel" },
    "Window Management": { nl: "Vensterbeheer", zh: "窗口管理", es: "Gestión de ventanas", hi: "विंडो प्रबंधन", ar: "إدارة النوافذ", pt: "Gerenciamento de Janelas", ru: "Управление окнами", ja: "ウィンドウ管理", fr: "Gestion des fenêtres", de: "Fenstermanagement" },
    "Quick Tiler Grid": { nl: "Snel Tiler-raster", zh: "快速平铺网格", es: "Cuadrícula de mosaico rápido", hi: "त्वरित टाइलर ग्रिड", ar: "شبكة المبلط السريع", pt: "Grade Tiler Rápida", ru: "Быстрая сетка", ja: "クイックタイラーグリッド", fr: "Grille de tuilage rapide", de: "Quick Tiler Raster" },
    "OmniPanel Settings": { nl: "OmniPanel Instellingen", zh: "OmniPanel 设置", es: "Configuración de OmniPanel", hi: "OmniPanel सेटिंग्स", ar: "إعدادات OmniPanel", pt: "Configurações do OmniPanel", ru: "Настройки OmniPanel", ja: "OmniPanelの設定", fr: "Paramètres OmniPanel", de: "OmniPanel Einstellungen" },
    "Enter a name for the current layout:": { nl: "Voer een naam in voor de huidige lay-out:", zh: "输入当前布局的名称：", es: "Ingrese un nombre para el diseño actual:", hi: "वर्तमान लेआउट के लिए एक नाम दर्ज करें:", ar: "أدخل اسمًا للتخطيط الحالي:", pt: "Insira um nome para o layout atual:", ru: "Введите имя для текущего макета:", ja: "現在のレイアウトの名前を入力：", fr: "Entrez un nom pour la disposition actuelle :", de: "Geben Sie einen Namen für das aktuelle Layout ein:" },
    "No active layout. Name this layout first:": { nl: "Geen actieve lay-out. Geef deze lay-out eerst een naam:", zh: "没有活动布局。请先命名此布局：", es: "No hay diseño activo. Nombre este diseño primero:", hi: "कोई सक्रिय लेआउट नहीं. पहले इस लेआउट को नाम दें:", ar: "لا يوجد تخطيط نشط. قم بتسمية هذا التخطيط أولاً:", pt: "Nenhum layout ativo. Nomeie este layout primeiro:", ru: "Нет активного макета. Сначала назовите этот макет:", ja: "アクティブなレイアウトなし。最初に名前を付けてください：", fr: "Aucune disposition active. Nommez-la d'abord :", de: "Kein aktives Layout. Benennen Sie dieses Layout zuerst:" },
    "Cancel": { nl: "Annuleren", zh: "取消", es: "Cancelar", hi: "रद्द करें", ar: "إلغاء", pt: "Cancelar", ru: "Отмена", ja: "キャンセル", fr: "Annuler", de: "Abbrechen" },
    "Save": { nl: "Opslaan", zh: "保存", es: "Guardar", hi: "सहेजें", ar: "حفظ", pt: "Salvar", ru: "Сохранить", ja: "保存", fr: "Enregistrer", de: "Speichern" },
    "Apply": { nl: "Toepassen", zh: "应用", es: "Aplicar", hi: "लागू करें", ar: "تطبيق", pt: "Aplicar", ru: "Применить", ja: "適用", fr: "Appliquer", de: "Anwenden" },
    "Name this Zone (or leave blank to just resize)...": { nl: "Geef deze zone een naam (of laat leeg om alleen te schalen)...", zh: "命名此区域（或留空以仅调整大小）...", es: "Nombre esta zona (o déjela en blanco para redimensionar)...", hi: "इस ज़ोन को नाम दें (या केवल आकार बदलने के लिए रिक्त छोड़ दें)...", ar: "قم بتسمية هذه المنطقة (أو اتركها فارغة لتغيير الحجم فقط)...", pt: "Nomeie esta zona (ou deixe em branco para redimensionar)...", ru: "Назовите эту зону (или оставьте пустым для изменения размера)...", ja: "ゾーンに名前を付ける（または空白でサイズ変更のみ）...", fr: "Nommez cette zone (ou laissez vide pour redimensionner)...", de: "Benennen Sie diese Zone (oder leer lassen, um nur die Größe zu ändern)..." },
    "Hold and drag to draw and expand zone (Min: 450x400)": { nl: "Houd vast en sleep om zone te tekenen en te vergroten (Min: 450x400)", zh: "按住并拖动以绘制和扩展区域（最小：450x400）", es: "Mantenga presionado y arrastre para dibujar (Mín: 450x400)", hi: "ज़ोन खींचने और विस्तारित करने के लिए पकड़ें और खींचें (न्यूनतम: 450x400)", ar: "اضغط واسحب لرسم المنطقة (الحد الأدنى: 450x400)", pt: "Segure e arraste para desenhar (Mín: 450x400)", ru: "Удерживайте и тащите для создания зоны (Мин: 450x400)", ja: "押し続けてドラッグしてゾーンを描画（最小：450x400）", fr: "Maintenez et faites glisser pour dessiner (Min : 450x400)", de: "Halten und ziehen, um die Zone zu zeichnen (Min: 450x400)" },
    "Name this Zone...": { nl: "Geef deze zone een naam...", zh: "命名此区域...", es: "Nombre esta zona...", hi: "इस ज़ोन को नाम दें...", ar: "قم بتسمية هذه المنطقة...", pt: "Nomeie esta zona...", ru: "Назовите эту зону...", ja: "このゾーンに名前を付ける...", fr: "Nommez cette zone...", de: "Benennen Sie diese Zone..." },
    "Monitor": { nl: "Monitor", zh: "显示器", es: "Monitor", hi: "मॉनिटर", ar: "شاشة", pt: "Monitor", ru: "Монитор", ja: "モニター", fr: "Écran", de: "Monitor" },
    "Click to Cycle": { nl: "Klik om te doorlopen", zh: "点击循环", es: "Haga clic para alternar", hi: "चक्र पर क्लिक करें", ar: "انقر للتبديل", pt: "Clique para alternar", ru: "Нажмите для переключения", ja: "クリックして切り替え", fr: "Cliquez pour faire défiler", de: "Klicken zum Durchschalten" },
    "New Layout Name...": { nl: "Nieuwe Lay-outnaam...", zh: "新布局名称...", es: "Nuevo nombre de diseño...", hi: "नया लेआउट नाम...", ar: "اسم التخطيط الجديد...", pt: "Novo nome de layout...", ru: "Новое имя макета...", ja: "新しいレイアウト名...", fr: "Nouveau nom de disposition...", de: "Neuer Layout-Name..." },
    "Create": { nl: "Aanmaken", zh: "创建", es: "Crear", hi: "बनाएं", ar: "إنشاء", pt: "Criar", ru: "Создать", ja: "作成", fr: "Créer", de: "Erstellen" },
    "💡 Right-click overlapping zones to send them to the back": { nl: "💡 Klik met de rechtermuisknop op overlappende zones om ze naar achteren te sturen", zh: "💡 右键单击重叠区域将其发送到后台", es: "💡 Haga clic derecho en zonas superpuestas para enviarlas atrás", hi: "💡 ओवरलैपिंग ज़ोन को पीछे भेजने के लिए राइट-क्लिक करें", ar: "💡 انقر بزر الماوس الأيمن على المناطق المتداخلة لإرسالها للخلف", pt: "💡 Clique com o botão direito nas zonas sobrepostas para enviar para trás", ru: "💡 Щелкните правой кнопкой мыши по перекрывающимся зонам, чтобы отправить их назад", ja: "💡 重なっているゾーンを右クリックして背面に送る", fr: "💡 Faites un clic droit sur les zones pour les envoyer à l'arrière", de: "💡 Rechtsklick auf überlappende Zonen, um sie in den Hintergrund zu senden" },
    "Quit Designer": { nl: "Ontwerper Afsluiten", zh: "退出设计器", es: "Salir del diseñador", hi: "डिज़ाइनर छोड़ें", ar: "إنهاء المصمم", pt: "Sair do Designer", ru: "Выйти из дизайнера", ja: "デザイナーを終了", fr: "Quitter le concepteur", de: "Designer beenden" },
    "Unnamed Zone": { nl: "Naamloze Zone", zh: "未命名区域", es: "Zona sin nombre", hi: "अनाम ज़ोन", ar: "منطقة غير مسماة", pt: "Zona sem nome", ru: "Зона без имени", ja: "無名のゾーン", fr: "Zone sans nom", de: "Unbenannte Zone" },
    "Maximize": { nl: "Maximaliseren", zh: "最大化", es: "Maximizar", hi: "बड़ा करें", ar: "تكبير", pt: "Maximizar", ru: "Развернуть", ja: "最大化", fr: "Maximiser", de: "Maximieren" }
};

export function getActiveLanguage(settings) {
    if (!settings) return 'en';
    let configuredLang = 'auto';
    try { configuredLang = settings.get_string('language'); } catch { }
    
    if (configuredLang !== 'auto' && LANGUAGES.find(l => l.id === configuredLang)) {
        return configuredLang;
    }
    
    let locales = GLib.get_language_names();
    for (let locale of locales) {
        let baseLang = locale.split('.')[0].split('_')[0];
        if (LANGUAGES.find(l => l.id === baseLang)) {
            return baseLang;
        }
    }
    return 'en';
}

export function t(settings, key) {
    let lang = getActiveLanguage(settings);
    if (lang === 'en') return key;
    
    if (DICTIONARY[key] && DICTIONARY[key][lang]) {
        return DICTIONARY[key][lang];
    }
    
    return key;
}