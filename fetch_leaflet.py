#!/usr/bin/env python3
"""Télécharge Leaflet 1.9.4 dans lib/leaflet/ (à lancer une fois, avec Internet) :
       python3 fetch_leaflet.py
"""
import os, urllib.request
V = "1.9.4"
BASE = f"https://unpkg.com/leaflet@{V}/dist/"
FILES = ["leaflet.js", "leaflet.css", "images/marker-icon.png", "images/marker-icon-2x.png",
         "images/marker-shadow.png", "images/layers.png", "images/layers-2x.png"]
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib", "leaflet")
for f in FILES:
    dest = os.path.join(root, f)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    urllib.request.urlretrieve(BASE + f, dest)
    print("OK", f)
