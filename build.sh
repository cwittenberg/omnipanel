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

echo "[1/4] Compiling GSettings schemas..."
# Compile schemas inside the target extension folder
glib-compile-schemas "$EXT_NAME/schemas/"

echo "[2/4] Removing previous build artifacts..."
rm -f "$ZIP_NAME"

echo "[3/4] Packaging extension..."
# The pack command points to the extension folder from the parent directory
gnome-extensions pack "$EXT_NAME" \
    --extra-source=schemas/ \
    --force

echo "[4/4] Verifying build..."
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