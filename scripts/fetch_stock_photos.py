"""Download the stock photos that stand in where the salon has no photo of its own.

All from Unsplash under the Unsplash License (free for commercial use, no attribution required;
Unsplash+ photos excluded). They show other people, not Royal Hair's work: replace each with the
salon's own photo when one exists (docs/photo-sources.md lists them).

Saves to brand/photos-original/stock-<name>.jpg, which scripts/build_photos.py then turns into the
web sizes. Already-downloaded files are skipped.

Usage:  python scripts/fetch_stock_photos.py
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "brand" / "photos-original"

# name, Unsplash photo id (unsplash.com/photos/<id>), photographer, image path, width to fetch
PHOTOS = [
    ("knotless", "M0NkWmz98o8", "Gustavo Spindula", "photo-1572954889228-2b12a55144d1", 3000),
    ("cornrows", "GNTELmdMvFM", "Michael Kyule", "photo-1770182023775-4706ce1bed72", 3000),
    ("treatment", "h6Ag_2fhlUo", "Vladimir Yelizarov", "photo-1643543162426-c3d8d948fe43", 3000),
    ("washset", "62wQhEghaw0", "Good Faces", "photo-1632765866070-3fadf25d3d5b", 2633),
    ("shapeup", "9KmzY22Tz-4", "Kingsley Osei-Abrah", "photo-1612214070475-1e73f478188c", 2833),
    ("beard", "85rUAzBoRSo", "Osheen Turnbull", "photo-1648389824823-483ec5ca228a", 2730),
    ("dye", "I2g6Oe9ElbE", "Julian Myles", "photo-1523477800337-966dbabe060b", 2008),
    ("nailart", "jRXxNpA6d_k", "Budka Damdinsuren", "photo-1571290274554-6a2eaa771e5f", 3000),
    ("massage", "M7n7YTkPAfA", "Taylor Heery", "photo-1701917084224-cb59235d1d69", 2048),
    ("backmassage", "VWELT4w5jj8", "Iwaria Inc.", "photo-1677682693087-711e24efaa69", 3000),
    ("facial", "O3D_mUpZzcM", "Ben Masora", "photo-1646457417455-77a66a9fcf34", 3000),
    ("scrub", "Bv826LRAgIc", "Iwaria Inc.", "photo-1677682692998-7db8c3245bc9", 3000),
    ("kidswash", "7O1YZkFsNf0", "Nina Strehl", "photo-1474648676916-0558486e7fa0", 3000),
    ("spa", "crnAlC9fcqE", "Vladimir Yelizarov", "photo-1609535895148-cf9f5c446290", 3000),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, photo_id, photographer, path, width in PHOTOS:
        target = OUT / f"stock-{name}.jpg"
        if target.exists():
            print(f"skip {target.name}: already downloaded")
            continue
        url = f"https://images.unsplash.com/{path}?fm=jpg&q=85&w={width}"
        request = urllib.request.Request(url, headers={"User-Agent": "royal-hair-photo-pipeline"})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        if not data.startswith(b"\xff\xd8"):
            raise SystemExit(f"{name}: not a JPEG from {url}")
        target.write_bytes(data)
        print(f"{target.name:26s} {len(data) / 1048576:4.1f} MB  {photographer}  https://unsplash.com/photos/{photo_id}")


if __name__ == "__main__":
    main()
