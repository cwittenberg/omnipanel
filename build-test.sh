#!/bin/bash
# build-test.sh

# Capture the development directory before changing paths
PROJECT_DIR="$(pwd)"
UUID="omnipanel@christian"
ZIP_NAME="$UUID.shell-extension.zip"
PACKAGE_PATH="$PROJECT_DIR/$ZIP_NAME"

# 1. Install the missing Python virtual environment packages required by Ubuntu and NodeJS for ESLint
sudo apt update
sudo apt install python3-venv python3-full npm unzip -y

# 2. Run static analysis on JS files using ESLint in the development directory
echo "Running ESLint on JavaScript files..."
if [ ! -d "node_modules" ]; then
    npm install
fi
npx eslint . || echo "ESLint found potential JS issues. Please review them above."

# 3. Move to the extensions directory for packaging
cd ~/.local/share/gnome-shell/extensions/ || exit

# 4. MUST COMPILE SCHEMA: If schema keys changed and aren't compiled, the JS will throw GLib.Error and crash the extension
echo "Compiling GSettings schemas..."
glib-compile-schemas "$UUID/schemas/"

# 5. Clean up the broken environment and previous failed packaging attempts
rm -rf "$UUID/venv"
rm -rf shexli_env
rm -rf shexli_test_dir
rm -f "$ZIP_NAME"
rm -f "$UUID.zip"
rm -f "$PACKAGE_PATH"

# 6. Create a fresh virtual environment strictly OUTSIDE the extension folder
python3 -m venv shexli_env

# 7. Activate the environment
source shexli_env/bin/activate

# 8. Install the GNOME Shell extension linter (shexli) securely
pip install -U shexli

# 9. Pack the extension using --force to ensure a clean overwrite
echo "Packaging extension..."
gnome-extensions pack "$UUID" \
    --extra-source=schemas/ \
    --extra-source=logo.png \
    --extra-source=defaults.js \
    --extra-source=i18n.js \
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

# 10. MOVE THE ZIP BACK TO THE PROJECT DIRECTORY so you can actually see/use it!
mv "$ZIP_NAME" "$PACKAGE_PATH"

# 11. Extract the ZIP to a temporary directory to GUARANTEE shexli is reviewing the packaged files
echo "Extracting package to temporary directory for explicit Shexli review..."
mkdir -p shexli_test_dir
unzip -q "$PACKAGE_PATH" -d shexli_test_dir/

# 12. Run shexli against the EXTRACTED package contents (Using Absolute Paths)
echo "Running shexli GNOME Shell compatibility tests on packaged contents..."
TEST_DIR="$(pwd)/shexli_test_dir"
shexli "$TEST_DIR" --format text
shexli "$TEST_DIR" --format json > "$PROJECT_DIR/shexli-report.json"
echo "Shexli JSON report written to: $PROJECT_DIR/shexli-report.json"

# 13. Cleanly exit the virtual environment and remove test directory
deactivate
rm -rf shexli_test_dir
rm -rf node_modules

echo "================================================================="
echo " Package Verification:"
# Explicitly list the file so you can verify it exists in your development folder
ls -lh "$PACKAGE_PATH"
echo "================================================================="
echo "Live Runtime Testing Instructions:"
echo "1. Log out of GNOME and log back in (Wayland) or press Alt+F2 -> r (X11)."
echo "2. Monitor real-time JS errors by running this command in terminal:"
echo "   journalctl -f -o cat /usr/bin/gnome-shell | grep -i omnipanel"
echo "================================================================="