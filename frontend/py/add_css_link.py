#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os

html_file = os.path.join(os.path.dirname(__file__), 'index.html')

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the CSS link after the style.css link
old_link = '<link rel="stylesheet" href="style.css">'
new_link = '<link rel="stylesheet" href="style.css">\n    <link rel="stylesheet" href="marker-animations.css">'

if old_link in content and 'marker-animations.css' not in content:
    content = content.replace(old_link, new_link)
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("CSS link added successfully!")
else:
    print("CSS link already exists or style.css link not found")
