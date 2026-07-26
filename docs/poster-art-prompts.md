# Personalized BaZi Poster Art Prompts

This document is the reproducible prompt set for the 20-background BaZi poster art family. Generate one portrait candidate per missing asset with the built-in ImageGen tool. Do not ask the model to render labels; filenames and review labels are added locally.

## Visual benchmark

Use `.superpowers/brainstorm/735-1785037384/content/yimu-female-bg.png` as a visual style and quality reference only. It is the approved `yi-female` source and must be copied unchanged rather than regenerated.

When using the benchmark as an input image, prepend:

```text
Input image: visual style and quality benchmark only; create a new, clearly distinct composition. Do not edit, trace, or reproduce it.
```

If an input image cannot be attached, prepend this equivalent descriptor:

```text
Visual family benchmark description: light aged-silk central field; deep ink and malachite edge subjects; fine antique-gold spiritual meridians; gongbi mineral-pigment detail fused with xieyi Chinese ink wash; living ink and cloud-and-water qi; premium, mature, restrained.
```

## Shared prompt

Use this prompt for every generated asset, substituting the exact asset request from the catalog below.

```text
Use case: ads-marketing
Asset type: portrait 9:16 BaZi identity poster background
Primary request: <EXACT ASSET REQUEST>
Style/medium: unmistakably Chinese Eastern fantasy; gongbi mineral-pigment painting fused with xieyi ink wash on aged silk; malachite, ink, restrained cinnabar and antique gold; living ink, cloud-and-water qi, gold spiritual meridians; premium, mature, restrained.
Composition/framing: portrait 9:16. The day-master subject frames the left/lower and restrained upper-right edges; a large quiet luminous light-aged-silk text-safe field remains in the upper-middle and center; strong controlled lower-third contrast for overlaid copy. Create an original composition rather than recoloring the benchmark.
Constraints: background only; no people, text, Chinese characters, pseudo-characters, letters, numbers, logo, seal, watermark; no Western Art Nouveau, Celtic, European fairy, baroque frame, photorealistic lens look; no unrelated mountain, bridge, pavilion, architecture, horizon, room, or generic scenery. Preserve visible Chinese brush and ink language, mineral-pigment detail, deep edge contrast, and fine antique-gold meridians. Production-ready poster background.
```

Asset-specific exclusions such as “no boat,” “no shoreline,” or “no literal room” are binding additions to the shared constraints.

## Wood

### `jia-male`

```text
monumental ink-black ancient trunk rising vertically, broad evergreen branches, vigorous upward antique-gold spiritual meridians, open center-right; stronger silhouette, broader structure, deeper contrast
```

### `jia-female`

```text
majestic living ancient tree with finer branching rhythm, jade shoots and restrained blossoms, luminous but still strong
```

### `yi-male`

```text
long dark-jade vines gripping a firm wood support, fewer flowers, decisive diagonal ascent, stronger ink contrast
```

### `yi-female`

Do not generate. Copy the approved benchmark unchanged:

```text
.superpowers/brainstorm/735-1785037384/content/yimu-female-bg.png
```

## Fire

### `bing-male`

```text
vast cinnabar-gold solar disc and outward fire qi, bold radial force, ink-dark perimeter, no landscape; stronger silhouette
```

### `bing-female`

```text
luminous vermilion sun aura with layered silk-like flame clouds, warmer fine-gold rhythm, clear central text field
```

### `ding-male`

```text
single concentrated bronze-lamp flame floating in deep ink, precise upward core, controlled sparks, no literal room or table
```

### `ding-female`

```text
delicate but unwavering lotus-shaped lamp flame, cinnabar and antique-gold light through translucent ink layers, no literal room
```

## Earth

### `wu-male`

```text
monumental earthen mass and square seal-like strata, ochre mineral texture, heavy stable base, abstract, no scenery; square seal-like quality remains abstract geometry and never writing
```

### `wu-female`

```text
layered fertile earth, rounded terraces expressed abstractly in ink and mineral pigment, quiet holding strength, fine sprouts; emphatically not a landscape
```

### `ji-male`

```text
dark fertile soil patterns with ordered grain shoots and grounded antique-gold lines, practical and contained; abstract close framing, no literal field
```

### `ji-female`

```text
rich silk-textured earth with fine herbs, grain and soft green shoots, nurturing but not a pastoral illustration; no farm or literal field
```

## Metal

### `geng-male`

```text
unadorned forged steel blade and angular metallic qi, silver-white edge, black-ink sparks, forceful diagonal; no hands, weapon rack, or ornate fantasy-sword decoration
```

### `geng-female`

```text
refined celestial steel with crisp planes and controlled silver aura, firm rather than jewelry-like, elegant sharpness; no jewelry or weapon display
```

### `xin-male`

```text
cut white metal, jade-like mineral facets and a small ritual seal form, precise restrained gleam; the ritual seal form is abstract and blank, with no legible imprint
```

### `xin-female`

```text
pearl, white jade and fine worked-metal light gathered as an abstract precious-metal aura, clean and discerning; never a jewelry box, necklace, or product display
```

## Water

### `ren-male`

```text
vast surging ink-water current and deep blue-black waves, powerful horizontal-to-upward flow, no boat or shoreline; abstract close framing without a horizon
```

### `ren-female`

```text
expansive layered water ribbons and moonlit indigo current, fluid intelligence, finer wave rhythm without wallpaper softness; no boat, shoreline, or repetitive pattern
```

### `gui-male`

```text
concentrated rain threads, dew and underground water qi gathering into a dark clear current, subtle persistence; no cave, boat, shoreline, or horizon
```

### `gui-female`

```text
luminous rain, dew beads and translucent water-calligraphy on silk, quiet permeating force, pearl-blue highlights; water-calligraphy means non-linguistic flowing brush marks only, with no pseudo-characters
```

## Review acceptance checklist

- Portrait 9:16 candidate with no crop-dependent content.
- Large quiet upper-middle/center text-safe field.
- Controlled lower-third contrast for overlaid copy.
- No person, text, character, number, logo, seal, or watermark.
- No Western border language or unrelated scenery.
- Clear day-master subject and gendered variation.
- Coherent aged-silk, mineral-pigment, ink, malachite, and antique-gold art family.
- Composition is meaningfully distinct, not a palette swap.
