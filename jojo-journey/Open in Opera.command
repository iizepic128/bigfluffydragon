#!/bin/sh
# macOS Finder launcher. Opening the HTML from Opera's File > Open also works.
JOJO_FOLDER=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if open -a 'Opera' "$JOJO_FOLDER/JoJo-Journey.html" 2>/dev/null; then
  exit 0
elif open -a 'Opera GX' "$JOJO_FOLDER/JoJo-Journey.html" 2>/dev/null; then
  exit 0
else
  printf '%s\n' 'Open Opera, press Command+O, and select JoJo-Journey.html in this folder.'
fi
