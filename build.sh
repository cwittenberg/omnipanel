#!/bin/bash
# build.sh - OmniPanel packaging script for EGO submission

# Define paths
EXTENSIONS_DIR="$HOME/.local/share/gnome-shell/extensions"
EXT_NAME="omnipanel@christian"
ZIP_NAME="omnipanel@christian.shell-extension.zip"

echo "========================================"
echo " Building OmniPanel for GNOME Extensions"
echo "========================================"

# Navigate to the PARENT directory of the extension
cd "$EXTENSIONS_DIR" || { echo "Error: Could not find extensions directory at $EXTENSIONS_DIR"; exit 1; }

echo "[1/5] Running ESLint static analysis..."
cd "$EXT_NAME" || exit 1
if [ ! -d "node_modules" ]; then
    npm install
fi
npx eslint . || { echo "========================================"; echo " ERROR: ESLint found issues. Please fix them before building a release for EGO."; echo "========================================"; exit 1; }

rm -rf node_modules

cd ..



echo "[2/5] Compiling GSettings schemas..."
# Compile schemas inside the target extension folder
glib-compile-schemas "$EXT_NAME/schemas/"

echo "[3/5] Removing previous build artifacts..."
rm -f "$ZIP_NAME"

echo "[4/5] Packaging extension..."
# The pack command points to the extension folder from the parent directory
gnome-extensions pack "$EXT_NAME" \
    --extra-source=schemas/ \
    --extra-source=locale/ \
    --extra-source=logo.png \
    --extra-source=defaults.js \
    --extra-source=layout_definitions.js \
    --extra-source=layout_indicator.js \
    --extra-source=layout_storage.js \
    --extra-source=panel_mover.js \
    --extra-source=prefs_components.js \
    --extra-source=prefs_guide_about.js \
    --extra-source=prefs_hotkeys.js \
    --extra-source=prefs_tiling.js \
    --extra-source=prefs_topbar.js \
    --extra-source=show_desktop_button.js \
    --extra-source=snap_engine.js \
    --extra-source=stack_manager.js \
    --extra-source=tiling_manager.js \
    --extra-source=zone_designer.js \
    --extra-source=transform_wayland.js \
    --extra-source=transform_x11.js \
    --extra-source=window_manager_adapter.js \
    --extra-source=quick_tiler.js \
    --extra-source=lifecycle.js \
    --extra-source=layout_algorithms.js \
    --extra-source=README.md \
    --extra-source=LICENSE \
    --force



echo "[5/5] Verifying build..."
if [ -f "$ZIP_NAME" ]; then
    echo "========================================"
    echo " SUCCESS! "
    echo "========================================"
    echo "Your submission file is ready:"
    echo "$EXTENSIONS_DIR/$ZIP_NAME"
    echo "Upload this exact .zip file to extensions.gnome.org"
else
    echo "========================================"
    echo " ERROR: Packaging failed."
    echo "========================================"
    exit 1
fi