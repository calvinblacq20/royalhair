"""Build every logo asset the site uses from the one file the salon sent.

Input:  brand/logo-original.png  (2048x768 RGBA: pink crown over "ROYAL_HAIR", with a soft glow
        baked into the alpha channel)

Outputs:
  public/brand/logo-wordmark.webp          crown + name, glow removed: for light backgrounds
  public/brand/logo-wordmark@2x.webp       the same at double width, for retina screens
  public/brand/logo-glow.webp              crown + name with the original glow: for dark backgrounds
  public/brand/crown.webp                  crown alone, glow removed
  public/brand/app-icon-512.png / -180.png crown on the brand's black, for home screens and PWA
  public/favicon-32.png                    tab icon
  public/brand/og-image.jpg                1200x630 link preview for WhatsApp, Instagram and Facebook
  brand/crown-path.txt                     the crown traced to one SVG path, for crisp tinted marks
  (and prints the viewBox the path uses)

The glow reads as a pink haze on a light page, so the "clean" versions ramp the alpha:
anything under ALPHA_LOW disappears, anything over ALPHA_HIGH is solid, with a smooth edge between.

Usage:  python scripts/build_logo.py
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand" / "logo-original.png"
OUT = ROOT / "public" / "brand"
PATH_TXT = ROOT / "brand" / "crown-path.txt"

ALPHA_LOW, ALPHA_HIGH = 150, 235
INK = (0x19, 0x17, 0x1C)  # BGR of --ink #1c1719
PAD = 12


def clean_alpha(img: np.ndarray) -> np.ndarray:
    out = img.copy()
    a = out[:, :, 3].astype(np.float32)
    ramp = np.clip((a - ALPHA_LOW) / (ALPHA_HIGH - ALPHA_LOW), 0, 1)
    out[:, :, 3] = (ramp * 255).round().astype(np.uint8)
    return out


def trim(img: np.ndarray, threshold: int = 8, pad: int = PAD) -> np.ndarray:
    ys, xs = np.where(img[:, :, 3] > threshold)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, img.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, img.shape[1])
    return img[y0:y1, x0:x1]


def resize_w(img: np.ndarray, width: int) -> np.ndarray:
    h = round(img.shape[0] * width / img.shape[1])
    interp = cv2.INTER_AREA if width < img.shape[1] else cv2.INTER_CUBIC
    return cv2.resize(img, (width, h), interpolation=interp)


def write_webp(path: Path, img: np.ndarray, quality: int = 92) -> None:
    cv2.imwrite(str(path), img, [cv2.IMWRITE_WEBP_QUALITY, quality])


def composite(img: np.ndarray, bg_bgr: tuple[int, int, int]) -> np.ndarray:
    a = img[:, :, 3:4].astype(np.float32) / 255
    bg = np.empty_like(img[:, :, :3], dtype=np.float32)
    bg[:] = bg_bgr
    return (img[:, :, :3].astype(np.float32) * a + bg * (1 - a)).round().astype(np.uint8)


def square_icon(crown: np.ndarray, size: int, fill: float = 0.74) -> np.ndarray:
    """Crown centred on the brand black, as a full-bleed square (the OS rounds the corners)."""
    art = resize_w(crown, round(size * fill))
    canvas = np.zeros((size, size, 4), np.uint8)
    canvas[:, :, :3] = INK
    canvas[:, :, 3] = 255
    y = (size - art.shape[0]) // 2
    x = (size - art.shape[1]) // 2
    region = canvas[y : y + art.shape[0], x : x + art.shape[1]]
    a = art[:, :, 3:4].astype(np.float32) / 255
    region[:, :, :3] = (art[:, :, :3] * a + region[:, :, :3] * (1 - a)).round().astype(np.uint8)
    return canvas


def trace(mask: np.ndarray, epsilon: float = 1.1) -> tuple[str, str]:
    """One even-odd SVG path for a binary mask, in the mask's own pixel coordinates."""
    contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = []
    for c in contours:
        if cv2.contourArea(c) < 30:
            continue
        pts = cv2.approxPolyDP(c, epsilon, True).reshape(-1, 2)
        parts.append("M" + " L".join(f"{x} {y}" for x, y in pts) + "Z")
    h, w = mask.shape
    return " ".join(parts), f"0 0 {w} {h}"


def main() -> None:
    src = cv2.imread(str(SRC), cv2.IMREAD_UNCHANGED)
    if src is None or src.shape[2] != 4:
        raise SystemExit(f"Expected an RGBA PNG at {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)

    clean = clean_alpha(src)

    # The crown and the name are separated by a band of empty rows; find it.
    solid_rows = (clean[:, :, 3] > 200).sum(axis=1)
    rows = np.where(solid_rows > 0)[0]
    gaps = [y for y in range(rows.min(), rows.max()) if solid_rows[y] == 0]
    split = (gaps[0] + gaps[-1]) // 2 if gaps else src.shape[0] // 2

    wordmark = trim(clean)
    write_webp(OUT / "logo-wordmark.webp", resize_w(wordmark, 960))
    write_webp(OUT / "logo-wordmark@2x.webp", resize_w(wordmark, 1920))

    glow = trim(src, threshold=20, pad=4)
    write_webp(OUT / "logo-glow.webp", resize_w(glow, 1400), quality=88)

    crown = trim(clean[:split])
    write_webp(OUT / "crown.webp", resize_w(crown, 512))

    crown_glow = trim(src[:split], threshold=20, pad=4)
    for size in (512, 180):
        cv2.imwrite(str(OUT / f"app-icon-{size}.png"), square_icon(crown_glow, size))
    cv2.imwrite(str(ROOT / "public" / "favicon-32.png"), resize_w(trim(clean[:split], pad=1), 32))

    # Link preview: shared links are how most clients first meet the site, so show the real logo.
    og = np.zeros((630, 1200, 4), np.uint8)
    og[:, :, :3] = INK
    og[:, :, 3] = 255
    art = resize_w(glow, 980)
    y, x = (630 - art.shape[0]) // 2, (1200 - art.shape[1]) // 2
    region = og[y : y + art.shape[0], x : x + art.shape[1]]
    a = art[:, :, 3:4].astype(np.float32) / 255
    region[:, :, :3] = (art[:, :, :3] * a + region[:, :, :3] * (1 - a)).round().astype(np.uint8)
    cv2.imwrite(str(OUT / "og-image.jpg"), og[:, :, :3], [cv2.IMWRITE_JPEG_QUALITY, 88])

    mask = (trim(clean[:split], pad=2)[:, :, 3] > 127).astype(np.uint8) * 255
    path, viewbox = trace(mask)
    PATH_TXT.write_text(path + "\n", encoding="utf-8")

    print(f"wordmark {wordmark.shape[1]}x{wordmark.shape[0]}, crown {crown.shape[1]}x{crown.shape[0]}")
    print(f"crown path: {len(path)} chars, viewBox {viewbox}")


if __name__ == "__main__":
    main()
