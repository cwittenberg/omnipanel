#!/usr/bin/env bash
# generate-locale.sh
set -euo pipefail

DOMAIN="omnipanel"
PODIR="po"
LOCALEDIR="locale"

LANGS=(
    "ar" "bn" "en_GB" "es" "fr" "hi" "ja" "nl" "pt" "pt_BR" "ru" "zh_CN"
)

echo "Creating $PODIR directory..."
mkdir -p "$PODIR"

echo "Extracting translation strings into $PODIR/$DOMAIN.pot..."
xgettext --from-code=UTF-8 --language=JavaScript --keyword=_ \
    --output="$PODIR/$DOMAIN.pot" \
    *.js

echo "Generating or updating PO files for target languages..."
for lang in "${LANGS[@]}"; do
    if [ -f "$PODIR/$lang.po" ]; then
        echo "Updating $lang.po..."
        msgmerge --update --backup=none "$PODIR/$lang.po" "$PODIR/$DOMAIN.pot"
    else
        echo "Initializing $lang.po..."
        # We allow fallback since users' systems might not have all full locales installed to perform a perfect init
        msginit --no-translator --input="$PODIR/$DOMAIN.pot" --locale="$lang" --output="$PODIR/$lang.po" || true
    fi
done

echo "Automatically translating missing strings via Google Trans..."
python3 auto_translate.py

echo "Compiling PO files to MO format..."
for lang in "${LANGS[@]}"; do
    # Create the required directory structure for GNOME extensions
    mkdir -p "$LOCALEDIR/$lang/LC_MESSAGES"
    
    # Compile the .po file into a binary .mo file
    if [ -f "$PODIR/$lang.po" ]; then
        msgfmt "$PODIR/$lang.po" -o "$LOCALEDIR/$lang/LC_MESSAGES/$DOMAIN.mo"
        echo "Compiled $lang to $LOCALEDIR/$lang/LC_MESSAGES/$DOMAIN.mo"
    fi
done

echo "Locale generation and compilation complete!"