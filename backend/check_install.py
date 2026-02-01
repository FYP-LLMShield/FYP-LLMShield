#!/usr/bin/env python
"""Quick script to check if motor and pymongo are installed"""
try:
    import motor
    import pymongo
    print("✅ Installation Complete!")
    print(f"motor: {motor.__version__}")
    print(f"pymongo: {pymongo.__version__}")
except ImportError as e:
    print(f"Still installing or failed: {e}")
    print("Please wait for the background installation to complete.")
