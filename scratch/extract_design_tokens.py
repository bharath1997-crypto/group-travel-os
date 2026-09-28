"""Extract design tokens from Rovvy Explore v6.dc.html inline styles."""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

HTML = Path(
    r"C:\Users\bhara\AppData\Local\Temp\95d754ae-cbcf-46d3-8095-4793e85b7d0f_Web application redesign guide.zip.d0f\export\Rovvy Explore v6.dc.html"
)

text = HTML.read_text(encoding="utf-8")

# inline style attributes
styles = re.findall(r'style="([^"]*)"', text)
head_style = re.search(r"<style>(.*?)</style>", text, re.S)
if head_style:
    styles.append(head_style.group(1))

HEX = re.compile(r"#(?:[0-9A-Fa-f]{3,8})\b")
RGBA = re.compile(r"rgba?\([^)]+\)")

colors: Counter[str] = Counter()
font_combos: Counter[str] = Counter()
font_sizes: Counter[str] = Counter()
font_weights: Counter[str] = Counter()
letter_spacings: Counter[str] = Counter()
line_heights: Counter[str] = Counter()
radii: Counter[str] = Counter()
shadows: Counter[str] = Counter()
spacing: Counter[str] = Counter()
border_colors: Counter[str] = Counter()

spacing_props = {
    "padding",
    "margin",
    "gap",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
}


def norm_color(c: str) -> str:
    return c.upper()


for block in styles:
    decls = [d.strip() for d in block.split(";") if d.strip()]
    for decl in decls:
        if ":" not in decl:
            continue
        prop, val = decl.split(":", 1)
        prop = prop.strip().lower()
        val = val.strip()

        for h in HEX.findall(val):
            colors[norm_color(h)] += 1
        for r in RGBA.findall(val):
            colors[r] += 1

        if prop == "font-size":
            font_sizes[val] += 1
        if prop == "font-weight":
            font_weights[val] += 1
        if prop == "letter-spacing":
            letter_spacings[val] += 1
        if prop == "line-height":
            line_heights[val] += 1
        if prop == "border-radius":
            radii[val] += 1
        if prop == "box-shadow":
            shadows[val] += 1
        if prop.startswith("border") and "color" in prop:
            border_colors[val] += 1
        if prop in spacing_props:
            for token in re.findall(r"-?\d+(?:\.\d+)?px", val):
                spacing[token] += 1

        if prop == "font-family":
            font_combos[val] += 1

accent_bg = len(re.findall(r"data-accent-bg", text))
accent_text = len(re.findall(r"data-accent-text", text))
accent_dot = len(re.findall(r"data-accent-dot", text))

print("=== COLORS (top 40) ===")
for c, n in colors.most_common(40):
    print(f"{n:4d}  {c}")

print("\n=== FONT FAMILIES ===")
for f, n in font_combos.most_common():
    print(f"{n:4d}  {f}")

print("\n=== FONT SIZES ===")
def sort_key(item):
    s = item[0]
    if s.startswith("clamp"):
        return 999
    try:
        return float(s.replace("px", "").replace("em", ""))
    except ValueError:
        return 998

for s, n in sorted(font_sizes.items(), key=sort_key):
    print(f"{n:4d}  {s}")

print("\n=== FONT WEIGHTS ===")
for w, n in font_weights.most_common():
    print(f"{n:4d}  {w}")

print("\n=== LETTER SPACING ===")
for ls, n in letter_spacings.most_common():
    print(f"{n:4d}  {ls}")

print("\n=== LINE HEIGHTS ===")
for lh, n in line_heights.most_common():
    print(f"{n:4d}  {lh}")

print("\n=== BORDER RADIUS ===")
for r, n in radii.most_common():
    print(f"{n:4d}  {r}")

print("\n=== BOX SHADOWS ===")
for s, n in shadows.most_common():
    print(f"{n:4d}  {s}")

print("\n=== SPACING (px values, top 30) ===")
for s, n in spacing.most_common(30):
    print(f"{n:4d}  {s}")

print("\n=== ACCENT ATTRS ===")
print(f"data-accent-bg: {accent_bg}")
print(f"data-accent-text: {accent_text}")
print(f"data-accent-dot: {accent_dot}")

print("\n=== KEYFRAMES ===")
for k in re.findall(r"@keyframes (\w+)", text):
    print(k)

print("\n=== SC-IF / SC-FOR ===")
print("sc-if:", len(re.findall(r"<sc-if", text)))
print("sc-for:", len(re.findall(r"<sc-for", text)))
