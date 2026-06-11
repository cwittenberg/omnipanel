#!/bin/bash
# generate-locales.sh - translations for  locales

# Ensure the template exists first
if [ ! -f "po/omnipanel.pot" ]; then
    echo "Error: po/omnipanel.pot not found. Generate it first using:"
    echo "xgettext --from-code=UTF-8 --keyword=_ --output=po/omnipanel.pot *.js"
    exit 1
fi

LANGUAGES=(
    "ar" "as" "az" "bg" "bn" "bs" "ca" "cs" "da" "de" 
    "el" "en_GB" "eo" "es" "et" "eu" "fa" "fi" "fr" "gl" 
    "gu" "he" "hi" "hr" "hu" "id" "it" "ja" "ka" "kk" 
    "kn" "ko" "lt" "lv" "ml" "mr" "ms" "nb" "nl" "pa" 
    "pl" "pt" "pt_BR" "ro" "ru" "sk" "sl" "sr" "sv" "ta" 
    "te" "th" "tr" "uk" "ur" "vi" "zh_CN" "zh_HK" "zh_TW"
)

echo "================================================="
echo " OmniPanel Native Internationalization Automator"
echo "================================================="
echo "Choose an action:"
echo "1) Initialize blank template files (.po) for all 50 languages"
echo "2) Compile existing translations (.po) into production binaries (.mo)"
read -p "Enter choice (1 or 2): " CHOICE

case $CHOICE in
    1)
        echo "Initializing .po files..."
        for LANG in "${LANGUAGES[@]}"; do
            FILE="po/${LANG}.po"
            if [ -f "$FILE" ]; then
                echo "[-] $FILE already exists. Skipping initialization."
            else
                echo "[+] Initializing $FILE..."
                # msginit builds the language profile using the base template
                msginit --no-translator --input=po/omnipanel.pot --locale="$LANG" --output="$FILE" 2>/dev/null
            fi
        done
        echo "Done! Hand the generated .po files in the 'po/' directory over to your translators."
        ;;
    2)
        echo "Compiling tracking translations..."
        for LANG in "${LANGUAGES[@]}"; do
            PO_FILE="po/${LANG}.po"
            MO_DIR="locale/${LANG}/LC_MESSAGES"
            
            if [ -f "$PO_FILE" ]; then
                echo "[*] Compiling binaries for: $LANG"
                mkdir -p "$MO_DIR"
                msgfmt "$PO_FILE" -o "${MO_DIR}/omnipanel.mo"
            fi
        done
        echo "Compilation check complete. All translated binaries are ready inside the 'locale/' tree."
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac