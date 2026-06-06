---
name: Bug report
about: Create a report to help us improve
title: ''
labels: ''
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Debug log**
- In About screen of the Extension enable debug
- Then run journalctl -f -o cat /usr/bin/gnome-shell | tee -a ~/gnome-shell.log
- Include output of gnome-shell.log in your bug report please.

**Information (please complete the following):**
 - OmniPanel version: [e.g. v10.0]
 - Wayland or X11? If you don't know run `echo "$XDG_SESSION_TYPE`
 - GNOME version: [e.g. 46, 50]. If you don't know, run `gnome-shell --version`

**Additional context**
Add any other context about the problem here.