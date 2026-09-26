import { describe, expect, it } from "vitest";
import manifest from "../data/photo-manifest.json";
import { photoSrcSet } from "./Bits";

const entries = Object.entries(manifest as Record<string, { sm: number; w: number; md?: number; w2x: number; h: number }>);

describe("photo sizes", () => {
  it("lists every photo's files from smallest to largest, ending on the full-size file", () => {
    for (const [name] of entries) {
      const parts = photoSrcSet(`/photos/${name}.webp`)!.split(", ").map((p) => p.split(" "));
      const widths = parts.map(([, w]) => Number(w!.replace("w", "")));
      expect(widths, name).toEqual([...widths].sort((a, b) => a - b));
      expect(new Set(widths).size, name).toBe(widths.length);
      expect(parts.at(-1)?.[0], name).toBe(`/photos/${name}@2x.webp`);
    }
  });

  it("offers the phone-sharp size only when it sits between the standard and full sizes", () => {
    for (const [name, entry] of entries) {
      const set = photoSrcSet(`/photos/${name}.webp`)!;
      if (entry.md) {
        expect(entry.md, name).toBeGreaterThan(entry.w);
        expect(entry.md, name).toBeLessThan(entry.w2x);
        expect(set, name).toContain(`/photos/${name}-md.webp ${entry.md}w`);
      } else {
        expect(set, name).not.toContain("-md.webp");
      }
    }
  });

  it("gives no size list for pictures the pipeline didn't make", () => {
    expect(photoSrcSet("/brand/crown.webp")).toBeUndefined();
    expect(photoSrcSet("/photos/not-a-photo.webp")).toBeUndefined();
    expect(photoSrcSet(undefined)).toBeUndefined();
  });
});
