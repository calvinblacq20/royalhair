"""Build web photos from the full-size originals in brand/photos-original.

For each original:
  1. trim black letterbox bands left by TikTok,
  2. clean heavy JPEG noise where needed and sharpen adaptively (softer photos get more),
  3. lift local contrast slightly so hair texture and nail detail read clearly,
  4. export WebP files: name-sm.webp (480px, thumbnails and grids on data),
     name.webp (up to 1080px), name-md.webp (1600px, sharp phone screens without the
     full download) and name@2x.webp (full resolution, up to 3840px, 4K) for large screens.

Writes src/data/photo-manifest.json with the real pixel widths so <img srcset>
can let each device pick the right file.

Usage:  python scripts/build_photos.py
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand" / "photos-original"
UPSCALED = ROOT / "brand" / "photos-upscaled"  # optional Real-ESRGAN output from scripts/upscale_photos.py
OUT = ROOT / "public" / "photos"
MANIFEST = ROOT / "src" / "data" / "photo-manifest.json"

SMALL_WIDTH = 480
BASE_WIDTH = 1080
MID_WIDTH = 1600  # a 390px-wide phone at 3x needs ~1170px: this keeps it off the full-size file
MAX_WIDTH = 3840  # true 4K width for large and retina screens; srcset keeps phones on the 480/1080 files


def trim_letterbox(img: np.ndarray, threshold: float = 14.0) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    rows, cols = gray.mean(axis=1), gray.mean(axis=0)

    def bounds(line: np.ndarray) -> tuple[int, int]:
        n = len(line)
        start = 0
        while start < n * 0.3 and line[start] < threshold:
            start += 1
        end = n - 1
        while end > n * 0.7 and line[end] < threshold:
            end -= 1
        return start, end + 1

    top, bottom = bounds(rows)
    left, right = bounds(cols)
    return img[top:bottom, left:right]


def sharpness(img: np.ndarray) -> float:
    return float(cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())


def enhance(img: np.ndarray, was_upscaled: bool = False) -> np.ndarray:
    detail = sharpness(img)

    if was_upscaled:
        # Real-ESRGAN output is already clean and crisp: only a light finishing sharpen.
        amount, sigma = 0.25, 1.0
    else:
        # Very "busy" images at this size are usually JPEG noise, not detail: clean lightly first.
        if detail > 400:
            img = cv2.fastNlMeansDenoisingColored(img, None, 3, 3, 7, 21)
        # Adaptive unsharp mask: soft photos get a stronger, wider sharpen.
        if detail < 50:
            amount, sigma = 1.0, 1.6
        elif detail < 200:
            amount, sigma = 0.7, 1.2
        else:
            amount, sigma = 0.4, 1.0
    blurred = cv2.GaussianBlur(img, (0, 0), sigma)
    img = cv2.addWeighted(img, 1 + amount, blurred, -amount, 0)

    # Gentle local contrast on lightness only, blended at 40% to keep skin and colours natural.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l_clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8)).apply(l)
    l = cv2.addWeighted(l, 0.6, l_clahe, 0.4, 0)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)


def resize_to_width(img: np.ndarray, width: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w <= width:
        return img
    return cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, int]] = {}
    originals = sorted(SRC.glob("*.jpg"))
    if not originals:
        raise SystemExit(f"No originals found in {SRC}")

    for path in originals:
        name = path.stem
        img = cv2.imread(str(path))
        if img is None:
            print(f"skip {name}: unreadable")
            continue
        img = trim_letterbox(img)
        upscaled_path = UPSCALED / f"{name}.png"
        upscaled = cv2.imread(str(upscaled_path)) if upscaled_path.exists() else None
        if upscaled is not None:
            # Blend a little of the original back in so skin and fabric keep natural grain.
            original_big = cv2.resize(img, (upscaled.shape[1], upscaled.shape[0]), interpolation=cv2.INTER_LANCZOS4)
            img = enhance(cv2.addWeighted(upscaled, 0.82, original_big, 0.18, 0), was_upscaled=True)
        else:
            img = enhance(img)

        hi = resize_to_width(img, MAX_WIDTH)
        mid = resize_to_width(img, MID_WIDTH)
        base = resize_to_width(img, BASE_WIDTH)
        small = resize_to_width(img, SMALL_WIDTH)
        cv2.imwrite(str(OUT / f"{name}@2x.webp"), hi, [cv2.IMWRITE_WEBP_QUALITY, 90])
        has_mid = base.shape[1] < mid.shape[1] < hi.shape[1]
        if has_mid:
            cv2.imwrite(str(OUT / f"{name}-md.webp"), mid, [cv2.IMWRITE_WEBP_QUALITY, 86])
        else:
            (OUT / f"{name}-md.webp").unlink(missing_ok=True)
        cv2.imwrite(str(OUT / f"{name}.webp"), base, [cv2.IMWRITE_WEBP_QUALITY, 88])
        cv2.imwrite(str(OUT / f"{name}-sm.webp"), small, [cv2.IMWRITE_WEBP_QUALITY, 84])

        manifest[name] = {"sm": int(small.shape[1]), "w": int(base.shape[1]), "w2x": int(hi.shape[1]), "h": int(base.shape[0])}
        if has_mid:
            manifest[name]["md"] = int(mid.shape[1])
        files = [OUT / f"{name}-sm.webp", OUT / f"{name}.webp", *([OUT / f"{name}-md.webp"] if has_mid else []), OUT / f"{name}@2x.webp"]
        sizes = " | ".join(f"{f.stat().st_size // 1024}KB" for f in files)
        print(f"{name:26s} {small.shape[1]}/{base.shape[1]}/{mid.shape[1] if has_mid else '-'}/{hi.shape[1]}w  {sizes}")

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"manifest: {MANIFEST.relative_to(ROOT)} ({len(manifest)} photos)")


if __name__ == "__main__":
    main()
