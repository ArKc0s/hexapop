import os
OUT = os.path.dirname(os.path.abspath(__file__))  # deploy/discord/emojis
HEX = "M36 6 L60 19 Q64 21 64 26 L64 50 Q64 55 60 57 L36 70 Q32 72 28 70 L4 57 Q0 55 0 50 L0 26 Q0 21 4 19 L28 6 Q32 4 36 6Z"
INK, PINK, BLUE, YEL = "#1c1a37", "#ff4fae", "#1572c4", "#ffd93d"
def body(): return f'<path d="{HEX}" transform="translate(4 4)" fill="{BLUE}"/><path d="{HEX}" fill="{PINK}"/>'
def cheeks(): return f'<circle cx="14" cy="46" r="3.5" fill="{YEL}" opacity=".9"/><circle cx="50" cy="46" r="3.5" fill="{YEL}" opacity=".9"/>'
def eyes(px=23.5, py=35.5, r=3.6): return f'<ellipse cx="22" cy="34" rx="7" ry="8" fill="#fff"/><ellipse cx="42" cy="34" rx="7" ry="8" fill="#fff"/><circle cx="{px}" cy="{py}" r="{r}" fill="{INK}"/><circle cx="{px+20}" cy="{py}" r="{r}" fill="{INK}"/>'
def stroke(d, w=3.4): return f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
SMILE = stroke("M24 46 Q32 55 40 46", 3.2)
# Goutte (larme) dans la DA : à plat, bleu d'Hexa, un petit reflet blanc, sans contour.
def tear(x, y, s=1): return f'<g transform="translate({x} {y}) scale({s})"><path d="M0 0 Q-3.6 5.4 -3.6 7.6 A3.6 3.6 0 0 0 3.6 7.6 Q3.6 5.4 0 0Z" fill="{BLUE}"/><circle cx="-1.2" cy="7.4" r="1.1" fill="#fff" opacity=".85"/></g>'
heart = lambda x, y, s=1: f'<path transform="translate({x} {y}) scale({s})" d="M0 -3 C-2 -7 -9 -6 -9 -1 C-9 3 -4 6 0 9 C4 6 9 3 9 -1 C9 -6 2 -7 0 -3Z" fill="#e8115b" stroke="{INK}" stroke-width="1.2"/>'
E = {
  "hexa": eyes() + cheeks() + SMILE,
  "hexa_wow": eyes(22, 34, 4) + cheeks() + f'<ellipse cx="32" cy="50" rx="5" ry="6" fill="{INK}"/>',
  "hexa_hmm": eyes() + cheeks() + stroke("M26 49 L38 47", 3.2) + stroke("M16 24 L27 22", 2.6),
  "hexa_triste": eyes() + cheeks() + stroke("M25 51 Q32 44 39 51", 3.2) + stroke("M16 23 L27 27 M48 23 L37 27", 2.6)
     + tear(13, 39),
  "hexa_love": heart(22, 33, 1.05) + heart(42, 33, 1.05) + cheeks() + SMILE,
  "hexa_cool": cheeks() + f'<path d="M8 28 L56 28 L55 33 Q54 41 45 41 Q38 41 35 34 L29 34 Q26 41 19 41 Q10 41 9 33Z" fill="{INK}"/><path d="M14 31 L22 31" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>' + stroke("M25 47 Q33 54 41 46"),
  "hexa_mdr": cheeks() + stroke("M16 35 Q22 28 28 35", 3.2) + stroke("M36 35 Q42 28 48 35", 3.2)
     + f'<path d="M21 44 Q32 60 43 44Z" fill="{INK}" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M26 51 Q32 56 38 51 Q32 53 26 51Z" fill="#ff7cc2"/>'
     + tear(9, 29, 0.9) + tear(55, 29, 0.9),
  "hexa_bot": f'<path d="M32 6 L32 -3" stroke="{INK}" stroke-width="2.8" stroke-linecap="round"/><circle cx="32" cy="-6.5" r="4.3" fill="{YEL}" stroke="{INK}" stroke-width="2.2"/>'
     + f'<rect x="-4.5" y="30" width="6.5" height="14" rx="2.4" fill="#b4bfcd" stroke="{INK}" stroke-width="1.8"/><rect x="65.5" y="34" width="6.5" height="14" rx="2.4" fill="#8f9bab" stroke="{INK}" stroke-width="1.8"/>'
     + "BODY" + f'<rect x="8" y="25.5" width="48" height="19" rx="8" fill="{INK}"/><rect x="15" y="29.5" width="11" height="11" rx="3.5" fill="#8be9ff"/><rect x="38" y="29.5" width="11" height="11" rx="3.5" fill="#8be9ff"/>'
     + f'<circle cx="12" cy="51" r="3.5" fill="{YEL}" opacity=".9"/><circle cx="52" cy="51" r="3.5" fill="{YEL}" opacity=".9"/>' + stroke("M23.5 50 L27 53.5 L37 53.5 L40.5 50"),
  "hexa_bob": eyes() + cheeks() + SMILE + '<g transform="rotate(-8 32 8)"><ellipse cx="32" cy="8" rx="26" ry="5.5" fill="#d9a90b"/><path d="M15 8 C15.5 1 16.5 -4 19.5 -5.5 Q32 -10.5 44.5 -5.5 C47.5 -4 48.5 1 49 8 A17 3 0 0 1 15 8 Z" fill="#ffd93d"/><path d="M16 1.5 A16.4 3 0 0 0 48.2 1.5 L48.9 6.6 A16.9 3 0 0 1 15.2 6.6 Z" fill="#1572c4"/><path d="M6 8 A26 5.5 0 0 0 58 8 L49 8 A17 3 0 0 1 15 8 Z" fill="#ffd93d"/></g>',
  "hexa_aviateur": eyes() + cheeks() + SMILE + '<path d="M3.2 19.5 Q32 13 60.8 19.5 L61.6 24.2 Q32 17.8 2.4 24.2 Z" fill="#8a5a2b"/>'
     + f'<g stroke="{INK}" stroke-width="2.2"><circle cx="22" cy="17.5" r="7.4" fill="#bfe3f7"/><circle cx="42" cy="17.5" r="7.4" fill="#bfe3f7"/></g>'
     + stroke("M29.4 16.6 Q32 15 34.6 16.6", 2.2) + '<path d="M18.4 15.2 Q20 12.6 23 12.4 M38.4 15.2 Q40 12.6 43 12.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>',
  # Coucou façon 👋 : une main ouverte (doigts écartés) à côté du visage, clin d'œil, grand sourire, traits de mouvement.
  "hexa_salut": "BODY" + f'<ellipse cx="22" cy="34" rx="7" ry="8" fill="#fff"/><circle cx="23.5" cy="35.5" r="3.6" fill="{INK}"/>' + stroke("M36 35 Q42 29 48 35", 3.2)
     + cheeks() + f'<path d="M22 45 Q32 57 42 45Z" fill="{INK}" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M27 50 Q32 54 37 50 Q32 52 27 50Z" fill="#ff7cc2"/>'
     + "HAND" + stroke("M70 9 Q74 6 77 8", 2.4) + stroke("M75 15 Q78.5 13.5 79 16.5", 2.2) + stroke("M51 20 Q50 16 52.5 13", 2.2),
  "hexa_gg": eyes() + cheeks() + stroke("M22 45 Q32 57 42 45")
     + f'<path d="M14 6 L20 -6 L26 2 L32 -9 L38 2 L44 -6 L50 6 Z" fill="{YEL}" stroke="{INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="-9" r="2.2" fill="{PINK}" stroke="{INK}" stroke-width="1.2"/><circle cx="20" cy="-6" r="1.8" fill="{BLUE}" stroke="{INK}" stroke-width="1"/><circle cx="44" cy="-6" r="1.8" fill="{BLUE}" stroke="{INK}" stroke-width="1"/>',
}
# Un seul cadre pour tous : Hexa a la même taille et la même place sur chaque émoji, avec ou sans chapeau.
BOX = "-10 -13 89 89"
import math
def wave_hand(dx=0, dy=0, color=PINK):
    # Main ouverte façon 👋 (pas de bras) : paume ronde, doigts largement écartés en éventail, pouce sur le côté,
    # inclinée à côté du visage.
    g = f'<g transform="translate({64 + dx} {30 + dy}) rotate(-18)"><circle r="7.4" fill="{color}"/>'
    for ang, ln in [(-44, 8.2), (-15, 9.6), (14, 9.4), (42, 8.0), (-100, 6.8)]:
        r = math.radians(ang)
        x0, y0 = 4 * math.sin(r), -4 * math.cos(r)
        x1, y1 = (4 + ln) * math.sin(r), -(4 + ln) * math.cos(r)
        g += f'<path d="M{x0:.2f} {y0:.2f} L{x1:.2f} {y1:.2f}" stroke="{color}" stroke-width="4.1" stroke-linecap="round"/>'
    return g + '</g>'
def mascot(name, inner):
    inner = inner.replace("HAND", wave_hand(2.2, 2.2, BLUE) + wave_hand(color="#ff8fcb"))
    content = inner.replace("BODY", body()) if "BODY" in inner else body() + inner
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="{BOX}">{content}</svg>'
for n, inner in E.items(): open(f"{OUT}/{n}.svg", "w").write(mascot(n, inner))
# Médailles : hexagone métallique, ruban, étoile
MED = {"medaille_bronze": ("#f2c79f", "#d69a63", "#a86a35"), "medaille_argent": ("#f3f6fa", "#b9c3d0", "#8994a3"), "medaille_or": ("#ffe680", "#f5c518", "#c99a12")}
for n, (a, b, c) in MED.items():
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/><stop offset=".55" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></linearGradient></defs>
<path d="M20 2 L28 22 L36 22 L44 2 Z" fill="{BLUE}"/><path d="M28 2 L32 22 L36 2Z" fill="{PINK}"/>
<g transform="translate(32 40)"><path d="M0 -21 L18.2 -10.5 L18.2 10.5 L0 21 L-18.2 10.5 L-18.2 -10.5 Z" transform="translate(2.5 2.5)" fill="{INK}" opacity=".25"/><path d="M0 -21 L18.2 -10.5 L18.2 10.5 L0 21 L-18.2 10.5 L-18.2 -10.5 Z" fill="url(#g)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M0 -10 L2.9 -3.6 L9.6 -3.1 L4.5 1.4 L6.1 8 L0 4.5 L-6.1 8 L-4.5 1.4 L-9.6 -3.1 L-2.9 -3.6Z" fill="#fff" opacity=".9" stroke="{INK}" stroke-width="1.4" stroke-linejoin="round"/></g></svg>'''
    open(f"{OUT}/{n}.svg", "w").write(svg)
print(len(E) + len(MED), "émojis")
