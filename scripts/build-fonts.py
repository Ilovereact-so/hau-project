"""
Odtwarza pliki fontów w src/fonts/ (sklep: Poppins, Fredoka; panel: Inter,
JetBrains Mono). Fonty są w repozytorium, bo `next/font/google` pobierał je
z Google przy KAŻDYM buildzie — gdy Google zmienił odpowiedź, build w CI
padał w `next/font` („Cannot read properties of null (reading '1')”).

Uruchamiaj tylko przy zmianie fontu / wag:
    pip install fonttools brotli
    python scripts/build-fonts.py

Źródło: repozytorium google/fonts (licencja OFL). Podzbiór znaków = latin +
latin-ext z Google Fonts (polskie znaki, €, cudzysłowy) + strzałki.
Fonty zmienne są przycinane do używanych wag (i ustalonej szerokości/opsz).
"""
import os
import subprocess
import tempfile
import urllib.parse
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "fonts")
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"

UNICODES = (
    "U+0000-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1EFF,U+2000-206F,"
    "U+20A0-20C0,U+2113,U+2122,U+2190-2199,U+2212,U+2215,U+2C60-2C7F,"
    "U+A720-A7FF,U+FEFF,U+FFFD"
)

# (ścieżka w google/fonts, osie do przycięcia albo None, plik wynikowy)
JOBS = [
    ("poppins/Poppins-Regular.ttf", None, "poppins-400.woff2"),
    ("poppins/Poppins-Medium.ttf", None, "poppins-500.woff2"),
    ("poppins/Poppins-SemiBold.ttf", None, "poppins-600.woff2"),
    ("fredoka/Fredoka[wdth,wght].ttf", {"wdth": 100, "wght": (400, 600)}, "fredoka-variable.woff2"),
    ("inter/Inter[opsz,wght].ttf", {"opsz": 14, "wght": (400, 800)}, "inter-variable.woff2"),
    ("jetbrainsmono/JetBrainsMono[wght].ttf", {"wght": (400, 500)}, "jetbrains-mono-variable.woff2"),
]


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for source, axes, output in JOBS:
            path = os.path.join(tmp, os.path.basename(source))
            urllib.request.urlretrieve(BASE + urllib.parse.quote(source), path)
            if axes:
                font = instancer.instantiateVariableFont(TTFont(path), axes)
                path = os.path.join(tmp, output + ".ttf")
                font.save(path)
            subprocess.run(
                [
                    "pyftsubset", path,
                    "--unicodes=" + UNICODES,
                    "--flavor=woff2",
                    "--layout-features=*",
                    "--output-file=" + os.path.join(OUT, output),
                ],
                check=True,
            )
            print(output)


if __name__ == "__main__":
    main()
