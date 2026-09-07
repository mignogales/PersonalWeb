# Village artwork

`desktop-concept-v1.png`: the approved concept, generated with the built-in image-generation tool.

`village-background-v1.png`: generated clean-background edit of the approved concept. The input and final prompt are documented in `ART-DIRECTION.md`. This remains a single painted background; it is not a tilemap or a foreground-occlusion layer set.

`resident-lpc-v1.png`: unmodified “Universal LPC sprite male 01,” credited by the source to Gaurav Munjal and Stephen Challener. Used under Creative Commons Attribution-ShareAlike 3.0. This attribution and license apply to this character artwork; the PNG is supplied unmodified. Full upstream contributor attribution is retained in `LPC-AUTHORS.txt`.

- Original source: https://opengameart.org/content/universal-lpc-sprite-male-01
- License: https://creativecommons.org/licenses/by-sa/3.0/
- Sheet: 144 × 256 px, transparent RGBA; 3 columns × 4 rows of 48 × 64 px.
- Rows: up, **right**, down, **left**. Walking columns: 0, 1, 2, 1; idle column: 1. Verified against the visible nose direction; the first prototype incorrectly reversed the horizontal rows.

## Additional residents and ducks

- `resident-sara-v1.png`: [LPC Sara](https://opengameart.org/content/lpc-sara), Stephen “Redshrike” Challener (graphic artist), William.Thompsonj (contributor), and Mandi Paugh (original Sara character artist and creator of the OpenGameArt mascot). Used unmodified under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution link: https://opengameart.org/. Original credit notice retained in `SARA-CREDITS.txt`. 832 × 1344 RGBA; 64 × 64 cells, walk rows up 512, left 576, down 640, right 704; eight walk columns x64–512, idle x0.
- `resident-george-v1.png`: [Alternate LPC Character Sprites – George](https://opengameart.org/content/alternate-lpc-character-sprites-george), sheep / Radomir Dopieralski. Used unmodified under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). 192 × 192 transparent PNG; 48 × 48 cells. Direction columns down 0, left 48, up 96, right 144; animation rows 0, 48, 96, 144.
- `fisher-fishing-v1.png`, `fisher-walking-v1.png`, `fisher-hook-v1.png`, `fisher-idle-v1.png`: [Fishing game assets (pixel art)](https://opengameart.org/content/fishing-game-assets-pixel-art), CraftPix.net 2D Game Assets. Used unmodified under [OGA-BY 3.0](https://opengameart.org/content/oga-by-30-faq). 48 × 48 cells, all facing right; mirrored only when rendered walking left. Fishing and idle have four frames, walking and hook have six.
- `duck-paddle-1.png`, `duck-paddle-2.png`, `duck-paddle-3.png`: [Ducks](https://opengameart.org/content/ducks-0), Julie Damsgaard / Spring Spring / Spring Enterprises, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Losslessly decoded from zero-based frames 6, 7, and 8 of the creator’s `drake.gif`; no crop, resize, recolor or retouch. Each PNG is 44 × 44 with real alpha. Original author: https://spring-enterprises.neocities.org.

These downloaded character and duck designs are separate from the generated background. Their respective artwork licenses apply to the assets above. No unused candidate art is included in the page.

## Current village additions

- `village-background-v2.png`: generated edit of v1 removing the café chalkboard and correcting the gate bridge. Exact prompt recorded in ART-DIRECTION.md.
- `lpc-body-*.png`, `lpc-head-*.png`, `lpc-pants.png`, `lpc-shirt.png`, `lpc-jacket-*.png`, `lpc-hat*.png`, `lpc-shoes-brown.png`: unmodified LPC layers assembled into additional residents and a matching fisherman at runtime. The assembled character artwork is offered under CC BY-SA 3.0. Full authors, original URLs, licenses and assembly details are in [LPC-RESIDENT-CREDITS.txt](LPC-RESIDENT-CREDITS.txt).
- `lpc-rod-bg.png`, `lpc-rod-fg.png`: bluecarrot16, CC BY 4.0 under the fishing-rod entry in [LPC Hand Tools](https://opengameart.org/content/lpc-hand-tools). Original notices: [LPC-HAND-TOOLS-CREDITS.txt](LPC-HAND-TOOLS-CREDITS.txt), [LPC-FISHING-CREDITS.txt](LPC-FISHING-CREDITS.txt).
- `dog-lpc-v1.png`: bluecarrot16, [LPC Cats and Dogs](https://opengameart.org/content/lpc-cats-and-dogs), CC BY 3.0, unmodified PNG. Brown dog frames are selected at runtime.

The CraftPix fisherman above is a retired prototype asset; it is no longer loaded or displayed by the page. The original background is also retained for reference. Duck source PNGs remain unchanged: the renderer excludes leg pixels at the waterline and normally holds the folded-wing frame.

## Distinct outfits and bench poses

- `village-background-v3.png`: built-in ImageGen edit trimming the canopy above the middle-left house. Exact prompt recorded in ART-DIRECTION.md.
- `residents/rosa-*.png`: LPC Irish dress and red ponytail, assembled at runtime under CC BY-SA 3.0.
- `residents/common-*.png`, `residents/felix-*.png`, `residents/tomas-*.png`: LPC Revised Character Basics by Eliza Wyatt, with body/head art based on Stephen Challener, under OGA-BY 3.0. Original walking, idle and chair-sitting layers are unchanged.
- Full attribution, original URLs, licenses and frame conventions: [LPC-OUTFIT-CREDITS.txt](LPC-OUTFIT-CREDITS.txt). Original Revised archive body/clothing/hair notices are retained alongside the PNGs in `residents/`.
