#!/bin/bash

# 1. Install the missing Python virtual environment packages required by Ubuntu
sudo apt update
sudo apt install python3-venv python3-full -y

# 2. Move to the extensions directory
cd ~/.local/share/gnome-shell/extensions/

# 3. Clean up the broken environment and previous failed packaging attempts
rm -rf omnipanel@christian/venv
rm -rf shexli_env
rm -f omnipanel@christian.shell-extension.zip
rm -f omnipanel@christian.zip

# 4. Create a fresh virtual environment strictly OUTSIDE the extension folder
python3 -m venv shexli_env

# 5. Activate the environment
source shexli_env/bin/activate

# 6. Install the GNOME Shell extension linter (shexli) securely
pip install -U shexli

# 7. Pack the extension using --force to ensure a clean overwrite
gnome-extensions pack omnipanel@christian --extra-source=schemas/ --force

# 8. Run shexli against the correctly named .shell-extension.zip file
shexli omnipanel@christian.shell-extension.zip

# 9. Cleanly exit the virtual environment
deactivate