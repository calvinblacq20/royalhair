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
- No photo for the spa treatments themselves (massage, facial, scrub): none has been posted. They
  now use stock photos (below) until the salon has its own.

## Stock photos (stand-ins)

Thirteen services had no photo the salon had posted, and the spa had none at all. These are filled
with stock photos of Black clients from Unsplash, chosen on 1 October 2026 at Calvin's request.

- **Licence:** the Unsplash License: free for commercial use, no attribution required, no Unsplash+
  photos. It does not sell the photos or imply the people in them endorse the salon, and Unsplash
  gives no model releases, which is why the kids' slot shows a styled puff rather than a child's face.
- **They show other people, not Royal Hair's work.** Replace each with the salon's own photo when
  one exists: drop it in `brand/photos-original/` under the same service, update `src/data/catalog.ts`,
  and run `python scripts/build_photos.py`.
- Originals are not in git (`.gitignore`); `python scripts/fetch_stock_photos.py` downloads them again.

| File | Used for | Photographer | Unsplash |
|---|---|---|---|
| stock-knotless | Knotless braids | Gustavo Spindula | [M0NkWmz98o8](https://unsplash.com/photos/M0NkWmz98o8) |
| stock-cornrows | Cornrows | Michael Kyule | [GNTELmdMvFM](https://unsplash.com/photos/GNTELmdMvFM) |
| stock-treatment | Deep conditioning treatment | Vladimir Yelizarov | [h6Ag_2fhlUo](https://unsplash.com/photos/h6Ag_2fhlUo) |
| stock-washset | Wash & set | Good Faces | [62wQhEghaw0](https://unsplash.com/photos/62wQhEghaw0) |
| stock-shapeup | Shape-up | Kingsley Osei-Abrah | [9KmzY22Tz-4](https://unsplash.com/photos/9KmzY22Tz-4) |
| stock-beard | Beard trim & shave | Osheen Turnbull | [85rUAzBoRSo](https://unsplash.com/photos/85rUAzBoRSo) |
| stock-dye | Men's dye | Julian Myles | [I2g6Oe9ElbE](https://unsplash.com/photos/I2g6Oe9ElbE) |
| stock-nailart | Nail art | Budka Damdinsuren | [jRXxNpA6d_k](https://unsplash.com/photos/jRXxNpA6d_k) |
| stock-massage | Full body massage | Taylor Heery | [M7n7YTkPAfA](https://unsplash.com/photos/M7n7YTkPAfA) |
| stock-backmassage | Back, neck & shoulders | Iwaria Inc. | [VWELT4w5jj8](https://unsplash.com/photos/VWELT4w5jj8) |
| stock-facial | Facial | Ben Masora | [O3D_mUpZzcM](https://unsplash.com/photos/O3D_mUpZzcM) |
| stock-scrub | Body scrub | Iwaria Inc. | [Bv826LRAgIc](https://unsplash.com/photos/Bv826LRAgIc) |
| stock-kidswash | Kids' wash & style | Nina Strehl | [7O1YZkFsNf0](https://unsplash.com/photos/7O1YZkFsNf0) |
| stock-spa | Spa section photo | Vladimir Yelizarov | [crnAlC9fcqE](https://unsplash.com/photos/crnAlC9fcqE) |
