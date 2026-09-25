"""Upscale low-resolution originals to 4K-class sharpness with Real-ESRGAN x4plus (ONNX, runs locally).

By default only photos narrower than 1440px are upscaled; pass --below 2160 to upscale every
photo that is smaller than the 2160px web size. Each photo is fed in at (target width / 4) so the x4 output lands at ~2160px wide,
processed in overlapping 128px tiles with feathered blending (no seams), then saved as a
lossless PNG in brand/photos-upscaled/. scripts/build_photos.py uses those automatically.

Model: Qualcomm AI Hub release of Real-ESRGAN x4plus (BSD-3-Clause),
https://huggingface.co/qualcomm/Real-ESRGAN-x4plus

Usage:  python scripts/upscale_photos.py --model path/to/real_esrgan_x4plus.onnx [--below 2160] [names...]
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_photos import MAX_WIDTH, SRC, trim_letterbox  # noqa: E402

OUT = SRC.parent / "photos-upscaled"
TILE = 128
OVERLAP = 16
SCALE = 4
UPSCALE_BELOW = 1440
NATIVE_ENOUGH = 1600


def feather(size: int, overlap: int) -> np.ndarray:
    ramp = np.ones(size, np.float32)
    edge = np.linspace(0.0, 1.0, overlap * SCALE, dtype=np.float32)
    ramp[: len(edge)] = edge
    ramp[-len(edge):] = edge[::-1]
    return ramp


def tile_positions(length: int) -> list[int]:
    if length <= TILE:
        return [0]
    step = TILE - OVERLAP
    positions = list(range(0, length - TILE, step))
    positions.append(length - TILE)
    return positions


def upscale(session: ort.InferenceSession, img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    pad_h, pad_w = max(0, TILE - h), max(0, TILE - w)
    if pad_h or pad_w:
        img = cv2.copyMakeBorder(img, 0, pad_h, 0, pad_w, cv2.BORDER_REFLECT)
    H, W = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    out = np.zeros((H * SCALE, W * SCALE, 3), np.float32)
    weight = np.zeros((H * SCALE, W * SCALE, 1), np.float32)
    win = feather(TILE * SCALE, OVERLAP)
    mask = (win[:, None] * win[None, :])[..., None]
    input_name = session.get_inputs()[0].name

    ys, xs = tile_positions(H), tile_positions(W)
    total, done, started = len(ys) * len(xs), 0, time.time()
    for y in ys:
        for x in xs:
            patch = rgb[y : y + TILE, x : x + TILE].transpose(2, 0, 1)[None]
            result = session.run(None, {input_name: patch})[0][0].transpose(1, 2, 0)
            oy, ox = y * SCALE, x * SCALE
            out[oy : oy + TILE * SCALE, ox : ox + TILE * SCALE] += result * mask
            weight[oy : oy + TILE * SCALE, ox : ox + TILE * SCALE] += mask
            done += 1
            if done % 20 == 0 or done == total:
                print(f"    {done}/{total} tiles, {time.time() - started:.0f}s", flush=True)

    out /= np.maximum(weight, 1e-6)
    out = np.clip(out[: (H - pad_h) * SCALE, : (W - pad_w) * SCALE], 0.0, 1.0)
    return cv2.cvtColor((out * 255.0).round().astype(np.uint8), cv2.COLOR_RGB2BGR)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--below", type=int, default=UPSCALE_BELOW, help="upscale originals narrower than this many pixels")
    parser.add_argument("names", nargs="*")
    args = parser.parse_args()

    session = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = set(args.names)

    for path in sorted(SRC.glob("*.jpg")):
        name = path.stem
        if wanted and name not in wanted:
            continue
        img = trim_letterbox(cv2.imread(str(path)))
        h, w = img.shape[:2]
        # The model is fed at MAX_WIDTH / 4 (540px), so wide sources would lose more detail than it adds.
        if w >= args.below or w >= NATIVE_ENOUGH:
            print(f"skip {name}: already {w}px wide")
            continue
        if (OUT / f"{name}.png").exists():
            print(f"skip {name}: already upscaled")
            continue
        # Feed at target/4 so the output lands near MAX_WIDTH without wasted tiles.
        in_w = min(w, MAX_WIDTH // SCALE)
        small = cv2.resize(img, (in_w, round(h * in_w / w)), interpolation=cv2.INTER_AREA) if in_w < w else img
        print(f"{name}: {w}x{h} -> input {small.shape[1]}x{small.shape[0]}", flush=True)
        big = upscale(session, small)
        cv2.imwrite(str(OUT / f"{name}.png"), big)
        print(f"  saved {big.shape[1]}x{big.shape[0]}", flush=True)


if __name__ == "__main__":
    main()
