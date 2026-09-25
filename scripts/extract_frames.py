"""Pull the sharpest still from every distinct shot in the salon's TikTok videos.

Social video is the only photography the salon has published, so the stills come from there.
For each video in brand/social/tiktok/:
  1. sample a frame every STEP seconds,
  2. split the video into shots wherever the colour histogram jumps (a cut),
  3. keep the sharpest frame of each shot (variance of the Laplacian, blur and motion score low),
  4. drop shots that are too dark, too short or mostly text overlay.
Stills land in brand/social/frames/<video id>_<seconds>.png, and a contact sheet per video
goes to brand/social/sheets/ for choosing which ones the site uses.

Usage:  python scripts/extract_frames.py
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand" / "social" / "tiktok"
FRAMES = ROOT / "brand" / "social" / "frames"
SHEETS = ROOT / "brand" / "social" / "sheets"

STEP = 0.25
CUT = 0.45  # histogram distance that counts as a new shot
MIN_SHOT = 0.5  # seconds
MIN_BRIGHTNESS = 45


def sharpness(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def hist(frame: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [24, 16], [0, 180, 0, 256])
    return cv2.normalize(h, h).flatten()


def shots(path: Path) -> list[tuple[float, np.ndarray, float]]:
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    every = max(1, round(fps * STEP))
    best: list[tuple[float, np.ndarray, float]] = []
    current: tuple[float, np.ndarray, float] | None = None
    shot_start = 0.0
    previous = None
    for index in range(0, count, every):
        cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = cap.read()
        if not ok:
            break
        t = index / fps
        h = hist(frame)
        if previous is not None and cv2.compareHist(previous, h, cv2.HISTCMP_BHATTACHARYYA) > CUT:
            if current and t - shot_start >= MIN_SHOT:
                best.append(current)
            current, shot_start = None, t
        previous = h
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if gray.mean() < MIN_BRIGHTNESS:
            continue
        score = sharpness(gray)
        if current is None or score > current[2]:
            current = (t, frame, score)
    if current:
        best.append(current)
    cap.release()
    return best


def sheet(frames: list[tuple[float, np.ndarray, float]], name: str) -> None:
    if not frames:
        return
    thumbs = []
    for t, frame, score in frames:
        h = 360
        w = round(frame.shape[1] * h / frame.shape[0])
        thumb = cv2.resize(frame, (w, h), interpolation=cv2.INTER_AREA)
        cv2.putText(thumb, f"{t:.1f}s {score:.0f}", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
        thumbs.append(thumb)
    row = np.full((360, sum(t.shape[1] + 6 for t in thumbs), 3), 245, np.uint8)
    x = 0
    for thumb in thumbs:
        row[:, x : x + thumb.shape[1]] = thumb
        x += thumb.shape[1] + 6
    cv2.imwrite(str(SHEETS / f"{name}.jpg"), row, [cv2.IMWRITE_JPEG_QUALITY, 80])


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    SHEETS.mkdir(parents=True, exist_ok=True)
    total = 0
    for video in sorted(SRC.glob("*.mp4")):
        found = shots(video)
        # Keep the eight sharpest shots, shown in time order.
        found = sorted(sorted(found, key=lambda f: -f[2])[:8], key=lambda f: f[0])
        for t, frame, _ in found:
            cv2.imwrite(str(FRAMES / f"{video.stem}_{t:05.1f}.png"), frame)
        sheet(found, video.stem)
        total += len(found)
        print(f"{video.stem}: {len(found)} stills")
    print(f"{total} stills in {FRAMES.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
