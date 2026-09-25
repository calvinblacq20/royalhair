"""Crop the chosen TikTok stills into named originals for scripts/build_photos.py.

Each pick names the still (from scripts/extract_frames.py) and the part of the frame to keep,
as fractions (top, bottom, left, right). Crops remove the "ROYAL HAIR SALON & SPA / Contact Us"
band the salon adds to its slideshows, on-screen timers and date stamps. Saved as high-quality
JPEG in brand/photos-original/, which is what build_photos.py reads.

Usage:  python scripts/pick_photos.py
"""

from __future__ import annotations

from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "brand" / "social" / "frames"
OUT = ROOT / "brand" / "photos-original"

# name: (still, (top, bottom, left, right))
PICKS: dict[str, tuple[str, tuple[float, float, float, float]]] = {
    "barbershop-pole": ("7587518934723628344_013.4", (0.0, 1.0, 0.0, 1.0)),
    "barber-kid-cut": ("7587518934723628344_009.6", (0.0, 1.0, 0.0, 1.0)),
    "fade-detail": ("7588280098739014923_008.9", (0.0, 1.0, 0.0, 1.0)),
    "silk-press": ("7588280098739014923_011.0", (0.0, 1.0, 0.0, 1.0)),
    "salon-floor": ("7588280098739014923_007.7", (0.0, 1.0, 0.0, 1.0)),
    "locs": ("7471959025727409413_062.1", (0.16, 0.78, 0.0, 1.0)),
    "blonde-cut": ("7471959025727409413_048.5", (0.0, 0.78, 0.0, 1.0)),
    "boutique": ("7471959025727409413_068.0", (0.0, 0.78, 0.0, 1.0)),
    "decor-wall": ("7471959025727409413_013.3", (0.0, 0.78, 0.0, 1.0)),
    "nail-bar": ("7496063704165797175_000.0", (0.0, 1.0, 0.0, 1.0)),
    "nails-red": ("7523233525257080120_003.7", (0.0, 1.0, 0.0, 1.0)),
    "nails-pink": ("7497249165127339269_002.8", (0.0, 1.0, 0.0, 1.0)),
    "nails-floral": ("7483498121754840375_000.0", (0.0, 1.0, 0.0, 1.0)),
    "pedicure": ("7485683849528118533_000.0", (0.0, 1.0, 0.0, 1.0)),
    "kids-braids": ("7492725160575798534_003.8", (0.0, 0.74, 0.0, 1.0)),
    "ombre-curls": ("7473891048624852229_015.0", (0.0, 1.0, 0.0, 1.0)),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (still, (top, bottom, left, right)) in PICKS.items():
        img = cv2.imread(str(FRAMES / f"{still}.png"))
        if img is None:
            raise SystemExit(f"Missing still {still}.png — run scripts/extract_frames.py first")
        h, w = img.shape[:2]
        crop = img[round(h * top) : round(h * bottom), round(w * left) : round(w * right)]
        cv2.imwrite(str(OUT / f"{name}.jpg"), crop, [cv2.IMWRITE_JPEG_QUALITY, 97])
        print(f"{name:16s} {crop.shape[1]}x{crop.shape[0]}  from {still}")


if __name__ == "__main__":
    main()
