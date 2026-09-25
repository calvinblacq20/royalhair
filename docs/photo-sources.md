# Photo sources

Every photo on the site is a still from the salon's own TikTok, [@royalhairgh](https://www.tiktok.com/@royalhairgh).
**Using them on the live site needs the owner's written go-ahead** — confirm it before launch, the
same way the tailor's photos were cleared. The logo is the file the salon sent (`brand/logo-original.png`).

## The pipeline

1. `python -m yt_dlp` downloads the salon's public TikTok posts into `brand/social/tiktok/`
   (18 of 19 posts; the Easter post, `7495461154580352311`, was refused by TikTok's rate limit).
2. `python scripts/extract_frames.py` pulls the sharpest frame of every distinct shot into
   `brand/social/frames/`, with contact sheets in `brand/social/sheets/` for choosing.
3. `python scripts/pick_photos.py` crops the chosen stills — removing the "Royal Hair Salon & Spa /
   Contact Us" banner the salon adds to its slideshows, on-screen timers and date stamps — into
   `brand/photos-original/`.
4. *(Optional, for 4K)* `python scripts/upscale_photos.py --model <real_esrgan_x4plus.onnx>` upscales
   into `brand/photos-upscaled/`. **Not run yet: the model file isn't on this machine.**
5. `python scripts/build_photos.py` cleans, sharpens and exports `name-sm.webp` (480px), `name.webp`
   (1080px) and `name@2x.webp` (up to 3840px, true 4K), and rewrites `src/data/photo-manifest.json`.

`Photo` in `src/components/Bits.tsx` reads the manifest and builds the `srcset`, so a cheap Android on
3G downloads the small file and a retina laptop gets the largest one.

**Resolution today:** TikTok serves these videos at 480×848 (the Christmas and New Year posts at
720×1280), so the site's photos top out at 480–720px wide. They are sharp on phones and soft on large
retina screens. Step 4 fixes that without changing any code; the originals off the phone that filmed
them would fix it better still.

## Photos in use

| File | Used for | TikTok post | At |
|---|---|---|---|
| barbershop-pole | Barbershop tile | 7587518934723628344 (Christmas Eve 2025) | 13.4s |
| barber-kid-cut | Kids tile, Kids' haircut | 7587518934723628344 | 9.6s |
| fade-detail | Men's haircut, gallery | 7588280098739014923 (26 Dec 2025) | 8.9s |
| silk-press | Hair tile, Relaxer / perm | 7588280098739014923 | 11.0s |
| salon-floor | Gallery | 7588280098739014923 | 7.7s |
| ombre-curls | Weave install, Wig install, gallery | 7473891048624852229 | 15.0s |
| locs | Locs retwist, gallery | 7471959025727409413 | 62.1s, cropped |
| blonde-cut | Colour, gallery | 7471959025727409413 | 48.5s, cropped |
| boutique | Gallery | 7471959025727409413 | 68.0s, cropped |
| decor-wall | Spa tile | 7471959025727409413 | 13.3s, cropped |
| nail-bar | Gallery | 7496063704165797175 | 0.0s |
| nails-red | Nails tile, Acrylic set | 7523233525257080120 | 3.7s |
| nails-pink | Manicure | 7497249165127339269 | 2.8s |
| nails-floral | Gel overlay, gallery | 7483498121754840375 | 0.0s |
| pedicure | Pedicure, gallery | 7485683849528118533 | 0.0s |
| kids-braids | Kids' braids, gallery | 7492725160575798534 | 3.8s, cropped |

Post links follow `https://www.tiktok.com/@royalhairgh/video/<post id>`.

## Left out on purpose

- Frames with captions across the subject ("New Look, New Vibes", "Your Hair, Your Crown").
- The black-and-white halftone shot, and the Santa-hat clips, which would date the site.
- Instagram ([@royalhair_gh](https://www.instagram.com/royalhair_gh/)): its public posts are three
  hiring flyers and nine reels, seven of them the same videos as TikTok. Two nail reels are new, but
  Instagram only serves their covers logged-out, at 360×640 (kept in `brand/social/instagram/`).
- No photo for the spa treatments themselves (massage, facial, scrub): none has been posted. The Spa
  tile shows the salon's purple decor wall until there is one.
