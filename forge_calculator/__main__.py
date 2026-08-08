#!/usr/bin/env python3
"""PyInstaller entry point for Forge Calculator."""

import sys

# When frozen by PyInstaller, sys._MEIPASS points to the bundle's extracted resources
# We need to add it to sys.path so the package can be found
if getattr(sys, 'frozen', False):
    # Running in a PyInstaller bundle
    bundle_dir = sys._MEIPASS
    if bundle_dir not in sys.path:
        sys.path.insert(0, bundle_dir)

from forge_calculator.app import main

if __name__ == "__main__":
    main()