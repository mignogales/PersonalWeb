# Village desktop prototype

## Composition and scaling

The approved artwork is 1586 × 992. The desktop frame preserves that exact aspect ratio, uses the viewport height minus 96px for the surrounding controls, and has a capped 1920px width. Compact 8px outer spacing gives the scene more vertical room. The artwork's left two-thirds contain the village. Independent HTML city cards occupy the water to the right.

At window widths up to 1100px or heights up to 680px the cards move underneath the frame. Up to 600px, the scene crops its empty right-hand water, the cards stack in a single column, and the animation canvas stays 1 × 1 without loading the resident sheet. The desktop sidebar has no independent scrolling: its heading, four cards and links fit a fixed panel sized to the artwork. Narrow and short windows keep the cards in the page flow below the scene. The page keeps static stories available without JavaScript; native dialogs progressively enhance them.

## Current implementation

- Preserved approved visual direction in a clean full-scene raster.
- Eight visually distinct residents share the village: Nico, Clara, Leo, Hugo, Rosa, Félix, Tomás and Mateo. Rosa wears a green dress and red ponytail; Félix has blue overalls and brown hair; Tomás has a brick-red shirt and gray hair. Matching LPC body, clothing and fishing-tool layers are assembled once at runtime; a small brown LPC dog follows Mateo’s footsteps.
- Four distant boats with independent gentle bob/drift, reusing tiny feathered texture windows of the original artwork without altering the source image.
- The lake shimmer reuses six feathered windows of the original painted water, including open water beside the shoreline and foreground. Slow horizontal band offsets stay within 1.8 source pixels at 19–29% opacity. A cached mask of the original bright ripple pixels adds pale reflected light, drifting up to 2.7 pixels and brightening gradually over roughly ten seconds. The windows avoid land, boats and the jetty and use the existing 30fps loop and pause rules; no extra image download or animation timer is added.
- Residents scale from 0.94 in the distance to 1.18 in the foreground, anchored at their feet. Separate atlas direction maps preserve correct horizontal walking.
- Seven townspeople choose different destinations each trip on a connected pavement graph. Paths trace the fountain perimeter, central lane, lower promenade and café approach around furniture. Destinations avoid the previous stop and favor unoccupied places. Duomo and café visits use doorway clipping, an indoor pause and an exit transition; visitors walk past the left edge and later return.
- Mateo waits quietly with a steady rod, initially for four minutes and then for three to six minutes between rare short walks; his dog follows recorded footsteps and rests nearby. Four ducks glide with folded wings, rendered above the waterline without legs, with independent 1.2-second wing flutters separated by random 12–35-second rests. Their moving wakes are short, faint trailing dashes, with no enclosing rings.
- Félix and Tomás use real chair-sitting poses for bench breaks. Two reserved seat positions prevent overlapping sitters; Félix starts seated. Nearby villagers in the piazza pause for 7–13-second conversations, face each other and alternate small speech bubbles before resuming their routes.
- Native buttons follow residents: click, Enter or Space shows an exclamation and briefly pauses the person. Reactions dismiss even while ambient motion is paused.
- Y-sorted residents, small transparent sprite assets, 30fps drawing, bounded motion updates.
- Animation pauses on document hiding, off-screen scene, open story dialog, user pause, reduced motion and small screens.
- Four city stories with existing local photos, hobbies and other chapters.
- Landmark buttons provide the same stories as the city cards.

This is a first interactive prototype, not the completed village simulation. Background trees/buildings remain one image; full tree/building foreground occlusion, bespoke resident art, richer social animations, broader water animation and a dedicated mobile design remain later work. The current downloaded art and licenses are recorded in CREDITS.md. Public deployment is separate from this local design preview.

## Verification

Run the native Node test runner on tests/village.test.mjs. The current 23 tests cover distinct appearances, randomized trip planning, connected paths, fountain/furniture clearance, bench occupancy and proper chair frames, paired conversations, calm fishing duty cycle, doorway visits, edge exits, bounded dog following, irregular duck flutters, atlas composition, frame bounds, greetings, perspective and animation gating. A smoke check of the actual page module with DOM/canvas stubs verifies all 49 source images, eight greeting targets, assembled unique outfits and seated poses, dog/duck rendering, cropped duck legs, paused reactions, dialogs, mobile and reduced-motion behavior. Browser rendering was not tested.

## Approved mockup prompt

Method: built-in image generation.

Use case: ui-mockup.
Create ONE beautifully composed desktop website concept mockup for Miguel Nogales's personal About Me page, as an edge-to-edge landscape raster image, approximately 16:10 aspect ratio (reference browser viewport 1440 x 900). No laptop frame, browser frame, perspective mockup or outer margins.

PRIMARY COMPOSITION: One continuous, immersive, cozy pixel-art coastal village landscape. The village land and activity occupy the LEFT 66% of the image and extend the entire vertical height. The RIGHT 34% is mostly open blue lake water with a narrow column of four readable city cards floating over the water. No solid sidebar background and no hard vertical dividing line: the coastline naturally joins the two areas. Lake Lugano is especially evident in the lower-right, continuing as water behind the cards. A tiny distant wooded mountain shore may sit along the top-right edge; no large sky or horizon band. Keep the camera a coherent slightly elevated TOP-DOWN ORTHOGRAPHIC 2D RPG view like Stardew Valley, not isometric diamond terrain or 3D rendering.

ART: Authentic carefully drawn 16-bit pixel art with visible crisp square pixel clusters, consistent pixel scale, bounded rich palette, layered leafy trees, warm terracotta roof tiles, honey stone, little gardens and flowers, inviting blue-teal water, thoughtful highlights and shadows. Stardew Valley mood and environmental density, original cohesive artwork. A small believable lived-in Mediterranean lakeside village, intimate pedestrian scale, not four separate city displays. A satisfying interlocking composition of paths, small houses, trees, small piazza and shore. Leave walking space and do not overcrowd. Ordinary houses should integrate the landmarks.

LANDMARK PLACEMENT AND SILHOUETTES:
1. Upper-left entrance: a small faithful stylization of Puerta de Palmas in Badajoz, TWO round sandy-stone crenellated towers connected by a central arched gate, integrated with an entrance path and small stone bridge.
2. Left/lower-middle near the river: Torre del Oro in Sevilla, a compact honey-ochre polygonal riverside tower, crenellated large main body, narrower stacked upper turret and small golden cap; nearby orange trees and a promenade.
3. Upper-middle inland, clearly within the LEFT 66%: a miniature Duomo di Milano facing the viewer with pale marble Gothic facade, many slender pointed pinnacles, pointed windows and central doors, opening into a small village piazza. Distinctive and recognizable but not monumentally overscaled relative to the village.
4. Lower-right shore: Lake Lugano as a sheltered lakefront with small timber jetty, a moored rowboat, ducks and small wooded slopes suggested in the distance.

A narrow river enters from the upper-left, passes under the gate's nearby bridge, meanders through the village and opens continuously into the lake near the bottom-right of the land. Clear geographically coherent continuous water, no disconnected blue pools. Provide 6-8 little original resident sprites at the same small character scale, caught in ordinary activities: walking along paths, two chatting by the piazza, one sitting at a cafe terrace, one walking a dog, one fishing from the jetty. No player HUD, speech bubbles, quests, inventory or numbered markers.

RIGHT HAND UI: Quiet, compact, readable, restrained editorial cards over water, all contained in the rightmost third, padded away from the right edge and separated from the village. At top of this column, small title text 'Miguel Nogales', with smaller 'A few places I call home'. Below, exactly FOUR stacked cards, each a light warm paper-like rectangle with a subtle thin dark pixel border, a small square pixel vignette of the matching place on the left, city name and one short line on right. No huge heading, no long body paragraphs, no additional cards. Exact card text:
'Badajoz' / 'Where it began'
'Sevilla' / 'University years'
'Milano' / 'A new perspective'
'Lugano' / 'The current chapter'
At bottom of card column two small understated text links: 'Hobbies' and 'Back to website'.
Use readable understated typography, city names clearly legible at a desktop mockup size. Keep card column a secondary visual element and the world the dominant experience. Water visible above, below and between cards. No labels over buildings, no watermarks, no promotional headings, no oversized interface chrome.

This is a finished static composition study showing what the planned living village website can look like, not a sprite sheet or an annotated diagram. Prioritize beautiful cohesive game-quality pixel craftsmanship, gentle life and clear requested layout.

# Village asset generation provenance

Method: built-in imagegen tool. One request per asset, issued in parallel. No retries or variants.

## Clean village background

Operation: edit approved background mockup.

Input image: `desktop-concept-v1.png`

Selected output: `village-background-v1.png`

Output dimensions: 1586 × 992 pixels, RGB.

Exact prompt:

> Use case: precise-object-edit. Asset type: production background for a 16:10 web viewport. Input image is the EDIT TARGET, approved finished artwork. Preserve its exact camera, palette, geometry, building placements, overall proportions, framing, intricate 16-bit pixel detail, lighting, and all scene objects except the specified removals. Make ONLY these changes: (1) Remove all text and UI: title Miguel Nogales, subtitle, all four entire destination cards including borders/thumbnails and text, and Hobbies / Back to website footer. Replace all their pixels with uninterrupted lake water matching surrounding lake. (2) Remove ALL people, the one dog, and all four foreground ducks. Specifically remove person beneath gate, piazza pair, dog walker plus dog, path woman, green-shirt lower pedestrian, bench sitter, café patron, fisherman with fishing rod and fishing line, and four ducks. Reconstruct the natural background beneath each removal. Preserve unoccupied furniture, tables, chairs, bench, fountain, boat, jetty, bucket, landmarks, buildings, walls, river, flowers, trees, landscape and sailboats unchanged. Do not add other subjects or scene changes. Maintain original 16:10 composition and dimensions as closely as possible. No text, no UI, no humans, no dogs, no ducks. This is an exact clean-plate edit for animation overlays.

## Original walking sprite generation

Operation: new image generation; no input image.

Output: not integrated (invalid alpha/grid).

Output dimensions: 1254 × 1254 pixels, RGB. The output did not satisfy the requested transparency or exact grid dimensions and was unsuitable for direct production animation.

Exact prompt:

> Use case: illustration-story. Asset type: production 16-bit pixel art walking sprite sheet. Generate one 1024x1024 PNG with a genuinely TRANSPARENT background (alpha, not a painted checkerboard). Strict grid of FOUR COLUMNS by FOUR ROWS with exactly 256x256 pixels per cell, no borders, labels or guides. Every one of the sixteen cells contains the SAME original young brown-haired village resident, moss-green shirt, dark brown trousers, brown shoes. Warm muted earth palette, crisp hard square pixels matching a detailed Mediterranean village 16-bit adventure game. Each person occupies about 120x200 pixels centered horizontally within its cell, feet consistently at y224 within every cell. Consistent anatomy, size, feet registration and outfit. Exactly four walk cycle frames left-to-right per row: contact A, passing A, contact B, passing B. Row 1 DOWN walking toward viewer, row 2 LEFT, row 3 RIGHT, row 4 UP walking away from viewer. Walking legs alternate, arms counter-swing; no bobbing of feet registration. One full person per cell, transparent surrounding whitespace so cells crop cleanly. Design as a 24x40 logical-pixel sprite enlarged 5x nearest-neighbor, not high-resolution illustration. Final intended display is about 22x38 web pixels on a 1440x900 landscape. No text, no padding differences, no shadows outside figure, no floor, no accessories, no extra characters.


## Background correction v2

`village-background-v2.png` is a built-in ImageGen edit of v1, 1586 × 992 RGB. It removes the café A-frame chalkboard and replaces the gate’s water-filled opening with a continuous dry stone bridge/deck. The previous image is retained. Existing door/boat/jetty coordinates were preserved closely, with some generated texture variation. Exact prompt:

Use case: precise-object-edit. Input image is the EDIT TARGET, production village background, 1586x992. Make ONLY two localized corrections. 1. Remove the standing A-frame chalkboard sign directly in front of the café around image coordinate x661,y766, and fill its former footprint with matching uninterrupted cobblestones. Preserve café table, chairs, flower pots, striped awning, doors, plants and all other furniture. 2. Correct the stone Puerta de Palmas bridge/deck in the upper left. Keep the gate's two round towers, positions, size and architectural details unchanged. Create a continuous clearly walkable STONE road/deck from the gate arch threshold through the bridge to the existing village streets, connecting near x300,y350. The gate opening must contain dry stone paving receding through it, NOT blue river water. Add coherent low stone parapets/stone arch supporting that deck as needed within the small existing bridge area; the river must pass BELOW/outside this stone bridge, never across the top of the walkway or through the gate opening. A pedestrian should be able to walk from the gate opening across dry stone paving into the village street with no disappearing walkway. Preserve ALL remaining scene geometry, buildings, exact placement of doors, cathedral, tower, lake, boat, jetty, distant shore, vegetation, camera/framing, pixel-art palette, fine pixel detail, lighting and dimensions EXACTLY. Do not add people, animals, signs, text or objects anywhere else. Output same 1586x992 composition. Only the chalkboard removal and local dry-stone bridge continuity correction.

## Background correction v3

`village-background-v3.png` is a built-in ImageGen edit of v2, 1586 × 992 RGB. It trims the road-facing canopy above the standalone middle-left house, exposing the paved path. Previous backgrounds are retained. Exact prompt:

Use case: precise-object-edit. EDIT TARGET is the attached production pixel-art village background, 1586x992. Make ONE conservative localized foliage correction. At middle-left there is a small standalone stone house with orange tiled roof, green doorway, centered roughly x350,y450. The tree canopy directly ABOVE AND BESIDE this house, approximately x360–445,y330–425, protrudes onto the paved central walking path that runs toward the cathedral. Trim back ONLY the road-facing protruding foliage so the visible cobblestone walkway has a clean unobstructed edge and pedestrians on this path would never overlap tree canopy. Preserve most of that tree and the entire house, including roof, doorway, flowers and position. Conservatively remove only any immediately contiguous foliage edge protruding onto this SAME middle walking path, exposing matching cobblestones below it. Keep all surrounding scene geometry EXACTLY unchanged: cathedral, fountain, every door, house footprint, furniture, stone walls, shore, dock, boat, boats, lake, bench, tower, trees away from this local path. Preserve the already-correct dry stone paving through Puerta de Palmas gate and its continuous stone bridge. The removed cafe A-frame sign must remain absent. Preserve camera/framing, original 1586x992 dimensions, warm lighting, pixel-art palette and fine pixel texture. Do not add people, animals, text, signs, new objects, new buildings or new paths. Only trim the specified local road-facing canopy edge beside the middle-left standalone house.
